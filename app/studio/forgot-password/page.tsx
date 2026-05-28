'use client'

import { Suspense, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function StudioForgotPasswordForm() {
  const searchParams = useSearchParams()
  const linkExpired  = searchParams.get('error') === 'link_expired'

  const [sent, setSent]   = useState(false)
  const [error, setError] = useState<string | null>(
    linkExpired ? 'Your reset link has expired. Request a new one below.' : null
  )
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim()

    start(async () => {
      const supabase = createSupabaseBrowserClient()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery&source=studio`,
      })
      if (err) {
        setError(err.message || 'Failed to send recovery email. Please try again.')
      } else {
        setSent(true)
      }
    })
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <svg className="h-7 w-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-lg font-bold text-[#0B132B]">Check your email</h1>
        <p className="text-[13px] text-gray-400">
          If that email is registered, you will receive a password reset link shortly.
        </p>
        <Link href="/studio/login" className="mt-6 inline-block text-[13px] text-[#19C6F4] hover:underline">
          ← Back to Studio sign in
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Reset your password</h1>
      <p className="mb-7 text-center text-[13px] text-gray-400">
        Enter your email and we&apos;ll send you a reset link
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">
            Email address
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link href="/studio/login" className="text-[13px] text-[#19C6F4] hover:underline">
          ← Back to Studio sign in
        </Link>
      </div>
    </>
  )
}

export default function StudioForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-50" />}>
            <StudioForgotPasswordForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-gray-400">Robocode School · Studio</p>
      </div>
    </div>
  )
}
