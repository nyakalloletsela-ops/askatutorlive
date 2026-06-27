import * as React from 'react'
import { render } from '@react-email/components'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { TEMPLATES, type TemplateEntry } from '@/lib/email-templates/registry'

const FROM_DOMAIN = 'www.askatutorlive.com'
const SENDER_DOMAIN = 'notify.www.askatutorlive.com'
const ALIAS_DISPLAY: Record<string, string> = {
  noreply: 'askatutor',
  admin: 'askatutor Admin',
  help: 'askatutor Help',
  tutors: 'askatutor Tutors',
  students: 'askatutor Students',
  billing: 'askatutor Billing',
}
const ALLOWED = new Set(Object.keys(ALIAS_DISPLAY))

function token32() {
  const b = new Uint8Array(32); crypto.getRandomValues(b)
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')
}

interface EnqueueParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, any>
  fromAlias?: string
}

/**
 * Server-only helper that renders a registered template and enqueues it to
 * the transactional_emails pgmq queue. Mirrors the public send route, but
 * bypasses auth — only call from trusted server code (server fns, webhooks).
 */
export async function enqueueTransactionalEmail(p: EnqueueParams) {
  const tpl = TEMPLATES[p.templateName] as TemplateEntry & { fromAlias?: string } | undefined
  if (!tpl) throw new Error(`Unknown template: ${p.templateName}`)
  const recipient = tpl.to || p.recipientEmail
  if (!recipient) throw new Error('recipientEmail required')
  const normalized = recipient.toLowerCase()
  const messageId = crypto.randomUUID()

  // Suppression check
  const { data: sup } = await supabaseAdmin
    .from('suppressed_emails').select('id').eq('email', normalized).maybeSingle()
  if (sup) return { suppressed: true }

  // Unsubscribe token (one per email)
  let unsub: string
  const { data: existing } = await supabaseAdmin
    .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalized).maybeSingle()
  if (existing?.token && !existing.used_at) {
    unsub = existing.token
  } else {
    unsub = token32()
    await supabaseAdmin.from('email_unsubscribe_tokens')
      .upsert({ token: unsub, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: re } = await supabaseAdmin
      .from('email_unsubscribe_tokens').select('token').eq('email', normalized).maybeSingle()
    unsub = re?.token ?? unsub
  }

  // Render
  const el = React.createElement(tpl.component, p.templateData ?? {})
  const html = await render(el)
  const text = await render(el, { plainText: true })
  const subject = typeof tpl.subject === 'function' ? tpl.subject(p.templateData ?? {}) : tpl.subject

  const aliasRaw = (p.fromAlias ?? tpl.fromAlias ?? 'noreply').toLowerCase()
  const alias = ALLOWED.has(aliasRaw) ? aliasRaw : 'noreply'

  await supabaseAdmin.from('email_send_log').insert({
    message_id: messageId,
    template_name: p.templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error } = await supabaseAdmin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${ALIAS_DISPLAY[alias]} <${alias}@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: p.templateName,
      idempotency_key: p.idempotencyKey ?? messageId,
      unsubscribe_token: unsub,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) throw new Error(error.message)
  return { queued: true, messageId }
}
