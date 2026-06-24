'use client'

import { useTransition, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordAttendanceSession } from '@/modules/attendance/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import type { GroupListItem } from '@/modules/groups/types'
import type { SessionStudent } from '@/modules/attendance/types'
import type { AttendanceStatus } from '@/types/enums'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

interface Props {
  groups: GroupListItem[]
  selectedGroupId?: string
  selectedGroup?: GroupListItem
  students: SessionStudent[]
}

export default function AttendanceRecordForm({ groups, selectedGroupId, selectedGroup, students }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(students.map((s) => [s.student_id, 'present']))
  )

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value
    if (gid) {
      router.push(`/admin/attendance/record?group=${gid}`)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    // Inject per-student statuses
    students.forEach((s) => {
      data.set(`status_${s.student_id}`, statuses[s.student_id] ?? 'present')
    })

    startTransition(async () => {
      const result = await recordAttendanceSession(data)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => router.push('/admin/attendance'), 1500)
      } else {
        setError(result.error.message)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-[#E7F8EE] p-8 text-center">
        <p className="text-lg font-medium text-[#15803D]">Attendance recorded successfully!</p>
        <p className="mt-1 text-sm text-[#10B981]">Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Group + Session info */}
      <div className="ds-card p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Session Details</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">{error}</div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {selectedGroup && (
            <input type="hidden" name="branch_id" value={selectedGroup.branch_id} />
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Group <span className="text-[#EF4444]">*</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                Session date <span className="text-[#EF4444]">*</span>
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

          {/* Student attendance grid */}
          {selectedGroup && students.length > 0 && (
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[#0B1F3A]">
                  Students ({students.length})
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.student_id, 'present'])))}
                    className="text-xs font-medium text-[#10B981] hover:underline"
                  >
                    All present
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.student_id, 'absent'])))}
                    className="text-xs font-medium text-[#EF4444] hover:underline"
                  >
                    All absent
                  </button>
                </div>
              </div>

              <input type="hidden" name="student_ids[]" value="" />
              {students.map((s) => (
                <input key={`id_${s.student_id}`} type="hidden" name="student_ids[]" value={s.student_id} />
              ))}

              <ul className="space-y-2">
                {students.map((s) => (
                  <li key={s.student_id} className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0B1F3A]">
                        {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.student_email}
                      </p>
                      <p className="text-xs text-[#94A3B8]">{s.student_email}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatuses((prev) => ({ ...prev, [s.student_id]: st }))}
                          className={[
                            'rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition',
                            statuses[s.student_id] === st
                              ? st === 'present'
                                ? 'border-emerald-300 bg-[#E7F8EE] text-[#15803D]'
                                : st === 'absent'
                                  ? 'border-[#FECACA] bg-[#FEE2E2] text-[#EF4444]'
                                  : st === 'late'
                                    ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                                    : 'border-blue-200 bg-[#EFF6FF] text-[#2563EB]'
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
            <p className="text-sm text-[#94A3B8]">
              No active students in this group. Enroll students first.
            </p>
          )}

          {selectedGroup && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/admin/attendance"
                className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isPending || students.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
