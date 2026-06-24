'use client'

import { useActionState } from 'react'
import { createStudent } from '@/modules/students/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { BranchListItem } from '@/modules/branches/types'
import type { GroupListItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface Props {
  branches: BranchListItem[]
  groups:   GroupListItem[]
}

export default function NewStudentForm({ branches, groups }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createStudent,
    null
  )

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              First name <span className="text-[#EF4444]">*</span>
            </label>
            <input name="first_name" required className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Last name <span className="text-[#EF4444]">*</span>
            </label>
            <input name="last_name" required className={cls} />
          </div>
        </div>

        {/* Email + password */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Email <span className="text-[#EF4444]">*</span>
          </label>
          <input name="email" type="email" required className={cls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Password <span className="text-[#EF4444]">*</span>
          </label>
          <input name="password" type="password" required autoComplete="new-password" placeholder="Minimum 6 characters" className={cls} />
        </div>

        {/* Branch + date_of_birth */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Branch <span className="text-[#EF4444]">*</span>
            </label>
            <select name="branch_id" required className={cls}>
              <option value="">Select branch…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Date of birth</label>
            <input name="date_of_birth" type="date" className={cls} />
          </div>
        </div>

        {/* School grade + address */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">School grade</label>
            <input name="school_grade" className={cls} placeholder="e.g. Grade 5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input name="phone" type="tel" className={cls} placeholder="+20 …" />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Address <span className="text-xs text-[#94A3B8]">(optional)</span></label>
          <input name="address" className={cls} />
        </div>

        {/* Parent phones */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 1</label>
            <input name="parent_phone_1" type="tel" className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 2</label>
            <input name="parent_phone_2" type="tel" className={cls} />
          </div>
        </div>

        {/* Enrollment date + group */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Enrollment date</label>
            <input
              name="enrollment_date"
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className={cls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Assign to group</label>
            <select name="group_id" className={cls}>
              <option value="">— skip —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
          <textarea name="notes" rows={2} className={cls} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/admin/students" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
            Cancel
          </Link>
          <SubmitButton label="Enroll Student" pendingLabel="Enrolling…" />
        </div>
      </form>
    </div>
  )
}
