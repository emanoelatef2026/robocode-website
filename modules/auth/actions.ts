'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { deleteSessionCookie } from '@/lib/lms-session'
import { z } from 'zod'

const MagicLinkSchema = z.object({
  email: z.string().email(),
})

async function getCallbackUrl(): Promise<string> {
  const headersList = await headers()
  // x-forwarded-host is set by Vercel/proxies; host is the direct header
  const host = headersList.get('x-forwarded-host')
           ?? headersList.get('host')
           ?? 'localhost:3000'
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${proto}://${host}/auth/callback`
}

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = MagicLinkSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: await getCallbackUrl(),
      shouldCreateUser: false, // Only allow pre-existing accounts
    },
  })

  if (error) {
    const msg = error.message ?? ''
    console.error('[auth] sendMagicLink error:', msg, '| status:', (error as any).status ?? 'none')

    // Translate the one Supabase message that isn't user-readable.
    // All others (rate-limit countdown, redirect errors, etc.) are already
    // human-readable and must be passed through unchanged so the user sees
    // the exact wait time instead of a vague generic string.
    if (
      msg.toLowerCase().includes('signups not allowed') ||
      msg.toLowerCase().includes('otp disabled')
    ) {
      return { error: 'This email is not registered. Contact your administrator.' }
    }

    return { error: msg || 'Could not send magic link. Please try again.' }
  }

  return {}
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  await deleteSessionCookie()
  redirect('/login')
}
