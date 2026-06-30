'use client'

import { useState, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createTrialSession, createMakeupSession } from '@/modules/special-sessions/actions'
import type { ActionResult } from '@/types/app'

interface Branch      { id: string; name: string }
interface InstructorOpt { id: string; branch_ids: string[]; name: string }

interface Props {
  branches:     Branch[]
  instructors:  InstructorOpt[]
  defaultType?: 'trial' | 'makeup'
}

const INITIAL: ActionResult<{ sessionId: string }> = { success: false, error: { code: '', message: '' } }

export default function NewSpecialSessionForm({ branches, instructors, defaultType = 'trial' }: Props) {
  const router = useRouter()
  const [sessionType, setSessionType] = useState<'trial' | 'makeup'>(defaultType)
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id ?? '')

  const filteredInstructors = instructors.filter(i => i.branch_ids.includes(selectedBranch))

  const action = sessionType === 'trial' ? createTrialSession : createMakeupSession

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ sessionId: string }>, formData: FormData) => {
      const result = await action(_prev, formData)
      if (result.success && result.data) {
        router.push(`/portal/team-leader/special-sessions/${result.data.sessionId}`)
      }
      return result
    },
    INITIAL
  )

  return (
    <div className="ds-card p-4 space-y-4">

      {/* Type selector */}
      <div>
        <p className="text-[12px] font-semibold text-[#0B1F3A] mb-2">Session Type</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSessionType('trial')}
            className={`flex-1 rounded-lg border py-2 text-[13px] font-semibold transition ${
              sessionType === 'trial'
                ? 'border-[#A855F7] bg-purple-50 text-purple-700'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#A855F7]'
            }`}
          >
            🟣 Trial Session
          </button>
          <button
            type="button"
            onClick={() => setSessionType('makeup')}
            className={`flex-1 rounded-lg border py-2 text-[13px] font-semibold transition ${
              sessionType === 'makeup'
                ? 'border-[#F59E0B] bg-orange-50 text-orange-700'
                : 'border-[#E2E8F0] text-[#64748B] hover:border-[#F59E0B]'
            }`}
          >
            🟠 Makeup Session
          </button>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        {!state.success && state.error?.message && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error.message}</p>
        )}

        {/* Branch */}
        <div>
          <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Branch</label>
          {branches.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
              No branches assigned to your account. Contact a super admin.
            </p>
          ) : (
            <select
              name="branch_id"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>

        {/* Instructor */}
        <div>
          <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Instructor</label>
          <select
            name="instructor_id"
            required
            disabled={filteredInstructors.length === 0}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
          >
            {filteredInstructors.length === 0 ? (
              <option value="">No instructors in this branch</option>
            ) : (
              filteredInstructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)
            )}
          </select>
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Date &amp; Time</label>
          <input
            type="datetime-local"
            name="scheduled_at"
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Duration (minutes)</label>
          <input
            type="number"
            name="duration_minutes"
            defaultValue={60}
            min={15}
            max={480}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        {/* Trial-only: Course Name */}
        {sessionType === 'trial' && (
          <div>
            <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Course (optional)</label>
            <input
              type="text"
              name="course_name"
              placeholder="e.g. Python for Kids"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-[12px] font-semibold text-[#0B1F3A] mb-1">Notes (optional)</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>

        <button
          type="submit"
          disabled={pending || filteredInstructors.length === 0 || branches.length === 0}
          className="w-full rounded-lg bg-[#A855F7] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#9333EA] disabled:opacity-60"
        >
          {pending ? 'Creating…' : `Create ${sessionType === 'trial' ? 'Trial' : 'Makeup'} Session`}
        </button>
      </form>
    </div>
  )
}
