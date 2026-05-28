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
      <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Sign in to Robocode</h1>
      <p className="mb-7 text-center text-[13px] text-gray-400">
        Enter your email and password to continue
      </p>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {successMsg}
        </div>
      )}

      {routeMsg && !successMsg && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {routeMsg}
        </div>
      )}

      {state?.error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {state.error}
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
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] text-[#19C6F4] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  )
}

export default function LoginClient() {
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
