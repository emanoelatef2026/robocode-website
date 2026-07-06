import { Resend } from 'resend'

/** Emails a Supabase-generated recovery link to a real inbox — used when the
 *  account's login address (public.users.recovery_email) isn't one. Silently
 *  no-ops if Resend isn't configured, mirroring app/api/cron/integrity-check. */
export async function sendRecoveryEmail(to: string, actionLink: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'Robocode LMS <onboarding@resend.dev>',
    to,
    subject: 'Reset your Robocode password',
    text:    `Click the link below to reset your Robocode password:\n\n${actionLink}\n\nIf you didn't request this, you can ignore this email.`,
  })
}
