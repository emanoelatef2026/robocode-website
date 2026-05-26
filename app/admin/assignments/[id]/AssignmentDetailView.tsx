'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateAssignment, deleteAssignment } from '@/modules/assignments/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import type { Assignment, RubricCriteria } from '@/modules/assignments/types'
import type { SubmissionListItem } from '@/modules/assignments/submissions/types'
import type { ActionResult } from '@/types/app'

const TYPES = [
  'homework', 'classwork', 'project', 'quiz', 'exam', 'presentation', 'challenge', 'competition',
] as const

const SUBMISSION_TYPES = [
  { value: 'text',        label: 'Text' },
  { value: 'file',        label: 'File upload' },
  { value: 'image',       label: 'Image upload' },
  { value: 'video_link',  label: 'Video link' },
  { value: 'drive_link',  label: 'Google Drive' },
  { value: 'github_link', label: 'GitHub repo' },
  { value: 'url',         label: 'URL / website' },
  { value: 'multiple',    label: 'Multiple formats' },
]

function RubricBuilder({ initial }: { initial: RubricCriteria[] }) {
  const [criteria, setCriteria] = useState<RubricCriteria[]>(initial)

  const add = () => setCriteria((c) => [
    ...c,
    { id: crypto.randomUUID(), label: '', max_points: 10 },
  ])

  const remove = (id: string) => setCriteria((c) => c.filter((x) => x.id !== id))

  const update = (id: string, field: keyof RubricCriteria, value: string | number) =>
    setCriteria((c) => c.map((x) => x.id === id ? { ...x, [field]: value } : x))

  return (
    <div className="space-y-2">
      <input type="hidden" name="rubric" value={JSON.stringify(criteria)} />
      {criteria.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <input
            value={c.label}
            onChange={(e) => update(c.id, 'label', e.target.value)}
            placeholder="Criterion label…"
            className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
          />
          <input
            type="number"
            value={c.max_points}
            onChange={(e) => update(c.id, 'max_points', Number(e.target.value))}
            min="0"
            className="w-20 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
          />
          <span className="text-xs text-[#94A3B8]">pts</span>
          <button
            type="button"
            onClick={() => remove(c.id)}
            className="text-red-400 hover:text-red-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-[#FF8A1F] hover:underline"
      >
        + Add criterion
      </button>
    </div>
  )
}

interface Props {
  assignment: Assignment
  submissions: SubmissionListItem[]
}

export default function AssignmentDetailView({ assignment, submissions }: Props) {
  const router  = useRouter()
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(updateAssignment, null)

  useEffect(() => {
    if (state?.success) router.refresh()
  }, [state, router])

  const handleDelete = async () => {
    if (!confirm(`Archive assignment "${assignment.title}"? Students will no longer see it.`)) return
    const result = await deleteAssignment(assignment.id)
    if (result.success) router.push('/admin/assignments')
    else alert(result.error.message)
  }

  const dueValue = assignment.due_at
    ? new Date(assignment.due_at).toISOString().slice(0, 16)
    : ''

  return (
    <div className="space-y-5">
      {/* Edit form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Assignment Settings</h2>
        {state && !state.success && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error.message}
          </div>
        )}
        {state?.success && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Saved successfully.
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={assignment.id} />

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Title *</label>
            <input
              name="title"
              defaultValue={assignment.title}
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Type</label>
              <select
                name="type"
                defaultValue={assignment.type}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Submission type</label>
              <select
                name="submission_type"
                defaultValue={assignment.submission_type}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              >
                {SUBMISSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Max score</label>
              <input
                name="max_score"
                type="number"
                min="0"
                defaultValue={assignment.max_score}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Due date</label>
              <input
                name="due_at"
                type="datetime-local"
                defaultValue={dueValue}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={assignment.description ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Instructions</label>
            <textarea
              name="instructions"
              rows={5}
              defaultValue={assignment.instructions ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
            />
          </div>

          {/* Resubmission */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                <input
                  name="allow_late"
                  type="checkbox"
                  value="on"
                  defaultChecked={assignment.allow_late}
                  className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                />
                Allow late submissions
              </label>
              <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                <input
                  name="resubmission_allowed"
                  type="checkbox"
                  value="on"
                  defaultChecked={assignment.resubmission_allowed}
                  className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                />
                Allow resubmission
              </label>
              <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                <input
                  name="portfolio_eligible"
                  type="checkbox"
                  value="on"
                  defaultChecked={assignment.portfolio_eligible}
                  className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                />
                Portfolio eligible
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Max resubmissions</label>
              <input
                name="max_resubmissions"
                type="number"
                min="1"
                max="10"
                defaultValue={assignment.max_resubmissions}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
              />
            </div>
          </div>

          {/* Rubric */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[#64748B]">
              Grading rubric <span className="text-[#94A3B8]">(optional)</span>
            </label>
            <RubricBuilder initial={assignment.rubric} />
          </div>

          {/* Status + save */}
          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
            <select
              name="status"
              defaultValue={assignment.status}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
            <SubmitButton label="Save changes" pendingLabel="Saving…" />
          </div>
        </form>
      </div>

      {/* Submissions */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">
            Submissions
            <span className="ml-2 text-xs font-normal text-[#64748B]">({submissions.length})</span>
          </h2>
        </div>

        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#94A3B8]">No submissions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0B1F3A]">{s.student_name}</div>
                    <div className="text-xs text-[#94A3B8]">{s.student_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                    {s.is_late && (
                      <span className="ml-1 text-[10px] text-red-500">late</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {s.score !== null ? `${s.score} / ${assignment.max_score}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/assignments/${assignment.id}/submissions/${s.id}`}
                      className="text-xs font-medium text-[#FF8A1F] hover:underline"
                    >
                      Grade
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mb-3 text-xs text-[#64748B]">Archiving this assignment hides it from students. Existing submissions are preserved.</p>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Archive assignment
        </button>
      </div>
    </div>
  )
}
