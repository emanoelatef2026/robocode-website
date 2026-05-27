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
    console.error('[auth] sendMagicLink error:', error.message, '| code:', error.code ?? 'none')

    // Surface specific, actionable errors to the user
    const msg = error.message ?? ''
    if (
      msg.includes('Email not confirmed') ||
      msg.toLowerCase().includes('user not found') ||
      msg.toLowerCase().includes('invalid login')
    ) {
      return { error: 'This email address is not registered. Contact your administrator.' }
    }
    if (
      msg.toLowerCase().includes('rate limit') ||
      msg.toLowerCase().includes('too many requests') ||
      msg.toLowerCase().includes('security purposes')
    ) {
      return { error: 'Too many requests. Please wait a minute and try again.' }
    }
    if (
      msg.toLowerCase().includes('redirect') ||
      msg.toLowerCase().includes('not allowed')
    ) {
      return { error: 'Login is misconfigured. Please contact support. (redirect)' }
    }

    // In non-production, expose the raw message to aid debugging
    if (process.env.NODE_ENV !== 'production') {
      return { error: `[dev] Supabase error: ${error.message}` }
    }

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
