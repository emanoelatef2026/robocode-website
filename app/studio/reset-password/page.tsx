'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function StudioResetPasswordPage() {
  const router = useRouter()
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [pending, start]    = useTransition()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/studio/forgot-password')
      } else {
        setSessionReady(true)
      }
    })
  }, [router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value
    const confirm  = (e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    start(async () => {
      const supabase = createSupabaseBrowserClient()
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) {
        setError(updateErr.message || 'Failed to update password. Please try again.')
        return
      }

      await supabase.auth.signOut()
      router.push('/studio/login?message=password_reset')
    })
  }

  if (sessionReady === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 shadow-sm">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>

          <h1 className="mb-1 text-center text-lg font-bold text-[#0B132B]">Set new password</h1>
          <p className="mb-7 text-center text-[13px] text-[#9CA3AF]">
            Choose a new password for your account
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-[13px] text-[#EF4444]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                New password
              </label>
              <input
                type="password"
                name="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Confirm new password
              </label>
              <input
                type="password"
                name="confirm"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#0B132B] outline-none transition focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#0B132B] py-3 text-[14px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">Robocode School · Studio</p>
      </div>
    </div>
  )
}
