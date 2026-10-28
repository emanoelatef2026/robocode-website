'use client'

import { useTransition, useState, useRef } from 'react'
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
  const starting = useRef(false)
  const [role,setRole] = useState<'lead'|'assistant'>('lead')

  const handleStart = () => {
    if (starting.current || role !== 'lead') return
    starting.current = true
    setError(null)
    startTransition(async () => {
      try {
        const res = await startSession(sessionId, groupId)
        if (res.success) { if (res.data?.sessionId && res.data.sessionId !== sessionId) router.push(`/portal/instructor/groups/${groupId}/sessions/${res.data.sessionId}`); else router.refresh() }
        else setError(res.error.message)
      } catch {
        setError('Could not confirm the session started. Please try again; your session will not be duplicated.')
      } finally { starting.current = false }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <label className="text-sm font-semibold">Your role<select aria-label="Your role in this class" value={role} disabled={isPending} onChange={event=>setRole(event.target.value as 'lead'|'assistant')} className="ds-input ml-2"><option value="lead">Lead instructor</option><option value="assistant">Assistant instructor</option></select></label>
      {role==='assistant' && <p role="alert" className="max-w-md text-sm text-(--amber-dark)">Ask the lead instructor to start this class, or select Lead instructor if you are replacing them. Your lead rate will apply.</p>}
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending || role==='assistant'}
        className="rounded-lg bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
      >
        {isPending ? 'Starting…' : 'Start Session'}
      </button>
      {error && <p role="alert" className="text-sm font-medium text-[#B91C1C]">{error}</p>}
    </div>
  )
}
