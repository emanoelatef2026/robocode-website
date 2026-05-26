'use client'

import { useActionState } from 'react'
import { linkStudentToParent, deleteParent } from '@/modules/parents/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { Parent } from '@/modules/parents/types'
import type { StudentListItem } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

interface Props {
  parent: Parent
  students: StudentListItem[]
}

export default function ParentDetailView({ parent, students }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    linkStudentToParent,
    null
  )

  const handleDelete = async () => {
    if (!confirm('Delete this parent account? This cannot be undone.')) return
    await deleteParent(parent.id)
    window.location.href = '/admin/parents'
  }

  const linkedIds = new Set((parent.children ?? []).map((c) => c.student_id))
  const availableStudents = students.filter((s) => !linkedIds.has(s.id))

  return (
    <div className="space-y-4">
      {/* Children */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-[#0B1F3A]">Linked Children</h2>
        {parent.children && parent.children.length > 0 ? (
          <ul className="space-y-2">
            {parent.children.map((child) => (
              <li key={child.student_id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A]">
                    {child.student_first_name && child.student_last_name
                      ? `${child.student_first_name} ${child.student_last_name}`
                      : child.student_email}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {child.relationship} · {child.branch_name}
                    {child.is_primary && ' · Primary'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#94A3B8]">No children linked yet.</p>
        )}
      </div>

      {/* Link student */}
      {availableStudents.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-[#0B1F3A]">Link a Student</h2>

          {state && !state.success && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}

          <form action={action} className="space-y-3">
            <input type="hidden" name="parent_id" value={parent.id} />

            <select
              name="student_id"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Select student…</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                  {' '}({s.branch_name})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-3">
              <select
                name="relationship"
                defaultValue="guardian"
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              >
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </select>
              <SubmitButton label="Link" pendingLabel="Linking…" />
            </div>
          </form>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="mb-1 text-sm font-medium text-red-700">Danger zone</h2>
        <p className="mb-3 text-xs text-red-600">This will permanently delete the parent account and all links.</p>
        <button
          onClick={handleDelete}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete parent account
        </button>
      </div>
    </div>
  )
}
