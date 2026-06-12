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
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={topic}
          onChange={e => { setTopic(e.target.value); setTouched(false) }}
          onBlur={() => setTouched(true)}
          placeholder="Session topic (required)"
          className="flex-1 min-w-0 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleStart() } }}
        />
        <button
          onClick={handleStart}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
        >
          {isPending ? 'Starting…' : 'Start Session'}
        </button>
      </div>
      {touched && topicInvalid && (
        <p className="text-xs text-red-600">Topic is required to start a session.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
