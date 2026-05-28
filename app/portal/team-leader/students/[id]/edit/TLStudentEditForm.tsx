'use client'

import { useActionState } from 'react'
import { updateStudent, deleteStudent } from '@/modules/students/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Student } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'paused', 'banned'] as const

interface Props { student: Student }

export default function TLStudentEditForm({ student }: Props) {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    updateStudent,
    null
  )

  const handleDelete = async () => {
    if (!confirm('Remove this student? This cannot be undone.')) return
    await deleteStudent(student.id)
    router.push('/portal/team-leader/students')
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="id"         value={student.id} />
        <input type="hidden" name="_return_to" value={`/portal/team-leader/students/${student.id}`} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
          <select
            name="status"
            defaultValue={student.status}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            {STUDENT_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Student code</label>
          <input
            name="student_code"
            defaultValue={student.student_code ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={(student as any).notes ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Remove student
          </button>
          <div className="flex items-center gap-3">
            <Link
              href={`/portal/team-leader/students/${student.id}`}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
            >
              Cancel
            </Link>
            <SubmitButton label="Save Changes" />
          </div>
        </div>
      </form>
    </div>
  )
}
