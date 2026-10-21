'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { signIn } from '@/modules/auth/actions'
import type { SignInState } from '@/modules/auth/actions'

const ROUTE_ERROR_MESSAGES: Record<string, string> = {
  session_expired: 'Your session expired. Please sign in again.',
  forbidden:       'You do not have permission to access that page.',
  password_reset:  'Password updated successfully. Sign in with your new password.',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const routeError   = searchParams.get('error')
  const message      = searchParams.get('message')
  const routeMsg     = routeError ? ROUTE_ERROR_MESSAGES[routeError] : null
  const successMsg   = message   ? ROUTE_ERROR_MESSAGES[message]    : null

  const [state, action, pending] = useActionState<SignInState | null, FormData>(signIn, null)

  return (
    <>
      <h1 className="mb-1 text-center text-lg font-bold text-[var(--navy)]">Sign in to Robocode</h1>
      <p className="mb-7 text-center text-[13px] text-[var(--muted)]">
        Enter your username and password to continue
      </p>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-[var(--green-soft)] px-4 py-3 text-[13px] text-[var(--green-dark)]">
          {successMsg}
        </div>
      )}

      {routeMsg && !successMsg && (
        <div className="mb-4 rounded-lg bg-[var(--red-soft)] px-4 py-3 text-[13px] text-[var(--red-dark)]">
          {routeMsg}
        </div>
      )}

      {state?.error && (
        <div className="mb-4 rounded-lg bg-[var(--red-soft)] px-4 py-3 text-[13px] text-[var(--red-dark)]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="login-username" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Username
          </label>
          <div dir="ltr" className="flex flex-col items-stretch overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] transition focus-within:border-[var(--cyan-strong)] focus-within:ring-2 focus-within:ring-[var(--cyan-strong)]/20 sm:flex-row">
            <input
              type="text"
              id="login-username"
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] text-[var(--cyan-strong)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            id="login-password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-[14px] text-[var(--navy)] outline-none transition focus:border-[var(--cyan-strong)] focus:ring-2 focus:ring-[var(--cyan-strong)]/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--navy)] py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--cyan-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  )
}

export default function LoginClient() {
  return (
    <div data-site-auth className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div data-site-card className="p-6 sm:p-8">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-[var(--bg-muted)]" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-[var(--muted)]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
