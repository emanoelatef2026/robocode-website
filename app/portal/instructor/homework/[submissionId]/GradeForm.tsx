'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { gradeSubmission } from '@/modules/assignments/submissions/actions'
import type { Submission } from '@/modules/assignments/submissions/types'

interface Props {
  submission:       Submission
  nextSubmissionId?: string
}

const STATUSES = [
  { value: 'graded',                   label: 'Graded' },
  { value: 'returned',                 label: 'Returned' },
  { value: 'resubmission_requested',   label: 'Request Resubmission' },
  { value: 'under_review',             label: 'Under Review' },
] as const

export default function GradeForm({ submission, nextSubmissionId }: Props) {
  const [state, action, pending] = useActionState(gradeSubmission, null)
  const router = useRouter()
  const advancing = !!state?.success

  useEffect(() => {
    if (!advancing) return
    const t = setTimeout(() => {
      router.push(
        nextSubmissionId
          ? `/portal/instructor/homework/${nextSubmissionId}`
          : '/portal/instructor/homework'
      )
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancing])

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="submission_id"  value={submission.id} />
      <input type="hidden" name="assignment_id"  value={submission.assignment_id} />

      {state && !state.success && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-4 py-3 text-sm text-[#15803D]">
          Grade saved. {nextSubmissionId ? 'Moving to the next pending submission…' : 'Back to Homework Review…'}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">Status</label>
        <select
          name="status"
          defaultValue={submission.status ?? 'graded'}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        >
          {STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">
          Score{' '}
          <span className="font-normal text-[#94A3B8]">(max {submission.assignment_title ? '' : ''})</span>
        </label>
        <input
          type="number"
          name="score"
          defaultValue={submission.score ?? ''}
          min={0}
          step={0.5}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          placeholder="Leave blank for no score"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">
          Feedback{' '}
          <span className="font-normal text-[#94A3B8]">(visible to student)</span>
        </label>
        <textarea
          name="feedback"
          defaultValue={submission.feedback ?? ''}
          rows={4}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          placeholder="Write your feedback here…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">
          Public Feedback{' '}
          <span className="font-normal text-[#94A3B8]">(visible to parents)</span>
        </label>
        <textarea
          name="public_feedback"
          defaultValue={submission.public_feedback ?? ''}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          placeholder="Optional short summary for parents…"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="portfolio_visible"
          id="portfolio_visible"
          value="true"
          defaultChecked={submission.portfolio_visible}
          className="accent-[#FF8A1F]"
        />
        <label htmlFor="portfolio_visible" className="text-sm text-[#0B1F3A]">
          Show in student portfolio
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || advancing}
        className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
      >
        {pending ? 'Saving…' : advancing ? 'Saved ✓' : 'Save Grade'}
      </button>
    </form>
  )
}
