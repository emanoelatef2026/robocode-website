'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/modules/instructor-portal/actions'

export default function StartSessionButton({
  sessionId,
  groupId,
}: {
  sessionId: string
  groupId:   string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const router = useRouter()

  const handleStart = () => {
    setError(null)
    startTransition(async () => {
      const res = await startSession(sessionId, groupId)
      if (res.success) {
        router.refresh()
      } else {
        setError(res.error.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleStart}
        disabled={isPending}
        className="rounded-lg bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
      >
        {isPending ? 'Starting…' : 'Start Session'}
      </button>
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
