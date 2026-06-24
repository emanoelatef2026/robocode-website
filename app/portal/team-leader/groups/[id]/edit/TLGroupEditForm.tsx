'use client'

import { useActionState } from 'react'
import { updateGroup } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Group } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface Props { group: Group }

export default function TLGroupEditForm({ group }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    updateGroup,
    null
  )

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="id"         value={group.id} />
        <input type="hidden" name="_return_to" value={`/portal/team-leader/groups/${group.id}`} />

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Name <span className="text-[#EF4444]">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={group.name}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Type</label>
            <select
              name="type"
              defaultValue={group.type}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {['class', 'workshop', 'bootcamp', 'trial', 'makeup'].map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
            <select
              name="status"
              defaultValue={group.status}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {['forming', 'active', 'completed', 'cancelled'].map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Code</label>
            <div className="flex h-10.5 items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3">
              <span className="font-mono text-sm text-[#64748B]">{group.code ?? '—'}</span>
            </div>
            <p className="mt-1 text-[11px] text-[#94A3B8]">Auto-generated · cannot be changed</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Capacity</label>
            <input
              name="capacity"
              type="number"
              min="1"
              max="500"
              defaultValue={group.capacity ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/portal/team-leader/groups/${group.id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Save Changes" />
        </div>
      </form>
    </div>
  )
}
