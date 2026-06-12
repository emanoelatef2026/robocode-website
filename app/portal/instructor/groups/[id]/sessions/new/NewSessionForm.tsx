'use client'

import { useActionState } from 'react'
import { createSession } from '@/modules/instructor-portal/actions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface Props {
  groupId:       string
  groupCourseId: string
  branchId:      string
}

export default function NewSessionForm({ groupId, groupCourseId, branchId }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createSession, null)

  useEffect(() => {
    if (state?.success) {
      router.push(`/portal/instructor/groups/${groupId}/sessions/${state.data.sessionId}`)
    }
  }, [state, router, groupId])

  // Default scheduled_at: now (session starts immediately)
  const now = new Date()
  const defaultVal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="group_course_id" value={groupCourseId} />
      <input type="hidden" name="branch_id"       value={branchId} />
      <input type="hidden" name="group_id"         value={groupId} />

      {state && !state.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">Date & Time</label>
        <input
          type="datetime-local"
          name="scheduled_at"
          required
          defaultValue={defaultVal}
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A]">Duration (minutes)</label>
          <input
            type="number"
            name="duration_minutes"
            defaultValue={90}
            min={15}
            max={480}
            required
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A]">Type</label>
          <select
            name="type"
            defaultValue="regular"
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          >
            <option value="regular">Regular</option>
            <option value="makeup">Makeup</option>
            <option value="exam">Exam</option>
            <option value="event">Event</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">Delivery</label>
        <select
          name="delivery"
          defaultValue="offline"
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        >
          <option value="offline">Offline</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">
          Topic <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="topic"
          required
          placeholder="e.g. Variables &amp; Loops"
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">Meeting URL (optional)</label>
        <input
          type="url"
          name="meeting_url"
          placeholder="https://meet.google.com/..."
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A]">Room (optional)</label>
        <input
          type="text"
          name="room"
          placeholder="e.g. Room 3A"
          className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
      >
        {pending ? 'Scheduling…' : 'Schedule Session'}
      </button>
    </form>
  )
}
