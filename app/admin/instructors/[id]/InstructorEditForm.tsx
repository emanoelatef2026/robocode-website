'use client'

import { useActionState } from 'react'
import { updateInstructor, deleteInstructor } from '@/modules/instructors/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Instructor } from '@/modules/instructors/types'
import type { ActionResult } from '@/types/app'

const STATUSES = ['active', 'inactive', 'on_leave'] as const

interface Props { instructor: Instructor }

export default function InstructorEditForm({ instructor }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    updateInstructor,
    null
  )

  const handleDelete = async () => {
    if (!confirm('Remove this instructor? This cannot be undone.')) return
    await deleteInstructor(instructor.id)
    window.location.href = '/admin/instructors'
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={instructor.id} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
          <select
            name="status"
            defaultValue={instructor.status}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Employee ID</label>
          <input
            name="employee_id"
            defaultValue={instructor.employee_id ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Specializations <span className="text-xs text-[#94A3B8]">(comma-separated)</span>
          </label>
          <input
            name="specializations"
            defaultValue={instructor.specializations.join(', ')}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Remove instructor
          </button>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/instructors"
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
