'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[global] unhandled error:', error)
  }, [error])

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm text-center">
          <h1 className="text-lg font-bold text-[#0B1F3A] mb-2">Unexpected error</h1>
          <p className="text-sm text-[#64748B] mb-6">
            {error.message ?? 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={reset}
            className="w-full rounded-lg bg-[#0B1F3A] py-3 text-sm font-semibold text-white transition hover:bg-[#FF8A1F]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
