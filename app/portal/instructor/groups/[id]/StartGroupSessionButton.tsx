'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startGroupSession } from '@/modules/instructor-portal/actions'

interface Props {
  groupId:       string
  groupCourseId: string
  branchId:      string
}

export default function StartGroupSessionButton({ groupId, groupCourseId, branchId }: Props) {
  const router                   = useRouter()
  const [isPending, startTransition] = useTransition()
  const [topic, setTopic]        = useState('')
  const [error, setError]        = useState<string | null>(null)
  const [touched, setTouched]    = useState(false)

  const trimmed     = topic.trim()
  const topicInvalid = trimmed.length === 0 || trimmed.toLowerCase() === 'no topic'

  const handleStart = () => {
    setTouched(true)
    if (topicInvalid) return

    setError(null)
    startTransition(async () => {
      const result = await startGroupSession(groupCourseId, groupId, branchId, trimmed)
      if (result.success) {
        router.push(`/portal/instructor/groups/${groupId}/sessions/${result.data.sessionId}`)
      } else {
        setError(result.error.message)
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {/* Input + button — stacked on mobile, side-by-side on sm+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={topic}
          onChange={e => { setTopic(e.target.value); setTouched(false) }}
          onBlur={() => setTouched(true)}
          placeholder="Session topic (required)"
          className="w-full min-w-0 rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleStart() } }}
        />
        <button
          onClick={handleStart}
          disabled={isPending}
          className="w-full rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e07818] disabled:opacity-60 transition sm:w-auto sm:shrink-0 sm:whitespace-nowrap"
        >
          {isPending ? 'Starting…' : 'Start Session'}
        </button>
      </div>
      {touched && topicInvalid && (
        <p className="text-xs text-[#EF4444]">Topic is required to start a session.</p>
      )}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
