'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [pending, start]    = useTransition()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/forgot-password')
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

      // Sign out the temporary recovery session — user must log in with the new password
      await supabase.auth.signOut()
      router.push('/login?message=password_reset')
    })
  }

  if (sessionReady === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cyan-strong)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div data-site-auth className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div data-site-card className="p-6 sm:p-8">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="Robocode" width={140} height={60} className="h-auto w-28" />
          </div>

          <h1 className="mb-1 text-center text-lg font-bold text-[var(--navy)]">Set new password</h1>
          <p className="mb-7 text-center text-[13px] text-[var(--muted)]">
            Choose a new password for your account
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-[var(--red-soft)] px-4 py-3 text-[13px] text-[var(--red-dark)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-password" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                New password
              </label>
              <input
                type="password"
                id="reset-password"
                name="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-[14px] text-[var(--navy)] outline-none transition focus:border-[var(--cyan-strong)] focus:ring-2 focus:ring-[var(--cyan-strong)]/20"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Confirm new password
              </label>
              <input
                type="password"
                name="confirm"
                id="reset-confirm"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-[14px] text-[var(--navy)] outline-none transition focus:border-[var(--cyan-strong)] focus:ring-2 focus:ring-[var(--cyan-strong)]/20"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[var(--navy)] py-3 text-[14px] font-semibold text-white transition hover:bg-[var(--cyan-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[12px] text-[var(--muted)]">Robocode School · LMS</p>
      </div>
    </div>
  )
}
