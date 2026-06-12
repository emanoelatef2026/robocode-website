'use client'

import { useTransition, useRef, useState } from 'react'
import { useRouter }                        from 'next/navigation'
import { recordAttendanceSession }          from '@/modules/attendance/actions'
import Link                                 from 'next/link'
import type { GroupListItem }               from '@/modules/groups/types'
import type { SessionStudent }              from '@/modules/attendance/types'
import type { AttendanceStatus }            from '@/types/enums'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

const BADGE: Record<AttendanceStatus, string> = {
  present:  'border-emerald-300 bg-emerald-50  text-emerald-700',
  absent:   'border-red-200    bg-red-50       text-red-600',
  late:     'border-amber-200  bg-amber-50     text-amber-700',
  excused:  'border-blue-200   bg-blue-50      text-blue-600',
  makeup:   'border-purple-200 bg-purple-50    text-purple-600',
}

const BACK = '/portal/team-leader/attendance'

interface Props {
  groups:          GroupListItem[]
  selectedGroupId?: string
  selectedGroup?:  GroupListItem
  students:        SessionStudent[]
}

export default function TLAttendanceRecordForm({
  groups, selectedGroupId, selectedGroup, students,
}: Props) {
  const router                      = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [success, setSuccess]        = useState(false)
  const formRef                      = useRef<HTMLFormElement>(null)

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(students.map((s) => [s.student_id, 'present' as AttendanceStatus]))
  )

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value
    if (gid) router.push(`/portal/team-leader/attendance/record?group=${gid}`)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const data = new FormData(e.currentTarget)
    students.forEach((s) => data.set(`status_${s.student_id}`, statuses[s.student_id] ?? 'present'))

    startTransition(async () => {
      const result = await recordAttendanceSession(data)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => router.push(BACK), 1600)
      } else {
        setError(result.error.message)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-base font-medium text-emerald-700">Attendance recorded successfully!</p>
        <p className="mt-1 text-sm text-emerald-600">Session is now visible across all portals. Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Historical backfill notice */}
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex gap-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-700">Historical Session Recording Supported</p>
            <p className="mt-0.5 text-xs text-amber-600">
              You can set any past date. Attendance is academic history — contracts and payments can be linked later.
              Sessions appear immediately in student, parent, and instructor portals.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Session Details</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {selectedGroup && (
            <input type="hidden" name="branch_id" value={selectedGroup.branch_id} />
          )}

          {/* Group */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Group <span className="text-red-500">*</span>
            </label>
            <select
              name="group_id"
              required
              defaultValue={selectedGroupId ?? ''}
              onChange={handleGroupChange}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">Select active group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Session date + duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                Session date <span className="text-red-500">*</span>
              </label>
              <input
                name="session_date"
                type="datetime-local"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Duration (min)</label>
              <input
                name="duration_minutes"
                type="number"
                min={15}
                max={480}
                defaultValue={60}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </div>

          {/* Delivery mode */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Delivery</label>
            <select
              name="delivery"
              defaultValue="offline"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          {/* Student grid */}
          {selectedGroup && students.length > 0 && (
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[#0B1F3A]">Students ({students.length})</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.student_id, 'present' as AttendanceStatus])))}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    All present
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.student_id, 'absent' as AttendanceStatus])))}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    All absent
                  </button>
                </div>
              </div>

              {/* hidden student_ids array */}
              <input type="hidden" name="student_ids[]" value="" />
              {students.map((s) => (
                <input key={`id_${s.student_id}`} type="hidden" name="student_ids[]" value={s.student_id} />
              ))}

              <ul className="space-y-2">
                {students.map((s) => (
                  <li
                    key={s.student_id}
                    className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#0B1F3A]">
                        {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.student_email}
                      </p>
                      <p className="truncate text-xs text-[#94A3B8]">{s.student_email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatuses((prev) => ({ ...prev, [s.student_id]: st }))}
                          className={[
                            'rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition',
                            statuses[s.student_id] === st
                              ? BADGE[st]
                              : 'border-[#E2E8F0] text-[#94A3B8] hover:border-[#CBD5E1]',
                          ].join(' ')}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedGroup && students.length === 0 && (
            <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-sm text-[#94A3B8]">
              No active students in this group. Enroll students first.
            </p>
          )}

          {selectedGroup && (
            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Link
                href={BACK}
                className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isPending || students.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  'Save Attendance'
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
