'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createMakeupSession } from '@/modules/special-sessions/actions'
import type { ActionResult } from '@/types/app'

interface Props {
  branchId:     string
  instructorId: string
}

const INITIAL: ActionResult<{ sessionId: string }> = { success: false, error: { code: '', message: '' } }

export default function NewMakeupForm({ branchId, instructorId }: Props) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ sessionId: string }>, formData: FormData) => {
      const result = await createMakeupSession(_prev, formData)
      if (result.success && result.data) {
        router.push(`/portal/instructor/special-sessions/${result.data.sessionId}`)
      }
      return result
    },
    INITIAL
  )

  return (
    <form action={formAction} className="ds-card space-y-4 p-4">
      {!state.success && state.error?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error.message}</p>
      )}

      <input type="hidden" name="branch_id"     value={branchId} />
      <input type="hidden" name="instructor_id" value={instructorId} />

      <div>
        <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Date &amp; Time</label>
        <input
          type="datetime-local"
          name="scheduled_at"
          required
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Duration (minutes)</label>
        <input
          type="number"
          name="duration_minutes"
          defaultValue={60}
          min={15}
          max={480}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Notes (optional)</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="Any notes about this session"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#F59E0B] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#D97706] disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create Makeup Session'}
      </button>
    </form>
  )
}
