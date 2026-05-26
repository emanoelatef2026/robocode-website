'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AdminError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[admin] page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-red-50 p-4">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8 text-red-400">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#0B1F3A]">Something went wrong</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          {error.message ?? 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-[#94A3B8]">Error ID: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e87c18]"
      >
        Try again
      </button>
    </div>
  )
}
