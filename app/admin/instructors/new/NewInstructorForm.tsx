'use client'

import { useActionState, useState } from 'react'
import { createInstructor } from '@/modules/instructors/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import PermissionsChecklist from '@/components/admin/PermissionsChecklist'
import Link from 'next/link'
import type { BranchListItem } from '@/modules/branches/types'
import type { GroupListItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'
import { DEFAULT_CONFIGURABLE_PERMISSIONS } from '@/modules/rbac/permissions'

interface Props {
  branches: BranchListItem[]
  groups:   GroupListItem[]
}

export default function NewInstructorForm({ branches, groups }: Props) {
  const [state,       action]       = useActionState<ActionResult<{ id: string }> | null, FormData>(createInstructor, null)
  const [branchId,    setBranchId]  = useState('')
  const [selectedGrp, setSelectedGrp] = useState<Set<string>>(new Set())

  // Groups that belong to the currently selected branch
  const branchGroups = groups.filter((g) => g.branch_id === branchId && g.status === 'active')

  const toggleGroup = (id: string) => {
    setSelectedGrp((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
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
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
            className={cls}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Branch <span className="text-[#EF4444]">*</span>
          </label>
          <select
            name="branch_id"
            required
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setSelectedGrp(new Set()) }}
            className={cls}
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Employee ID</label>
            <input name="employee_id" className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Hire date</label>
            <input name="hire_date" type="date" className={cls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
          <input name="phone" type="tel" className={cls} placeholder="+20 …" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Specializations <span className="text-xs text-[#94A3B8]">(comma-separated)</span>
          </label>
          <input name="specializations" className={cls} placeholder="e.g. Robotics, Python, Electronics" />
        </div>

        {/* Group assignment */}
        {branchId && (
          <div>
            <p className="mb-2 text-sm font-medium text-[#0B1F3A]">
              Assign to Groups
              <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">(optional)</span>
            </p>
            {branchGroups.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No active groups in this branch.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                {branchGroups.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[#F8FAFC]">
                    <input
                      type="checkbox"
                      name="group_ids"
                      value={g.id}
                      checked={selectedGrp.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded border-[#CBD5E1] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                    />
                    <span className="text-sm text-[#0B1F3A]">
                      {g.name}
                      {g.code && <span className="ml-1.5 font-mono text-xs text-[#94A3B8]">{g.code}</span>}
                    </span>
                    <span className="ml-auto text-xs text-[#94A3B8] capitalize">{g.type}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Permissions */}
        <PermissionsChecklist defaultPermissions={DEFAULT_CONFIGURABLE_PERMISSIONS.instructor} />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/instructors"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Add Instructor" pendingLabel="Adding…" />
        </div>
      </form>
    </div>
  )
}
