'use client'

import { useActionState, useState } from 'react'
import { submitSessionFeedback } from '@/modules/feedback/actions'
import { FEEDBACK_QUESTIONS } from '@/modules/feedback/types'
import type { ActionResult } from '@/types/app'

interface Session {
  schedule_id:  string
  group_name:   string
  topic:        string | null
  scheduled_at: string
}

interface Props { sessions: Session[] }

function StarPicker({ name }: { name: string }) {
  const [val, setVal] = useState(0)
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setVal(v)}
          onMouseEnter={() => setHover(v)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
          aria-label={`${v} star${v > 1 ? 's' : ''}`}
        >
          {v <= (hover || val) ? '⭐' : '☆'}
        </button>
      ))}
      <input type="hidden" name={name} value={val} required />
    </div>
  )
}

export default function SessionFeedbackWidget({ sessions }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitted, setSubmitted]   = useState<Set<string>>(new Set())
  const [state, formAction, pending] = useActionState<ActionResult<void> | null, FormData>(
    async (prev, fd) => {
      const result = await submitSessionFeedback(prev, fd)
      if (result.success) {
        const schedId = fd.get('schedule_id') as string
        setSubmitted((s) => new Set([...s, schedId]))
        const nextPending = sessions.findIndex(
          (s, i) => i > currentIdx && !submitted.has(s.schedule_id)
        )
        if (nextPending >= 0) setCurrentIdx(nextPending)
      }
      return result
    },
    null
  )

  const remaining = sessions.filter((s) => !submitted.has(s.schedule_id))
  if (remaining.length === 0) return null

  const session = remaining[0]

  return (
    <div className="rounded-xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-5 space-y-4">
      <div>
        <p className="text-sm font-bold text-[#78350F]">Rate Your Session</p>
        <p className="text-xs text-[#B45309] mt-0.5">
          {session.topic
            ? session.topic
            : new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' · '}{session.group_name}
          {remaining.length > 1 && <span className="ml-2 text-[#F59E0B]">({remaining.length} sessions waiting)</span>}
        </p>
      </div>

      {state && !state.success && (
        <div className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">{state.error.message}</div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="schedule_id" value={session.schedule_id} />

        {FEEDBACK_QUESTIONS.map((q) => (
          <div key={q.key}>
            <p className="mb-0.5 text-sm font-medium text-[#78350F]">{q.english}</p>
            <p className="mb-1.5 text-[11px] text-[#B45309]" dir="rtl">{q.arabic}</p>
            <StarPicker name={`${q.key}_score`} />
          </div>
        ))}

        <div>
          <label className="mb-1 block text-xs font-medium text-[#92400E]">Comment (optional)</label>
          <textarea name="comment" rows={2} placeholder="Any thoughts about this session…"
            className="w-full rounded-lg border border-[#FDE68A] bg-white px-3 py-2 text-sm focus:border-[#F59E0B] focus:outline-none" />
        </div>

        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#D97706] py-2.5 text-sm font-semibold text-white hover:bg-[#B45309] disabled:opacity-60 transition">
          {pending ? 'Submitting…' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  )
}
