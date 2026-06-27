import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { enqueueTransactionalEmail } from '@/lib/email/enqueue.server'

const HelpSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(5).max(5000),
  user_id: z.string().uuid().nullable().optional(),
})

export const submitHelpMessage = createServerFn({ method: 'POST' })
  .inputValidator((input) => HelpSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from('help_messages')
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        body: data.body,
        user_id: data.user_id ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    await Promise.all([
      enqueueTransactionalEmail({
        templateName: 'help-confirmation',
        recipientEmail: data.email,
        idempotencyKey: `help-confirm-${row.id}`,
        templateData: { name: data.name, subject: data.subject, body: data.body },
        fromAlias: 'help',
      }).catch((e) => console.error('help-confirmation send failed', e)),
      enqueueTransactionalEmail({
        templateName: 'help-new-ticket',
        recipientEmail: 'help@askatutorlive.com',
        idempotencyKey: `help-notify-${row.id}`,
        templateData: { name: data.name, email: data.email, subject: data.subject, body: data.body },
        fromAlias: 'help',
      }).catch((e) => console.error('help-new-ticket send failed', e)),
    ])

    return { id: row.id }
  })

const SubEmailSchema = z.object({
  tutor_id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  amount: z.number().optional(),
  reason: z.string().max(500).optional(),
})

/**
 * Admin-triggered: notify tutor of subscription approval/rejection.
 * Verifies caller is admin via the user_roles table (using their JWT).
 */
export const sendSubscriptionDecisionEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { data: roles } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin')
    if (!roles || roles.length === 0) throw new Error('Forbidden')

    const { data: prof } = await supabaseAdmin
      .from('profiles').select('full_name').eq('id', data.tutor_id).single()
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(data.tutor_id)
    const email = au.user?.email
    if (!email) throw new Error('Tutor email not found')

    await enqueueTransactionalEmail({
      templateName: data.status === 'approved' ? 'subscription-approved' : 'subscription-rejected',
      recipientEmail: email,
      idempotencyKey: `sub-${data.status}-${data.tutor_id}-${Date.now()}`,
      templateData: { name: prof?.full_name ?? undefined, amount: data.amount ?? 250, reason: data.reason },
      fromAlias: 'billing',
    })
    return { ok: true }
  })

const WelcomeSchema = z.object({
  user_id: z.string().uuid(),
})

/** Authenticated user requests their own welcome email (called once after signup). */
export const sendWelcomeEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => WelcomeSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (context.userId !== data.user_id) throw new Error('Forbidden')
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id)
    if (!u.user?.email) throw new Error('User email not found')
    const { data: prof } = await supabaseAdmin
      .from('profiles').select('full_name').eq('id', data.user_id).single()
    await enqueueTransactionalEmail({
      templateName: 'welcome',
      recipientEmail: u.user.email,
      idempotencyKey: `welcome-${data.user_id}`,
      templateData: { name: prof?.full_name ?? undefined },
      fromAlias: 'noreply',
    })
    return { ok: true }
  })
