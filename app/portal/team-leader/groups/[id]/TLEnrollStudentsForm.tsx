'use client'

import { useActionState } from 'react'
import { enrollStudent, unenrollStudent } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { StudentListItem } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

interface Props {
  groupId:         string
  enrolledIds:     string[]
  availableStudents: StudentListItem[]
}

export default function TLEnrollStudentsForm({ groupId, enrolledIds, availableStudents }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    enrollStudent,
    null
  )

  const available = availableStudents.filter((s) => !enrolledIds.includes(s.id))

  if (available.length === 0) {
    return (
      <p className="text-sm text-[#64748B]">All branch students are already enrolled in this group.</p>
    )
  }

  return (
    <div className="space-y-3">
      {state && !state.success && (
        <div className="rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}
      <form action={action} className="flex gap-3">
        <input type="hidden" name="group_id" value={groupId} />
        <select
          name="student_id"
          required
          className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
        >
          <option value="">Select student…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.first_name && s.last_name
                ? `${s.first_name} ${s.last_name} (${s.user_email})`
                : s.user_email}
            </option>
          ))}
        </select>
        <SubmitButton label="Enroll" pendingLabel="Enrolling…" />
      </form>
    </div>
  )
}

interface UnenrollProps {
  groupId:   string
  studentId: string
  name:      string
}

export function UnenrollButton({ groupId, studentId, name }: UnenrollProps) {
  const handleClick = async () => {
    if (!confirm(`Remove ${name} from this group?`)) return
    await unenrollStudent(groupId, studentId)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs font-medium text-[#EF4444] hover:text-[#DC2626]"
    >
      Remove
    </button>
  )
}
