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
      <p className="mb-7 text-center text-[13px] text-[#9CA3AF]">
        Enter your username and password to continue
      </p>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-[#E7F8EE] px-4 py-3 text-[13px] text-[#15803D]">
          {successMsg}
        </div>
      )}

      {routeMsg && !successMsg && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-[13px] text-[#EF4444]">
          {routeMsg}
        </div>
      )}

      {state?.error && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-[13px] text-[#EF4444]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Username
          </label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] transition focus-within:border-[#19C6F4] focus-within:ring-2 focus-within:ring-[#19C6F4]/20">
            <input
              type="text"
              name="email"
              required
              autoComplete="username"
              placeholder="e.g. e.atef"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[14px] text-[#0B132B] outline-none"
            />
            <span className="flex items-center whitespace-nowrap border-l border-[#E2E8F0] bg-[#F1F5F9] px-3 text-[13px] text-[#9CA3AF]">
              @robocodeschools.com
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
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
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
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
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-[#F9FAFB]" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
