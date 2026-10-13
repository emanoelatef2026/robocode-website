'use client'

import { useEffect, useState } from 'react'
import { getStudentAttendanceBrowserAction } from '@/modules/groups/actions/attendance-browser'
import { filterStudentAttendance, summarizeStudentAttendance } from '@/modules/groups/attendance-browser'
import type { AttendanceContractOption, StudentAttendanceBrowserData } from '@/modules/groups/attendance-browser'

function dateLabel(value: string | null) {
  return value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No start date'
}

const controlClass = 'mt-1.5 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[13px] font-medium text-[#0B1F3A] outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20'

export default function StudentAttendancePanel({
  studentId, defaultEnrollmentId, refreshVersion, onAddAttendance,
}: {
  studentId: string
  defaultEnrollmentId: string | null
  refreshVersion: number
  onAddAttendance: (contract: AttendanceContractOption) => void
}) {
  const [response, setResponse] = useState<{ key: string; data: StudentAttendanceBrowserData | null; error: string | null } | null>(null)
  const [retry, setRetry] = useState(0)
  const [courseId, setCourseId] = useState('')
  const [contractId, setContractId] = useState(defaultEnrollmentId ?? '')
  const [visibleCount, setVisibleCount] = useState(20)
  const requestKey = `${studentId}:${refreshVersion}:${retry}`
  const data = response?.key === requestKey ? response.data : null
  const error = response?.key === requestKey ? response.error : null

  useEffect(() => {
    let cancelled = false
    getStudentAttendanceBrowserAction(studentId).then(result => {
      if (cancelled) return
      setResponse({ key: requestKey, data: result, error: null })
    }).catch(() => {
      if (cancelled) return
      setResponse({ key: requestKey, data: null, error: 'Could not load attendance. Please try again.' })
    })
    return () => { cancelled = true }
  }, [studentId, requestKey])

  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
    {error}<button type="button" className="ml-2 underline" onClick={() => setRetry(value => value + 1)}>Retry</button>
  </div>
  if (!data) return <p role="status" className="rounded-xl bg-[#F1F5F9] p-4 text-sm font-semibold text-[#475569]">Loading attendance and contracts…</p>

  const courses = new Map<string, string>()
  for (const item of [...data.contracts, ...data.records]) {
    if (item.course_id) courses.set(item.course_id, item.course_name)
  }
  const contract = data.contracts.find(item => item.id === contractId)
  const effectiveContractId = contract?.id ?? ''
  const contracts = data.contracts.filter(item => !courseId || item.course_id === courseId)
  const records = filterStudentAttendance(data.records, courseId, effectiveContractId)
  const summary = summarizeStudentAttendance(records)
  const canAdd = contract?.status === 'ACTIVE' && contract.enrolled_sessions > 0 && contract.remaining_sessions > 0
  const contractNames = new Map(data.contracts.map(item => [item.id, item.code ?? `Contract ${item.id.slice(0, 8)}`]))

  return <div className="space-y-4">
    <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4">
      <h3 className="text-sm font-bold text-[#0B1F3A]">Attendance filters</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-xs font-semibold text-[#475569]">Course
          <select aria-label="Attendance course" className={controlClass} value={courseId} onChange={event => {
            setCourseId(event.target.value)
            setContractId('')
            setVisibleCount(20)
          }}>
            <option value="">All courses</option>
            {[...courses].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-semibold text-[#475569]">Contract
          <select aria-label="Attendance contract" className={controlClass} value={effectiveContractId} onChange={event => {
            setContractId(event.target.value)
            setVisibleCount(20)
          }}>
            <option value="">All contracts / full course history</option>
            {contracts.map(item => <option key={item.id} value={item.id}>
              {item.code ?? `Contract ${item.id.slice(0, 8)}`} · {item.course_name} · {dateLabel(item.start_date)} · {item.status} · {item.consumed_sessions}/{item.enrolled_sessions} used · {item.remaining_sessions} left
            </option>)}
          </select>
        </label>
      </div>
      {courseId && contracts.length === 0 && <p className="mt-2 text-xs font-medium text-[#475569]">No contracts for this course. Its attendance history is shown below.</p>}
    </div>

    {contract && <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-[#0B1F3A]">{contract.code ?? `Contract ${contract.id.slice(0, 8)}`}</p>
          <p className="mt-1 text-xs font-medium text-[#475569]">{contract.course_name} · {dateLabel(contract.start_date)} · {contract.status}</p>
          {contract.group_name && <p className="mt-1 break-words text-xs text-[#475569]">{contract.group_name}</p>}
        </div>
        <button type="button" onClick={() => onAddAttendance(contract)} disabled={!canAdd}
          title={!canAdd ? 'Choose an active contract with remaining sessions to add attendance.' : undefined}
          className="rounded-lg bg-[#C2410C] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-50">+ Add attendance</button>
      </div>
      <p className="mt-3 text-[13px] font-semibold text-[#0B1F3A]">{contract.consumed_sessions} / {contract.enrolled_sessions} sessions used <span className="mx-1 text-[#64748B]">·</span> {contract.remaining_sessions} remaining</p>
      <p className="mt-2 text-xs font-medium leading-5 text-[#475569]">Showing all sessions charged to this contract, including sessions from previous groups and individual lessons.</p>
    </div>}

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Filtered attendance totals">
      {[
        { label: 'Present', count: summary.present, style: 'border-emerald-100 bg-[#E7F8EE] text-[#15803D]' },
        { label: 'Absent', count: summary.absent, style: 'border-red-100 bg-red-50 text-[#B91C1C]' },
        { label: 'Late', count: summary.late, style: 'border-amber-100 bg-amber-50 text-[#92400E]' },
        { label: 'Consumed', count: summary.consumed, style: 'border-[#CBD5E1] bg-[#F1F5F9] text-[#0B1F3A]' },
      ].map(item => <div key={item.label} className={`rounded-xl border px-3 py-3 text-center ${item.style}`}>
        <p className="text-xl font-bold tabular-nums">{item.count}</p><p className="mt-1 text-[11px] font-semibold">{item.label}</p>
      </div>)}
    </div>

    <div>
      <p className="mb-2 text-xs font-semibold text-[#475569]">{records.length} sessions · newest first{!contract && ' · includes attendance not yet charged to a contract'}</p>
      {!records.length ? <p className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-sm font-medium text-[#475569]">No attendance for this selection.</p> : <div className="overflow-hidden rounded-xl border border-[#CBD5E1]">
        {records.slice(0, visibleCount).map(record => <div key={record.id} className="border-b border-[#E2E8F0] px-4 py-3 last:border-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#0B1F3A]">{dateLabel(record.scheduled_at)}</p>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${record.status === 'absent' ? 'bg-red-50 text-[#B91C1C]' : record.status === 'late' ? 'bg-amber-50 text-[#92400E]' : record.status === 'present' || record.status === 'makeup' ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#F1F5F9] text-[#475569]'}`}>{record.status}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#475569]">{record.course_name}</p>
          <p className="mt-1 break-words text-xs leading-5 text-[#475569]">{[record.group_name, record.instructor_name].filter(Boolean).join(' · ') || record.topic || 'Individual lesson'}</p>
          <p className="mt-1 text-[11px] font-medium text-[#64748B]">{record.enrollment_id ? `${contractNames.get(record.enrollment_id) ?? 'Contract'} · Consumed` : 'Not charged to a contract'}</p>
        </div>)}
      </div>}
      {records.length > visibleCount && <button type="button" className="mt-3 w-full rounded-xl border border-[#CBD5E1] px-3 py-2.5 text-sm font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC]" onClick={() => setVisibleCount(value => value + 20)}>Show more ({records.length - visibleCount} remaining)</button>}
    </div>
  </div>
}
