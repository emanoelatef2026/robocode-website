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
            <input
              name="first_name"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              name="last_name"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              name="branch_id"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
            <select
              name="status"
              defaultValue="active"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
          <input
            name="phone"
            type="tel"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            placeholder="+20 …"
          />
        </div>

        <div className="border-t border-[#E2E8F0] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Payment Info (optional)</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Payment link</label>
              <input name="payment_link" className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Wallet number</label>
                <input name="wallet_number" className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Bank account</label>
                <input name="bank_account_number" className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
              </div>
            </div>
          </div>
        </div>

        {/* Permissions — pre-checked with all TL defaults */}
        <PermissionsChecklist defaultPermissions={DEFAULT_CONFIGURABLE_PERMISSIONS.team_leader} />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/team-leaders"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Create Team Leader" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}
