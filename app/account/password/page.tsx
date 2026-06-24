'use client'

import { useActionState } from 'react'
import { changePassword } from '@/modules/auth/actions'
import type { ChangePasswordState } from '@/modules/auth/actions'
import Link from 'next/link'
import Image from 'next/image'

export default function ChangePasswordPage() {
  const [state, action, pending] = useActionState<ChangePasswordState | null, FormData>(
    changePassword,
    null
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>

          <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Change Password</h1>
          <p className="mb-7 text-center text-[13px] text-[#9CA3AF]">
            Update the password for your account
          </p>

          {state?.success && (
            <div className="mb-4 rounded-lg bg-[#E7F8EE] px-4 py-3 text-[13px] text-[#15803D]">
              Password updated successfully.
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
                Current password
              </label>
              <input
                type="password"
                name="current_password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                New password
              </label>
              <input
                type="password"
                name="new_password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Confirm new password
              </label>
              <input
                type="password"
                name="confirm_password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#FF8A1F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link href="/" className="text-[13px] text-[#64748B] hover:underline">
              ← Back to portal
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
