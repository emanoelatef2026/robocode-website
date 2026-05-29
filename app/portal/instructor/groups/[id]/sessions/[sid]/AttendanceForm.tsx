'use client'

import { useActionState, useRef } from 'react'
import { saveAttendance } from '@/modules/instructor-portal/actions'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'

interface Props {
  sessionId: string
  groupId:   string
  rows:      SessionAttendanceRow[]
}

const STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent:  'bg-red-100 text-red-700',
  late:    'bg-yellow-100 text-yellow-700',
  excused: 'bg-blue-100 text-blue-700',
  makeup:  'bg-purple-100 text-purple-700',
}

export default function AttendanceForm({ sessionId, groupId, rows }: Props) {
  const [state, action, pending] = useActionState(saveAttendance, null)
  const formRef = useRef<HTMLFormElement>(null)

  const markAll = (status: string) => {
    if (!formRef.current) return
    rows.forEach((r) => {
      const radio = formRef.current!.querySelector<HTMLInputElement>(
        `input[name="status_${r.student_id}"][value="${status}"]`
      )
      if (radio) radio.checked = true
    })
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="group_id"   value={groupId} />

      {rows.map((r) => (
        <input key={r.student_id} type="hidden" name="student_ids[]" value={r.student_id} />
      ))}

      {state && !state.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Attendance saved.
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
            {rows.length} Student{rows.length !== 1 ? 's' : ''}
          </p>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => markAll('present')}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#64748B] transition hover:border-green-300 hover:text-green-700"
            >
              Mark All Present
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#64748B]">
            No students enrolled in this group.
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {rows.map((r) => (
              <div key={r.student_id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#3B82F6]">
                    {r.student_name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <p className="min-w-0 flex-1 text-sm font-medium text-[#0B1F3A]">{r.student_name}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUSES.map((st) => (
                    <label key={st} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`status_${r.student_id}`}
                        value={st}
                        defaultChecked={r.status ? r.status === st : st === 'present'}
                        className="accent-[#FF8A1F]"
                      />
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[st]}`}>
                        {st}
                      </span>
                    </label>
                  ))}
                </div>

                <input
                  type="text"
                  name={`notes_${r.student_id}`}
                  defaultValue={r.notes ?? ''}
                  placeholder="Attendance note (optional)"
                  className="mt-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
        >
          {pending ? 'Saving…' : 'Save Attendance'}
        </button>
      )}
    </form>
  )
}
