'use client'

import { useState, useTransition, useEffect } from 'react'
import { recordAttendanceSession } from '@/modules/attendance/actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import type { GroupDetailStudent } from '@/modules/groups/actions/types'

// ── Types ────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

type StudentIndicator = 'no_contract' | 'exhausted' | 'unpaid'

interface Props {
  group:     GroupOperationalRow
  students:  GroupDetailStudent[]
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────

function nowLocalDatetime(): string {
  const now = new Date()
  const pad  = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function getIndicators(s: GroupDetailStudent): StudentIndicator[] {
  const result: StudentIndicator[] = []
  if (!s.account_id || (s.sessions_total === null || s.sessions_total === 0)) {
    result.push('no_contract')
  }
  if (s.sessions_remaining !== null && s.sessions_remaining <= 0 && s.sessions_total && s.sessions_total > 0) {
    result.push('exhausted')
  }
  if (s.payment_status === 'OVERDUE' || s.payment_status === 'BLOCKED') {
    result.push('unpaid')
  }
  return result
}

// ── Status chip styles ────────────────────────────────────────────────

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800 border-green-200 ring-green-400',
  absent:  'bg-red-100 text-red-800 border-red-200 ring-red-400',
  late:    'bg-amber-100 text-amber-800 border-amber-200 ring-amber-400',
  excused: 'bg-blue-100 text-blue-800 border-blue-200 ring-blue-400',
  makeup:  'bg-purple-100 text-purple-800 border-purple-200 ring-purple-400',
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  excused: 'Excused',
  makeup:  'Makeup',
}

// ── Component ────────────────────────────────────────────────────────

export default function GroupAttendanceModal({ group, students, isOpen, onClose, onSuccess }: Props) {
  const [statuses, setStatuses]  = useState<Record<string, AttendanceStatus>>({})
  const [isPending, start]       = useTransition()
  const [error, setError]        = useState<string | null>(null)

  // Re-initialise statuses when modal opens or student list changes
  useEffect(() => {
    if (!isOpen) return
    const init: Record<string, AttendanceStatus> = {}
    for (const s of students) init[s.student_id] = 'present'
    setStatuses(init)
    setError(null)
  }, [isOpen, students])

  if (!isOpen) return null

  function setAllStatus(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {}
    for (const s of students) next[s.student_id] = status
    setStatuses(next)
  }

  function setOneStatus(studentId: string, status: AttendanceStatus) {
    setStatuses(prev => ({ ...prev, [studentId]: status }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const raw  = new FormData(e.currentTarget)
    const data = new FormData()

    data.set('group_id',         group.group_id)
    data.set('branch_id',        group.branch_id)
    data.set('session_date',     raw.get('session_date') as string)
    data.set('duration_minutes', raw.get('duration_minutes') as string)
    data.set('delivery',         raw.get('delivery') as string)

    for (const s of students) {
      data.append('student_ids[]', s.student_id)
      data.set(`status_${s.student_id}`, statuses[s.student_id] ?? 'present')
    }

    start(async () => {
      const result = await recordAttendanceSession(data)
      if (result.success) {
        onSuccess()
        onClose()
      } else {
        setError(result.error?.message ?? 'Failed to record attendance.')
      }
    })
  }

  const presentCount = Object.values(statuses).filter(s => s === 'present').length
  const absentCount  = Object.values(statuses).filter(s => s === 'absent').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="flex w-full sm:max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-[#0B1F3A]">Record Session</h3>
            <p className="mt-0.5 text-[12px] text-[#64748B]">{group.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {group.course_name && (
                <span className="text-[11px] text-[#94A3B8]">
                  Course: <span className="font-medium text-[#374151]">{group.course_name}</span>
                </span>
              )}
              {group.lead_instructor_name && (
                <span className="text-[11px] text-[#94A3B8]">
                  Instructor: <span className="font-medium text-[#374151]">{group.lead_instructor_name}</span>
                </span>
              )}
              <span className="text-[11px] text-[#94A3B8]">
                Branch: <span className="font-medium text-[#374151]">{group.branch_name}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#374151] transition"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Warning banner ── */}
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-2.5">
          <p className="text-[11px] text-amber-700">
            Attendance is permanent academic history. Record accurately — edits require admin intervention.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">

          {/* ── Session fields ── */}
          <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">Session Date & Time</label>
                <input
                  type="datetime-local"
                  name="session_date"
                  defaultValue={nowLocalDatetime()}
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">Duration (min)</label>
                <input
                  type="number"
                  name="duration_minutes"
                  min={15}
                  max={360}
                  defaultValue={group.duration_minutes ?? 60}
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">Delivery</label>
                <select
                  name="delivery"
                  defaultValue="offline"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                >
                  <option value="offline">In-Person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Bulk actions + student list ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Bulk actions bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-2 shrink-0">
              <span className="text-[11px] text-[#64748B]">
                {students.length} students — {presentCount} present · {absentCount} absent
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllStatus('present')}
                  className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 transition"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => setAllStatus('absent')}
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 transition"
                >
                  All Absent
                </button>
              </div>
            </div>

            {/* Student rows */}
            {students.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-[13px] text-[#94A3B8]">
                No active students in this group.
              </div>
            ) : (
              <ul className="divide-y divide-[#F1F5F9]">
                {students.map(s => {
                  const indicators = getIndicators(s)
                  const currentStatus = statuses[s.student_id] ?? 'present'
                  return (
                    <li key={s.student_id} className="flex items-center gap-3 px-5 py-2.5">
                      {/* Student name + indicators */}
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-[#0B1F3A] truncate">{s.student_name}</span>
                        <div className="flex flex-wrap gap-1">
                          {indicators.includes('no_contract') && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                              No Contract
                            </span>
                          )}
                          {indicators.includes('exhausted') && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                              Exhausted
                            </span>
                          )}
                          {indicators.includes('unpaid') && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 border border-red-200">
                              Unpaid
                            </span>
                          )}
                          {!indicators.includes('no_contract') && s.sessions_remaining !== null && s.sessions_remaining > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
                              {s.sessions_remaining} left
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status selector */}
                      <div className="flex gap-1 shrink-0">
                        {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setOneStatus(s.student_id, status)}
                            title={STATUS_LABELS[status]}
                            className={[
                              'rounded-md border px-2 py-1 text-[10px] font-semibold transition',
                              currentStatus === status
                                ? `${STATUS_STYLES[status]} ring-1`
                                : 'border-[#E2E8F0] bg-white text-[#94A3B8] hover:bg-[#F8FAFC]',
                            ].join(' ')}
                          >
                            {STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-[13px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || students.length === 0}
                className="flex-1 rounded-lg bg-[#FF8A1F] py-2.5 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50"
              >
                {isPending ? 'Saving…' : `Save Attendance (${students.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
