'use client'

import { useActionState } from 'react'
import { createSchedule } from '@/modules/schedule/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { ActionResult } from '@/types/app'

interface Props {
  groupId:       string
  groupCourseId: string
  branchId:      string
}

export default function TLNewSessionForm({ groupId, groupCourseId, branchId }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createSchedule,
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
        <input type="hidden" name="group_course_id" value={groupCourseId} />
        <input type="hidden" name="branch_id"       value={branchId} />
        <input type="hidden" name="_return_to"      value={`/portal/team-leader/groups/${groupId}`} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Date &amp; Time <span className="text-red-500">*</span>
            </label>
            <input
              name="scheduled_at"
              type="datetime-local"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              name="duration_minutes"
              type="number"
              min="15"
              max="480"
              defaultValue="60"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Type</label>
            <select
              name="type"
              defaultValue="regular"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              {['regular', 'makeup', 'exam', 'event'].map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Delivery</label>
            <select
              name="delivery"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Not specified</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Topic</label>
          <input
            name="topic"
            placeholder="What will be covered in this session?"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Room</label>
            <input
              name="room"
              placeholder="e.g. Room 3A"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Meeting URL</label>
            <input
              name="meeting_url"
              type="url"
              placeholder="https://meet.google.com/…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/portal/team-leader/groups/${groupId}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Schedule Session" pendingLabel="Scheduling…" />
        </div>
      </form>
    </div>
  )
}
