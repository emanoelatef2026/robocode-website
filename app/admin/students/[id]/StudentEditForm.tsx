'use client'

import { useActionState } from 'react'
import { updateStudent, deleteStudent } from '@/modules/students/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Student } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'paused', 'banned'] as const

interface Props { student: Student }

function age(dob: string | null | undefined): number | null {
  if (!dob) return null
  const b   = new Date(dob)
  const now = new Date()
  let a     = now.getFullYear() - b.getFullYear()
  const m   = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}

export default function StudentEditForm({ student }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(updateStudent, null)

  const handleDelete = async () => {
    if (!confirm('Remove this student? This cannot be undone.')) return
    await deleteStudent(student.id)
    window.location.href = '/admin/students'
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'
  const studentAge = age(student.date_of_birth)

  return (
    <div className="space-y-4">
      {/* Read-only info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#94A3B8]">Student Code</p>
            <p className="mt-0.5 font-mono font-medium text-[#0B1F3A]">{student.student_code ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Age</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">
              {studentAge != null ? `${studentAge} years` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Group</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">{student.group_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Enrolled</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">
              {new Date(student.enrollment_date).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        {state && !state.success && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error.message}
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={student.id} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
              <select name="status" defaultValue={student.status} className={cls}>
                {STUDENT_STATUSES.map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Date of birth</label>
              <input name="date_of_birth" type="date" defaultValue={student.date_of_birth ?? ''} className={cls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">School grade</label>
              <input name="school_grade" defaultValue={student.school_grade ?? ''} className={cls} placeholder="e.g. Grade 5" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
              <input name="phone" type="tel" defaultValue={student.phone ?? ''} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Address</label>
            <input name="address" defaultValue={student.address ?? ''} className={cls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 1</label>
              <input name="parent_phone_1" type="tel" defaultValue={student.parent_phone_1 ?? ''} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 2</label>
              <input name="parent_phone_2" type="tel" defaultValue={student.parent_phone_2 ?? ''} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
            <textarea name="notes" rows={3} defaultValue={student.notes ?? ''} className={cls} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete} className="text-sm font-medium text-red-500 hover:text-red-700">
              Remove student
            </button>
            <div className="flex items-center gap-3">
              <Link href="/admin/students" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
                Cancel
              </Link>
              <SubmitButton label="Save Changes" />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
