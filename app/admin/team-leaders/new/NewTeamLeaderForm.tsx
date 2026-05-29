'use client'

import { useActionState } from 'react'
import { createTeamLeader } from '@/modules/team-leaders/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import PermissionsChecklist from '@/components/admin/PermissionsChecklist'
import Link from 'next/link'
import type { BranchListItem } from '@/modules/branches/types'
import type { ActionResult } from '@/types/app'
import { DEFAULT_CONFIGURABLE_PERMISSIONS } from '@/modules/rbac/permissions'

interface Props { branches: BranchListItem[] }

const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

export default function NewTeamLeaderForm({ branches }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createTeamLeader,
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              First name <span className="text-red-500">*</span>
            </label>
            <input name="first_name" required className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Last name <span className="text-red-500">*</span>
            </label>
            <input name="last_name" required className={cls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Email <span className="text-red-500">*</span>
          </label>
          <input name="email" type="email" required className={cls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Password <span className="text-red-500">*</span>
          </label>
          <input name="password" type="password" required autoComplete="new-password" placeholder="Minimum 6 characters" className={cls} />
        </div>

        {/* Multi-branch selector */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[#0B1F3A]">
            Branches <span className="text-red-500">*</span>
            <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E2E8F0] p-3">
            {branches.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="branch_id"
                  value={b.id}
                  className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF8A1F]"
                />
                <span className="text-sm text-[#0B1F3A]">{b.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
            <select name="status" defaultValue="active" className={cls}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input name="phone" type="tel" className={cls} placeholder="+20 …" />
          </div>
        </div>

        <div className="border-t border-[#E2E8F0] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Payment Info (optional)</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Payment link</label>
              <input name="payment_link" className={cls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Wallet number</label>
                <input name="wallet_number" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Bank account</label>
                <input name="bank_account_number" className={cls} />
              </div>
            </div>
          </div>
        </div>

        <PermissionsChecklist defaultPermissions={DEFAULT_CONFIGURABLE_PERMISSIONS.team_leader} />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/admin/team-leaders" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
            Cancel
          </Link>
          <SubmitButton label="Create Team Leader" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
