'use client'

import { useActionState } from 'react'
import { updateBranch, deleteBranch } from '@/modules/branches/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Branch } from '@/modules/branches/types'
import type { ActionResult } from '@/types/app'

const TIMEZONES = [
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
]

interface Props {
  branch: Branch
}

export default function BranchEditForm({ branch }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    updateBranch,
    null
  )

  const handleDelete = async () => {
    if (!confirm('Delete this branch? This action cannot be undone.')) return
    await deleteBranch(branch.id)
    window.location.href = '/admin/branches'
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={branch.id} />
        <input type="hidden" name="is_active" value={branch.is_active ? 'true' : 'false'} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Branch name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={branch.name}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            name="type"
            required
            defaultValue={branch.type}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Location</label>
          <input
            name="location"
            defaultValue={branch.location ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
          <input
            name="phone"
            type="tel"
            defaultValue={branch.phone ?? ''}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Timezone</label>
          <select
            name="timezone"
            defaultValue={branch.timezone}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm font-medium text-red-500 hover:text-red-700"
          >
            Delete branch
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/branches"
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
