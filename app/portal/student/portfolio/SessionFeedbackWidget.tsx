'use client'

import { useActionState } from 'react'
import { submitSessionFeedback } from '@/modules/feedback/actions'
import { FEEDBACK_QUESTIONS } from '@/modules/feedback/types'
import type { ActionResult } from '@/types/app'

interface Session {
  schedule_id:  string
  group_name:   string
  topic:        string | null
  scheduled_at: string
}

interface Props {
  sessions: Session[]
}

function StarRating({ name }: { name: string }) {
  return (
    <div className="flex gap-1" role="group">
      {[1, 2, 3, 4, 5].map((v) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} required className="sr-only peer" />
          <span className="text-2xl peer-checked:[&~span]:text-yellow-300 select-none transition hover:scale-110">⭐</span>
        </label>
      ))}
    </div>
  )
}

export default function SessionFeedbackWidget({ sessions }: Props) {
  const [idx, setIdx] = useActionState<number, number>((_, n) => n, 0)
  const [state, formAction, pending] = useActionState<ActionResult<void> | null, FormData>(
    submitSessionFeedback,
    null
  )

  if (sessions.length === 0) return null
  const session = sessions[idx] ?? sessions[0]
  if (!session) return null

  if (state?.success) {
    const next = idx + 1
    if (next < sessions.length) {
      return (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] p-4">
          <p className="text-sm font-semibold text-[#065F46]">Thank you for your feedback!</p>
          {next < sessions.length && (
            <button
              onClick={() => setIdx(next)}
              className="mt-2 text-sm text-[#15803D] underline"
            >
              Rate another session →
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] p-4 text-center">
        <p className="text-sm font-semibold text-[#065F46]">✓ All feedback submitted. Thank you!</p>
      </div>
    )
  }

  return (
    <div className="ds-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0B1F3A]">Rate Your Session</p>
          <p className="text-xs text-[#64748B]">
            {session.topic ?? new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' · '}{session.group_name}
          </p>
        </div>
        {sessions.length > 1 && (
          <span className="text-xs text-[#94A3B8]">{idx + 1}/{sessions.length}</span>
        )}
      </div>

      {state && !state.success && (
        <div className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">{state.error.message}</div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="schedule_id" value={session.schedule_id} />

        {FEEDBACK_QUESTIONS.map((q, i) => (
          <div key={q.key}>
            <p className="mb-1 text-sm font-medium text-[#0B1F3A]">{q.english}</p>
            <p className="mb-2 text-xs text-[#94A3B8]">{q.arabic}</p>
            <StarRating name={`${q.key}_score`} />
          </div>
        ))}

        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Comment (optional)</label>
          <textarea name="comment" rows={2} placeholder="Any additional thoughts…"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none" />
        </div>

        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition">
          {pending ? 'Submitting…' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  )
}
