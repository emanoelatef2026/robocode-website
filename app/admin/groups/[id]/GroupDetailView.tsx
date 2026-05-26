'use client'

import { useActionState } from 'react'
import { updateGroup, deleteGroup, enrollStudent, unenrollStudent } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import type { Group, GroupEnrollment } from '@/modules/groups/types'
import type { StudentListItem } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

interface Props {
  group: Group
  enrollments: GroupEnrollment[]
  students: StudentListItem[]
}

const GROUP_STATUSES = ['forming', 'active', 'completed', 'cancelled'] as const

export default function GroupDetailView({ group, enrollments, students }: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateGroup, null)
  const [enrollState, enrollAction] = useActionState<ActionResult<void> | null, FormData>(enrollStudent, null)

  const enrolledIds = new Set(enrollments.filter((e) => e.status === 'active').map((e) => e.student_id))
  const available   = students.filter(
    (s) => s.branch_id === group.branch_id && !enrolledIds.has(s.id)
  )

  const handleDelete = async () => {
    if (!confirm('Delete this group? This cannot be undone.')) return
    await deleteGroup(group.id)
    window.location.href = '/admin/groups'
  }

  const handleUnenroll = async (studentId: string) => {
    if (!confirm('Remove this student from the group?')) return
    await unenrollStudent(group.id, studentId)
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      {/* Edit form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Group Settings</h2>

        {editState && !editState.success && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {editState.error.message}
          </div>
        )}

        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={group.id} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Name</label>
              <input
                name="name"
                defaultValue={group.name}
                required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Code</label>
              <input
                name="code"
                defaultValue={group.code ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Type</label>
              <select
                name="type"
                defaultValue={group.type}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              >
                {['class','workshop','bootcamp','trial','makeup'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
              <select
                name="status"
                defaultValue={group.status}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              >
                {GROUP_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Capacity</label>
              <input
                name="capacity"
                type="number"
                min={1}
                defaultValue={group.capacity ?? ''}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

      {/* Enrollments */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#0B1F3A]">
            Students ({enrollments.filter((e) => e.status === 'active').length}
            {group.capacity ? ` / ${group.capacity}` : ''})
          </h2>
        </div>

        {enrollState && !enrollState.success && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {enrollState.error.message}
          </div>
        )}

        {/* Enroll form */}
        {available.length > 0 && (
          <form action={enrollAction} className="mb-4 flex gap-2">
            <input type="hidden" name="group_id" value={group.id} />
            <select
              name="student_id"
              required
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Add student…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                </option>
              ))}
            </select>
            <SubmitButton label="Enroll" pendingLabel="…" />
          </form>
        )}

        {enrollments.filter((e) => e.status === 'active').length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No students enrolled yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {enrollments
              .filter((e) => e.status === 'active')
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#0B1F3A]">
                      {e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : e.student_email}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Joined {new Date(e.joined_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnenroll(e.student_id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="mb-1 text-sm font-medium text-red-700">Danger zone</h2>
        <p className="mb-3 text-xs text-red-600">This will soft-delete the group and cancel all enrollments.</p>
        <button
          onClick={handleDelete}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Delete group
        </button>
      </div>
    </div>
  )
}
