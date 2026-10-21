'use client'

import { Suspense, useActionState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { requestPasswordReset } from '@/modules/auth/actions'
import type { RequestPasswordResetState } from '@/modules/auth/actions'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const linkExpired  = searchParams.get('error') === 'link_expired'

  const [state, action, pending] = useActionState<RequestPasswordResetState | null, FormData>(
    requestPasswordReset,
    null
  )

  if (state?.submitted) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--green-soft)]">
            <svg className="h-7 w-7 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-lg font-bold text-[var(--navy)]">Check your email</h1>
        <p className="text-[13px] text-[var(--muted)]">
          If that account is registered, you will receive a password reset link shortly.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[13px] text-[var(--cyan-strong)] hover:underline">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-center text-lg font-bold text-[var(--navy)]">Reset your password</h1>
      <p className="mb-4 text-center text-[13px] text-[var(--muted)]">
        Enter your username and we&apos;ll send you a reset link
      </p>

      <div className="mb-5 rounded-lg bg-[#F0F9FF] px-4 py-3 text-[12px] text-[var(--navy)]">
        Staff (instructors, team leaders, admins): enter your username below.
        Students and parents: your login isn&apos;t a real inbox — ask your instructor or team leader
        to reset your password instead.
      </div>

      {linkExpired && (
        <div className="mb-4 rounded-lg bg-[var(--red-soft)] px-4 py-3 text-[13px] text-[var(--red-dark)]">
          Your reset link has expired. Request a new one below.
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="reset-username" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Username
          </label>
          <div dir="ltr" className="flex flex-col items-stretch overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] transition focus-within:border-[var(--cyan-strong)] focus-within:ring-2 focus-within:ring-[var(--cyan-strong)]/20 sm:flex-row">
            <input
              type="text"
              id="reset-username"
              name="email"
              required
              autoComplete="username"
              placeholder="e.g. e.atef"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[14px] text-[var(--navy)] outline-none"
            />
            <span className="flex items-center justify-center whitespace-nowrap border-t border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-[13px] text-[var(--muted)] sm:border-s sm:border-t-0 sm:py-0">
              @robocodeschools.com
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--navy)] py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--cyan-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <Link href="/login" className="text-[13px] text-[var(--cyan-strong)] hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div data-site-auth className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div data-site-card className="p-6 sm:p-8">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-[var(--bg-muted)]" />}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-[var(--muted)]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
