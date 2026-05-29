'use client'

import { useActionState } from 'react'
import { updateTeamLeader } from '@/modules/team-leaders/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import PermissionsChecklist from '@/components/admin/PermissionsChecklist'
import Link from 'next/link'
import type { TeamLeader } from '@/modules/team-leaders/types'
import type { BranchListItem } from '@/modules/branches/types'
import type { ActionResult } from '@/types/app'

interface Props {
  tl:                 TeamLeader
  branches:           BranchListItem[]
  currentPermissions: string[]
}

const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function TeamLeaderEditForm({ tl, branches, currentPermissions }: Props) {
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
            <input name="first_name" defaultValue={tl.first_name ?? ''} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Last name</label>
            <input name="last_name" defaultValue={tl.last_name ?? ''} className={cls} />
          </div>
        </div>

        {/* Multi-branch selector — pre-checked with current assignments */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#0B1F3A]">
            Branches
            <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E2E8F0] p-3">
            {branches.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="branch_id"
                  value={b.id}
                  defaultChecked={tl.branch_ids.includes(b.id)}
                  className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF8A1F]"
                />
                <span className="text-sm text-[#0B1F3A]">{b.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
          <select name="status" defaultValue={tl.status} className={cls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
          <input name="phone" type="tel" defaultValue={tl.phone ?? ''} className={cls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            New password <span className="text-xs text-[#94A3B8]">(leave blank to keep current)</span>
          </label>
          <input name="new_password" type="password" autoComplete="new-password" placeholder="Minimum 6 characters" className={cls} />
        </div>

        <div className="border-t border-[#E2E8F0] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Payment Info</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Payment link</label>
              <input name="payment_link" defaultValue={tl.payment_link ?? ''} className={cls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Wallet number</label>
                <input name="wallet_number" defaultValue={tl.wallet_number ?? ''} className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Bank account</label>
                <input name="bank_account_number" defaultValue={tl.bank_account_number ?? ''} className={cls} />
              </div>
            </div>
          </div>
        </div>

        <PermissionsChecklist defaultPermissions={currentPermissions} />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/admin/team-leaders/${tl.user_id}`} className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
            Cancel
          </Link>
          <SubmitButton label="Save Changes" pendingLabel="Saving…" />
        </div>
      </form>
    </div>
  )
}
