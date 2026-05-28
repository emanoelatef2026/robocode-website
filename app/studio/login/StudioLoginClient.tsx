'use client'

import { Suspense, useActionState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signInStudio } from '@/modules/auth/actions'
import type { SignInStudioState } from '@/modules/auth/actions'

const ROUTE_ERROR_MESSAGES: Record<string, string> = {
  session_expired:  'Your session has expired. Please sign in again.',
  forbidden:        'You do not have permission to access that page.',
}

const ROUTE_SUCCESS_MESSAGES: Record<string, string> = {
  password_reset: 'Password updated successfully. Sign in with your new password.',
}

function StudioLoginForm() {
  const searchParams = useSearchParams()
  const routeError   = searchParams.get('error')
  const routeMsg     = searchParams.get('message')
  const routeMessage = routeError ? ROUTE_ERROR_MESSAGES[routeError] : null
  const successMessage = routeMsg ? ROUTE_SUCCESS_MESSAGES[routeMsg] : null

  const [state, action, pending] = useActionState<SignInStudioState | null, FormData>(
    signInStudio,
    null
  )

  const errorMessage = state?.error ?? routeMessage

  return (
    <>
      <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Studio</h1>
      <p className="mb-7 text-center text-[13px] text-gray-400">
        Sign in with your Robocode account
      </p>

      {successMessage && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {successMessage}
        </div>
      )}

      {errorMessage && !successMessage && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {errorMessage}
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
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-gray-400">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/studio/forgot-password"
            className="text-[12px] text-[#19C6F4] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </>
  )
}

export default function StudioLoginClient() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-50" />}>
            <StudioLoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-gray-400">Robocode School · Studio</p>
      </div>
    </div>
  )
}
