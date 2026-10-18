'use client'

import { useState, useTransition, useRef } from 'react'
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
  const starting = useRef(false)

  const trimmed     = topic.trim()
  const topicInvalid = trimmed.length === 0 || trimmed.toLowerCase() === 'no topic'

  const handleStart = () => {
    if (starting.current) return
    setTouched(true)
    if (topicInvalid) return
    starting.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await startGroupSession(groupCourseId, groupId, branchId, trimmed)
        if (result.success) router.push(`/portal/instructor/groups/${groupId}/sessions/${result.data.sessionId}`)
        else setError(result.error.message)
      } catch {
        setError('Could not confirm the session started. Please try again; your topic has been kept.')
      } finally { starting.current = false }
    })
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {/* Input + button — stacked on mobile, side-by-side on sm+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          aria-label="Session topic"
          disabled={isPending}
          value={topic}
          onChange={e => { setTopic(e.target.value); setTouched(false) }}
          onBlur={() => setTouched(true)}
          placeholder="Session topic (required)"
          className="w-full min-w-0 rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#C2410C] focus:outline-none"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleStart() } }}
        />
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="w-full rounded-lg bg-[#C2410C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#9A3412] disabled:opacity-60 transition sm:w-auto sm:shrink-0 sm:whitespace-nowrap"
        >
          {isPending ? 'Starting…' : 'Start Session'}
        </button>
      </div>
      {touched && topicInvalid && (
        <p className="text-xs text-[#EF4444]">Topic is required to start a session.</p>
      )}
      {error && <p role="alert" className="text-sm font-medium text-[#B91C1C]">{error}</p>}
    </div>
  )
}
