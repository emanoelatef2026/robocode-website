'use client'

import { useActionState } from 'react'
import { promoteSubmission } from '@/modules/portfolio/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'
import type { PromotableSubmission } from '@/modules/portfolio/types'

interface Props {
  studentId:   string
  submissions: PromotableSubmission[]
}

const inputClass = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function PromoteForm({ studentId, submissions }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    promoteSubmission,
    null
  )

  const available = submissions.filter((s) => !s.already_promoted)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      {available.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#64748B]">
          No eligible submissions found. Mark submissions as <em>portfolio visible</em> in the grading view.
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="student_id" value={studentId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Submission <span className="text-red-500">*</span>
            </label>
            <select name="submission_id" required className={inputClass}>
              <option value="">Select a submission…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.assignment_title}
                  {s.course_title ? ` — ${s.course_title}` : ''}
                  {s.final_score != null ? ` (${s.final_score})` : ''}
                  {' · '}
                  {new Date(s.submitted_at).toLocaleDateString('en-GB')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Project Title <span className="text-red-500">*</span>
            </label>
            <input name="title" required className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Description</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
              <input type="checkbox" name="is_featured" value="true" className="h-4 w-4 rounded border-[#E2E8F0]" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
              <input type="checkbox" name="is_public" value="true" className="h-4 w-4 rounded border-[#E2E8F0]" />
              Public
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
            <Link href={`/admin/portfolio/${studentId}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
              Cancel
            </Link>
            <SubmitButton label="Promote to Portfolio" pendingLabel="Promoting…" />
          </div>
        </form>
      )}
    </div>
  )
}
