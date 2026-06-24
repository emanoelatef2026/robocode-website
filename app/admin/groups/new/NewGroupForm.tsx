'use client'

import { useActionState } from 'react'
import { createGroup } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { BranchListItem } from '@/modules/branches/types'
import type { InstructorListItem } from '@/modules/instructors/types'
import type { ActionResult } from '@/types/app'

interface Props {
  branches:    BranchListItem[]
  instructors: InstructorListItem[]
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export default function NewGroupForm({ branches, instructors }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createGroup,
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
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Group name <span className="text-[#EF4444]">*</span>
          </label>
          <input name="name" required className={cls} placeholder="e.g. Robotics A1 — Spring 2026" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-[#EF4444]">*</span>
            </label>
            <select name="type" required defaultValue="class" className={cls}>
              <option value="class">Class</option>
              <option value="workshop">Workshop</option>
              <option value="bootcamp">Bootcamp</option>
              <option value="trial">Trial</option>
              <option value="makeup">Makeup</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Capacity</label>
            <input name="capacity" type="number" min={1} max={500} className={cls} placeholder="Unlimited" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Start date</label>
            <input name="start_date" type="date" className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Day of week</label>
            <select name="day_of_week" className={cls}>
              <option value="">—</option>
              {DAYS.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Time <span className="text-xs text-[#94A3B8]">(HH:MM)</span>
            </label>
            <input name="time" type="time" className={cls} placeholder="09:00" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Lead instructor</label>
            <select name="instructor_id" className={cls}>
              <option value="">— assign later —</option>
              {instructors.map(i => (
                <option key={i.id} value={i.id}>
                  {i.first_name && i.last_name ? `${i.first_name} ${i.last_name}` : i.user_email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
          <textarea name="notes" rows={2} className={cls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Robocode Share %
            <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">0–100 · default 100</span>
          </label>
          <input
            name="robocode_share_percent"
            type="number"
            min={0}
            max={100}
            step={0.01}
            defaultValue={100}
            className={cls}
          />
          <p className="mt-1 text-xs text-[#94A3B8]">
            % of collected revenue that belongs to Robocode. Standard groups: 100. Partnership groups: 30–60.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/admin/groups" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
            Cancel
          </Link>
          <SubmitButton label="Create Group" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
