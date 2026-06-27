import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function sendOne(payload: {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData: Record<string, any>
}) {
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.VITE_PUBLIC_BASE_URL ||
    'https://askatutor.lovable.app'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  try {
    const r = await fetch(`${baseUrl}/lovable/email/transactional/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      console.error('booking email send failed', r.status, await r.text())
    }
  } catch (e) {
    console.error('booking email send error', e)
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export const notifyBookingEmails = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Look up the session
    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('id, tutor_id, student_id, subject, scheduled_at, duration_min')
      .eq('id', data.sessionId)
      .maybeSingle()
    if (error || !session) {
      console.error('notifyBookingEmails: session not found', error)
      return { ok: false }
    }

    // Authorize: only the session's tutor, student, or an admin may trigger
    // booking emails for this session. Prevents unrelated authenticated users
    // from spamming arbitrary participants by guessing session UUIDs.
    const callerId = context.userId
    const isParticipant =
      callerId === session.tutor_id || callerId === session.student_id
    if (!isParticipant) {
      const { data: adminRows } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .eq('role', 'admin')
        .limit(1)
      if (!adminRows || adminRows.length === 0) {
        return { ok: false, error: 'Forbidden' }
      }
    }

    // Look up names from profiles
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', [session.tutor_id, session.student_id])
    const nameOf = (id: string) =>
      profs?.find((p) => p.id === id)?.full_name ?? null

    // Look up emails via auth admin
    const [tutorRes, studentRes] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(session.tutor_id),
      supabaseAdmin.auth.admin.getUserById(session.student_id),
    ])
    const tutorEmail = tutorRes.data.user?.email ?? null
    const studentEmail = studentRes.data.user?.email ?? null

    const when = formatWhen(session.scheduled_at)
    const tutorName = nameOf(session.tutor_id)
    const studentName = nameOf(session.student_id)

    const sends: Promise<void>[] = []
    if (studentEmail) {
      sends.push(
        sendOne({
          templateName: 'booking-confirmation',
          recipientEmail: studentEmail,
          idempotencyKey: `booking-${session.id}-student`,
          templateData: {
            recipientName: studentName,
            counterpartName: tutorName,
            subject: session.subject,
            scheduledAt: when,
            durationMin: session.duration_min,
            role: 'student',
          },
        }),
      )
    }
    if (tutorEmail) {
      sends.push(
        sendOne({
          templateName: 'booking-confirmation',
          recipientEmail: tutorEmail,
          idempotencyKey: `booking-${session.id}-tutor`,
          templateData: {
            recipientName: tutorName,
            counterpartName: studentName,
            subject: session.subject,
            scheduledAt: when,
            durationMin: session.duration_min,
            role: 'tutor',
          },
        }),
      )
    }
    await Promise.all(sends)
    return { ok: true }
  })
