'use client'

import { useActionState } from 'react'
import { createBranch } from '@/modules/branches/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

const TIMEZONES = [
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
]

export default function NewBranchPage() {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createBranch,
    null
  )

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/branches" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Branches
        </Link>
      </div>

      <div className="ds-card p-6">
        {state && !state.success && (
          <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
            {state.error.message}
          </div>
        )}

        <form action={action} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Branch name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              name="name"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              placeholder="e.g. Cairo Branch"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Type <span className="text-[#EF4444]">*</span>
            </label>
            <select
              name="type"
              required
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
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              placeholder="e.g. Nasr City, Cairo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input
              name="phone"
              type="tel"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              placeholder="e.g. +20 10 xxxx xxxx"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Timezone</label>
            <select
              name="timezone"
              defaultValue="Africa/Cairo"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/admin/branches"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
            >
              Cancel
            </Link>
            <SubmitButton label="Create Branch" pendingLabel="Creating…" />
          </div>
        </form>
      </div>
    </div>
  )
}
