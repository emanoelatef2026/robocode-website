'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { deleteSessionCookie } from '@/lib/lms-session'
import { z } from 'zod'

const MagicLinkSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
})

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = MagicLinkSchema.safeParse({
    email:      formData.get('email'),
    redirectTo: formData.get('redirectTo') || undefined,
  })

  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: parsed.data.redirectTo ??
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      shouldCreateUser: false, // Only allow pre-existing accounts
    },
  })

  if (error) {
    console.error('[auth] sendMagicLink error:', error.message)
    return { error: 'Could not send magic link. Please try again.' }
  }

  return {}
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  await deleteSessionCookie()
  redirect('/login')
}
