'use client'

import { useActionState } from 'react'
import { createGroup } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

interface Props { branchId: string }

export default function TLNewGroupForm({ branchId }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createGroup,
    null
  )

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="branch_id"  value={branchId} />
        <input type="hidden" name="_return_to" value="/portal/team-leader/groups" />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Group name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            placeholder="e.g. Scratch Beginners A"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            name="type"
            defaultValue="class"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            {['class', 'workshop', 'bootcamp', 'trial', 'makeup'].map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Capacity</label>
          <input
            name="capacity"
            type="number"
            min="1"
            max="500"
            placeholder="Leave blank for unlimited"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/portal/team-leader/groups"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Create Group" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
