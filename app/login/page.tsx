'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { sendMagicLink } from '@/modules/auth/actions'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code:    'Invalid or expired link. Please request a new one.',
  auth_failed:     'Authentication failed. Please try again.',
  server_error:    'Server error. Please try again shortly.',
  no_role:         'Your account has no role assigned. Contact your administrator.',
  forbidden:       'You do not have permission to access that page.',
  session_expired: 'Your session expired. Please sign in again.',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const errorKey     = searchParams.get('error')
  const errorMsg     = errorKey ? ERROR_MESSAGES[errorKey] : null

  const [state, action, pending] = useActionState(sendMagicLink, undefined)
  const sent = state && !state.error

  if (sent) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#19C6F4]/10">
            <svg className="h-7 w-7 text-[#19C6F4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-lg font-bold text-[#0B132B]">Check your email</h1>
        <p className="text-[13px] text-gray-400">
          We sent a magic link to your inbox. Click it to sign in.
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Sign in to Robocode</h1>
      <p className="mb-7 text-center text-[13px] text-gray-400">
        Enter your email and we&apos;ll send you a magic link
      </p>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {errorMsg}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">
            Email address
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-500">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-50" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-gray-400">Robocode School · LMS</p>
      </div>
    </div>
  )
}
