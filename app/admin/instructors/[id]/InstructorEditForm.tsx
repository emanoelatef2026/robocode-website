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

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  return (
    <div className="space-y-4">
      {/* Read-only badges */}
      {instructor.instructor_code && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
          <p className="text-xs text-[#94A3B8]">Instructor Code</p>
          <p className="mt-0.5 font-mono font-semibold text-[#0B1F3A]">{instructor.instructor_code}</p>
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        {state && !state.success && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error.message}
          </div>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={instructor.id} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
              <select name="status" defaultValue={instructor.status} className={cls}>
                {STATUSES.map(s => (
                  <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Employee ID</label>
              <input name="employee_id" defaultValue={instructor.employee_id ?? ''} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input name="phone" type="tel" defaultValue={instructor.phone ?? ''} className={cls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Specializations <span className="text-xs text-[#94A3B8]">(comma-separated)</span>
            </label>
            <input name="specializations" defaultValue={instructor.specializations.join(', ')} className={cls} />
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Payment Info</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Payment link</label>
                <input name="payment_link" defaultValue={instructor.payment_link ?? ''} className={cls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Wallet number</label>
                  <input name="wallet_number" defaultValue={instructor.wallet_number ?? ''} className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Bank account</label>
                  <input name="bank_account_number" defaultValue={instructor.bank_account_number ?? ''} className={cls} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete} className="text-sm font-medium text-red-500 hover:text-red-700">
              Remove instructor
            </button>
            <div className="flex items-center gap-3">
              <Link href="/admin/instructors" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
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
