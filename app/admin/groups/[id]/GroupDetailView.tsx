'use client'

import { useActionState } from 'react'
import { updateGroup, deleteGroup } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Group } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface Props { group: Group }

// 'active' is intentionally excluded — status is auto-managed by syncGroupStatus()
// based on whether course+semester+instructor are all assigned.
// Admins use the Academic Configuration card to activate a group.
const GROUP_STATUSES = ['forming', 'completed', 'cancelled'] as const

export default function GroupDetailView({ group }: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateGroup, null)

  const handleDelete = async () => {
    if (!confirm('Delete this group? This cannot be undone.')) return
    await deleteGroup(group.id)
    window.location.href = '/admin/groups'
  }

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  return (
    <div className="space-y-5">
      {/* Group Settings */}
      <div className="ds-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Group Settings</h2>

        {editState && !editState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
            {editState.error.message}
          </div>
        )}
        {editState?.success && (
          <div className="mb-3 rounded-lg bg-[#E7F8EE] px-3 py-2 text-sm text-[#15803D]">
            Changes saved.
          </div>
        )}

        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={group.id} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Name</label>
              <input name="name" defaultValue={group.name} required className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Code</label>
              <input name="code" defaultValue={group.code ?? ''} className={cls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Type</label>
              <select name="type" defaultValue={group.type} className={cls}>
                {['class','workshop','bootcamp','trial','makeup'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Status</label>
              <select name="status" defaultValue={group.status} className={cls}>
                {GROUP_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Capacity</label>
              <input name="capacity" type="number" min={1} defaultValue={group.capacity ?? ''} className={cls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Start date</label>
              <input name="start_date" type="date" defaultValue={group.start_date ?? ''} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Day</label>
              <select name="day_of_week" defaultValue={group.day_of_week ?? ''} className={cls}>
                <option value="">—</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((d) => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">
                Time <span className="font-normal text-[#94A3B8]">(HH:MM)</span>
              </label>
              <input name="time" type="time" defaultValue={group.time ?? ''} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Notes</label>
            <textarea name="notes" rows={2} defaultValue={group.notes ?? ''} className={cls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">
              Robocode Share %
              <span className="ml-1.5 font-normal text-[#94A3B8]">0–100 · default 100</span>
            </label>
            <input
              name="robocode_share_percent"
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={group.robocode_share_percent ?? 100}
              className={cls}
            />
            <p className="mt-1 text-xs text-[#94A3B8]">
              % of collected revenue that belongs to Robocode. Standard groups: 100. Partnership groups: 30–60.
            </p>
          </div>

          <div className="flex justify-end">
            <SubmitButton label="Save Changes" />
          </div>
        </form>
      </div>

      {/* Edit in full view */}
      <div className="ds-card p-4">
        <Link
          href={`/admin/groups/${group.id}/edit`}
          className="text-sm font-medium text-[#FF8A1F] hover:underline"
        >
          Full edit view →
        </Link>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] p-5">
        <h2 className="mb-1 text-sm font-semibold text-[#DC2626]">Danger zone</h2>
        <p className="mb-3 text-xs text-[#EF4444]">Soft-deletes the group and cancels all enrollments.</p>
        <button
          onClick={handleDelete}
          className="rounded-lg border border-[#FECACA] bg-white px-4 py-2 text-sm font-medium text-[#EF4444] transition hover:bg-[#FEE2E2]"
        >
          Delete group
        </button>
      </div>
    </div>
  )
}
