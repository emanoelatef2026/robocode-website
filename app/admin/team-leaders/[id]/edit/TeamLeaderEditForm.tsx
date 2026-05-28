'use client'

import { useActionState } from 'react'
import { updateTeamLeader } from '@/modules/team-leaders/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { TeamLeader } from '@/modules/team-leaders/types'
import type { BranchListItem } from '@/modules/branches/types'
import type { ActionResult } from '@/types/app'

interface Props {
  tl:       TeamLeader
  branches: BranchListItem[]
}

export default function TeamLeaderEditForm({ tl, branches }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    updateTeamLeader,
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
        <input type="hidden" name="user_id" value={tl.user_id} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">First name</label>
            <input
              name="first_name"
              defaultValue={tl.first_name ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Last name</label>
            <input
              name="last_name"
              defaultValue={tl.last_name ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Branch</label>
          <select
            name="branch_id"
            defaultValue={tl.branch_id ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            <option value="">— no change —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
          <select
            name="status"
            defaultValue={tl.status}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            New password <span className="text-xs text-[#94A3B8]">(leave blank to keep current)</span>
          </label>
          <input
            name="new_password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/admin/team-leaders/${tl.user_id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Save Changes" pendingLabel="Saving…" />
        </div>
      </form>
    </div>
  )
}
