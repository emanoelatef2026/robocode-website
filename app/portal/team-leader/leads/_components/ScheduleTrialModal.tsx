'use client'

import { useActionState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { bulkBookTrialFromLeads } from '@/modules/special-sessions/actions'
import type { ActionResult } from '@/types/app'

interface Lead {
  id:   string
  name: string
}

interface Props {
  leads:       Lead[]
  instructors: { id: string; name: string }[]
  branches:    { id: string; name: string }[]
  defaultBranchId?: string
  isOpen:      boolean
  onClose:     () => void
}

const INITIAL: ActionResult<{ sessionId: string; attachedCount: number }> = {
  success: false,
  error: { code: '', message: '' },
}

export default function ScheduleTrialModal({
  leads, instructors, branches, defaultBranchId, isOpen, onClose,
}: Props) {
  const router    = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [state, formAction, pending] = useActionState(
    async (
      _prev: ActionResult<{ sessionId: string; attachedCount: number }>,
      formData: FormData
    ) => {
      formData.set('lead_ids', JSON.stringify(leads.map(l => l.id)))
      const result = await bulkBookTrialFromLeads(_prev, formData)
      if (result.success && result.data) {
        onClose()
        router.push(`/portal/team-leader/special-sessions/${result.data.sessionId}`)
      }
      return result
    },
    INITIAL
  )

  // Close on backdrop click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const now = new Date()
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
  const defaultDatetime = now.toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#0B1F3A]">Schedule Trial Session</h2>
            <p className="mt-0.5 text-[12px] text-[#64748B]">
              {leads.length === 1
                ? leads[0].name
                : `${leads.length} leads selected`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Selected leads chip list */}
        {leads.length > 1 && (
          <div className="flex flex-wrap gap-1.5 border-b border-[#E2E8F0] px-5 py-3">
            {leads.map(l => (
              <span
                key={l.id}
                className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700"
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {/* Form */}
        <form action={formAction} className="space-y-4 p-5">
          {!state.success && state.error?.message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {state.error.message}
            </p>
          )}

          {/* Branch */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#0B1F3A]">Branch</label>
            <select
              name="branch_id"
              required
              defaultValue={defaultBranchId ?? branches[0]?.id ?? ''}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Instructor */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#0B1F3A]">Instructor</label>
            {instructors.length === 0 ? (
              <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-700">
                No active instructors found for this branch.
              </p>
            ) : (
              <select
                name="instructor_id"
                required
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Select instructor…</option>
                {instructors.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#0B1F3A]">Date &amp; Time</label>
            <input
              type="datetime-local"
              name="scheduled_at"
              required
              defaultValue={defaultDatetime}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#0B1F3A]">Duration (minutes)</label>
            <input
              type="number"
              name="duration_minutes"
              defaultValue={60}
              min={15}
              max={480}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[#0B1F3A]">Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Course name, special instructions…"
              className="w-full resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <button
            type="submit"
            disabled={pending || instructors.length === 0}
            className="w-full rounded-lg bg-purple-600 py-2.5 text-[13px] font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
          >
            {pending ? 'Scheduling…' : `Create Trial Session${leads.length > 1 ? ` (${leads.length} leads)` : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}
