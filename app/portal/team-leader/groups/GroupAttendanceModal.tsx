'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { recordAttendanceSession } from '@/modules/attendance/actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import type { GroupDetailStudent } from '@/modules/groups/actions/types'
import type { StudentConsumptionResult } from '@/modules/academic/contract-consumption'

// ── Types ──────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

interface Props {
  group:     GroupOperationalRow
  students:  GroupDetailStudent[]
  isOpen:    boolean
  onClose:   () => void
  onSuccess: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nowLocalDatetime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

// Per-student indicators derived from enrollment data vs. selected session date
function getStudentIndicators(s: GroupDetailStudent, sessionDateStr: string) {
  const noContract   = !s.enrollment_id
  const sessionsLeft = s.sessions_remaining

  const preEnrollment =
    !noContract &&
    s.enrollment_start_date != null &&
    sessionDateStr.slice(0, 10) < s.enrollment_start_date.slice(0, 10)

  const eligibleFrom = preEnrollment ? s.enrollment_start_date : null

  const exhausted =
    !noContract &&
    !preEnrollment &&
    sessionsLeft !== null &&
    sessionsLeft <= 0

  const unpaid =
    s.payment_status === 'OVERDUE' || s.payment_status === 'BLOCKED'

  return { noContract, preEnrollment, eligibleFrom, exhausted, unpaid, sessionsLeft }
}

// ── Consumption result label ───────────────────────────────────────────────────

function ConsumptionReasonLabel({ r }: { r: StudentConsumptionResult }) {
  switch (r.reason) {
    case 'eligible':
      return (
        <span className="text-[10px] text-green-700 font-medium">
          1 session consumed · {r.sessions_remaining ?? 0} remaining
        </span>
      )
    case 'overdraft_allowed':
      return (
        <span className="text-[10px] text-amber-700 font-medium">
          1 session (overdraft) · {r.sessions_remaining ?? 0} remaining
        </span>
      )
    case 'no_slot_status':
      return (
        <span className="text-[10px] text-[#94A3B8]">
          Not slot-consuming — no session deducted
        </span>
      )
    case 'no_contract':
      return (
        <span className="text-[10px] text-gray-500">
          No active contract — attendance recorded only
        </span>
      )
    case 'pre_enrollment':
      return (
        <span className="text-[10px] text-blue-600">
          Pre-contract session — eligible from {r.enrollment_start_date ? fmtDate(r.enrollment_start_date) : '—'}
        </span>
      )
    case 'exhausted':
      return (
        <span className="text-[10px] text-orange-600">
          Package exhausted — no session deducted
        </span>
      )
    case 'open_ended':
      return (
        <span className="text-[10px] text-[#94A3B8]">
          Open-ended group — sessions not tracked
        </span>
      )
    default:
      return null
  }
}

// ── Status chip styles ─────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

export default function GroupAttendanceModal({ group, students, isOpen, onClose, onSuccess }: Props) {
  const [statuses,    setStatuses]    = useState<Record<string, AttendanceStatus>>({})
  const [topic,       setTopic]       = useState('')
  const [sessionDate, setSessionDate] = useState(nowLocalDatetime())
  const [isPending,   start]          = useTransition()
  const [error,       setError]       = useState<string | null>(null)
  const [results,     setResults]     = useState<StudentConsumptionResult[] | null>(null)
  const durationRef = useRef<HTMLInputElement>(null)
  const deliveryRef = useRef<HTMLSelectElement>(null)

  // Re-initialise when modal opens or student list changes
  useEffect(() => {
    if (!isOpen) return
    const init: Record<string, AttendanceStatus> = {}
    for (const s of students) init[s.student_id] = 'present'
    setStatuses(init)
    setTopic('')
    setSessionDate(nowLocalDatetime())
    setError(null)
    setResults(null)
  }, [isOpen, students])

  if (!isOpen) return null

  function setAllStatus(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {}
    for (const s of students) next[s.student_id] = status
    setStatuses(next)
  }

  function setOneStatus(sid: string, status: AttendanceStatus) {
    setStatuses(prev => ({ ...prev, [sid]: status }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const data = new FormData()
    data.set('group_id',         group.group_id)
    data.set('branch_id',        group.branch_id)
    data.set('session_date',     sessionDate)
    data.set('duration_minutes', durationRef.current?.value ?? '60')
    data.set('delivery',         deliveryRef.current?.value ?? 'offline')
    data.set('topic',            topic.trim())

    for (const s of students) {
      data.append('student_ids[]', s.student_id)
      data.set(`status_${s.student_id}`, statuses[s.student_id] ?? 'present')
    }

    start(async () => {
      const result = await recordAttendanceSession(data)
      if (result.success) {
        setResults(result.data.consumptionResults)
      } else {
        setError(result.error?.message ?? 'Failed to record attendance.')
      }
    })
  }

  function handleDone() {
    onSuccess()
    onClose()
  }

  // ── Results screen ─────────────────────────────────────────────────────────

  if (results !== null) {
    const consumedCount    = results.filter(r => r.consumed).length
    const noContractCount  = results.filter(r => r.reason === 'no_contract').length
    const preEnrollCount   = results.filter(r => r.reason === 'pre_enrollment').length
    const exhaustedCount   = results.filter(r => r.reason === 'exhausted').length

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <div className="flex w-full sm:max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[92vh]">

          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
            <div>
              <h3 className="text-[15px] font-bold text-[#0B1F3A]">Session Saved</h3>
              <p className="mt-0.5 text-[12px] text-[#64748B]">
                {group.name}
                {topic ? ` — ${topic}` : ''}
              </p>
            </div>
            <button
              onClick={handleDone}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#374151] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Summary strip */}
          <div className="shrink-0 border-b border-green-100 bg-green-50 px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[12px] text-green-700 font-semibold">
              {consumedCount} session{consumedCount !== 1 ? 's' : ''} consumed
            </span>
            {noContractCount > 0 && (
              <span className="text-[12px] text-gray-500">{noContractCount} no contract</span>
            )}
            {preEnrollCount > 0 && (
              <span className="text-[12px] text-blue-600">{preEnrollCount} pre-contract</span>
            )}
            {exhaustedCount > 0 && (
              <span className="text-[12px] text-orange-600">{exhaustedCount} exhausted</span>
            )}
          </div>

          {/* Per-student results */}
          <div className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-[#F1F5F9]">
              {results.map(r => {
                const student = students.find(s => s.student_id === r.student_id)
                const isConsumed = r.consumed
                return (
                  <li key={r.student_id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={[
                          'h-2 w-2 rounded-full shrink-0',
                          isConsumed        ? 'bg-green-500' :
                          r.reason === 'pre_enrollment' ? 'bg-blue-400' :
                          r.reason === 'exhausted'      ? 'bg-orange-400' :
                          'bg-gray-300',
                        ].join(' ')}
                      />
                      <span className="text-[13px] font-medium text-[#0B1F3A] truncate">
                        {student?.student_name ?? r.student_id}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <ConsumptionReasonLabel r={r} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Done */}
          <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
            <button
              onClick={handleDone}
              className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main form screen ───────────────────────────────────────────────────────

  const presentCount = Object.values(statuses).filter(s => s === 'present').length
  const absentCount  = Object.values(statuses).filter(s => s === 'absent').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="flex w-full sm:max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[92vh]">

        {/* Header */}
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

        {/* Warning banner */}
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-2.5">
          <p className="text-[11px] text-amber-700">
            Attendance is permanent academic history. Record accurately — edits require admin intervention.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">

          {/* Session fields */}
          <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-3 space-y-3">
            {/* Row 1: date / duration / delivery */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">
                  Session Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">
                  Duration (min)
                </label>
                <input
                  ref={durationRef}
                  type="number"
                  min={15}
                  max={360}
                  defaultValue={group.duration_minutes ?? 60}
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#374151]">
                  Delivery
                </label>
                <select
                  ref={deliveryRef}
                  defaultValue="offline"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
                >
                  <option value="offline">In-Person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            {/* Row 2: Topic — required, full width */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#374151]">
                Session Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Introduction to loops, Algebra chapter 3, Variables and data types…"
                required
                maxLength={200}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] placeholder-[#CBD5E1] focus:border-[#FF8A1F] focus:outline-none focus:ring-1 focus:ring-[#FF8A1F]"
              />
            </div>
          </div>

          {/* Bulk actions + student list */}
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
                  const ind           = getStudentIndicators(s, sessionDate)
                  const currentStatus = statuses[s.student_id] ?? 'present'
                  return (
                    <li key={s.student_id} className="flex items-center gap-3 px-5 py-2.5">

                      {/* Name + indicators */}
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-[#0B1F3A] truncate">
                          {s.student_name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ind.noContract && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                              No Contract
                            </span>
                          )}
                          {ind.preEnrollment && ind.eligibleFrom && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                              Eligible from {fmtDate(ind.eligibleFrom)}
                            </span>
                          )}
                          {ind.exhausted && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                              Exhausted
                            </span>
                          )}
                          {ind.unpaid && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-600 border border-red-200">
                              Unpaid
                            </span>
                          )}
                          {!ind.noContract && !ind.preEnrollment && !ind.exhausted && ind.sessionsLeft !== null && ind.sessionsLeft > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
                              {ind.sessionsLeft} left
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

          {/* Footer */}
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
                disabled={isPending || students.length === 0 || !topic.trim()}
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
