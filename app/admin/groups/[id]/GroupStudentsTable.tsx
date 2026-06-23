'use client'

import { useState, useTransition, useActionState, useMemo } from 'react'
import {
  enrollStudent,
  unenrollStudent,
  changeEnrollmentType,
  bulkEnrollStudents,
} from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import type { Group, GroupEnrollment } from '@/modules/groups/types'
import type { StudentListItem } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'

interface Props {
  group: Group
  enrollments: GroupEnrollment[]
  availableStudents: StudentListItem[]
}

function TypeBadge({ type }: { type: 'primary' | 'secondary' }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
        type === 'primary'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-purple-50 text-purple-700',
      ].join(' ')}
    >
      {type}
    </span>
  )
}

export default function GroupStudentsTable({ group, enrollments: initial, availableStudents }: Props) {
  // ── Local state ────────────────────────────────────────────────────────────
  const [enrollments, setEnrollments] = useState<GroupEnrollment[]>(initial)
  const [search,       setSearch]      = useState('')
  const [filterType,   setFilterType]  = useState<'all' | 'primary' | 'secondary'>('all')
  const [filterStatus, setFilterStatus]= useState<'all' | 'active' | 'dropped'>('active')
  const [showBulk,     setShowBulk]    = useState(false)
  const [bulkSearch,   setBulkSearch]  = useState('')
  const [selected,     setSelected]    = useState<Set<string>>(new Set())
  const [bulkType,     setBulkType]    = useState<'primary' | 'secondary'>('primary')
  const [rowError,     setRowError]    = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // Single-enroll form (quick add via dropdown)
  const [enrollState, enrollAction] = useActionState<ActionResult<void> | null, FormData>(enrollStudent, null)
  // Bulk enroll form
  const [bulkState,   bulkAction]   = useActionState<
    ActionResult<{ enrolled: number; skipped: number }> | null,
    FormData
  >(bulkEnrollStudents, null)

  // ── Derived counts ─────────────────────────────────────────────────────────
  const active      = enrollments.filter((e) => e.status === 'active')
  const primaryCnt  = active.filter((e) => e.enrollment_type === 'primary').length
  const secondaryCnt= active.filter((e) => e.enrollment_type === 'secondary').length
  const totalActive = active.length
  const capacity    = group.capacity

  // ── Filtered view ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enrollments.filter((e) => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false
      if (filterType   !== 'all' && e.enrollment_type !== filterType) return false
      if (q) {
        const name  = [e.first_name, e.last_name].filter(Boolean).join(' ').toLowerCase()
        const code  = (e.student_code ?? '').toLowerCase()
        const phone = (e.phone ?? '').replace(/\D/g, '')
        if (!name.includes(q) && !code.includes(q) && !phone.includes(q.replace(/\D/g, ''))) return false
      }
      return true
    })
  }, [enrollments, search, filterType, filterStatus])

  // ── Bulk-add available list ────────────────────────────────────────────────
  const filteredAvailable = useMemo(() => {
    const q = bulkSearch.trim().toLowerCase()
    if (!q) return availableStudents
    return availableStudents.filter((s) => {
      const name  = [s.first_name, s.last_name].filter(Boolean).join(' ').toLowerCase()
      const code  = (s.student_code ?? '').toLowerCase()
      const email = s.user_email.toLowerCase()
      return name.includes(q) || code.includes(q) || email.includes(q)
    })
  }, [availableStudents, bulkSearch])

  // ── Row actions ────────────────────────────────────────────────────────────
  const handleRemove = (e: GroupEnrollment) => {
    if (!confirm(`Remove ${e.first_name ?? e.student_email} from this group?`)) return
    setEnrollments((prev) =>
      prev.map((x) => x.student_id === e.student_id ? { ...x, status: 'dropped' as const, left_at: new Date().toISOString() } : x)
    )
    startTransition(async () => {
      const res = await unenrollStudent(group.id, e.student_id)
      if (!res.success) {
        setEnrollments((prev) =>
          prev.map((x) => x.student_id === e.student_id ? { ...x, status: 'active' as const, left_at: null } : x)
        )
        setRowError(res.error.message)
      }
    })
  }

  const handleChangeType = (e: GroupEnrollment) => {
    const next = e.enrollment_type === 'primary' ? 'secondary' : 'primary'
    setEnrollments((prev) =>
      prev.map((x) => x.student_id === e.student_id ? { ...x, enrollment_type: next } : x)
    )
    startTransition(async () => {
      const res = await changeEnrollmentType(group.id, e.student_id, next)
      if (!res.success) {
        setEnrollments((prev) =>
          prev.map((x) => x.student_id === e.student_id ? { ...x, enrollment_type: e.enrollment_type } : x)
        )
        setRowError(res.error.message)
      }
    })
  }

  // ── Bulk-add toggle ────────────────────────────────────────────────────────
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === filteredAvailable.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredAvailable.map((s) => s.id)))
    }
  }

  // When bulk action succeeds, close dialog and merge new enrollments
  const bulkSuccess = bulkState?.success

  return (
    <div className="space-y-5">
      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',     value: totalActive,   sub: capacity ? `/ ${capacity}` : null, color: 'text-[#0B1F3A]' },
          { label: 'Primary',   value: primaryCnt,    sub: null,                              color: 'text-blue-700' },
          { label: 'Secondary', value: secondaryCnt,  sub: null,                              color: 'text-purple-700' },
          {
            label: 'Capacity',
            value: capacity ? `${capacity - totalActive}` : '∞',
            sub:   capacity ? 'available' : null,
            color: capacity && totalActive >= capacity ? 'text-red-600' : 'text-emerald-600',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-xs text-[#64748B]">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>
              {value}{sub && <span className="ml-1 text-sm font-normal text-[#94A3B8]">{sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* ── Student management table ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <input
            type="text"
            placeholder="Search by name, code, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-sm text-[#0B1F3A] outline-none"
          >
            <option value="all">All types</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-sm text-[#0B1F3A] outline-none"
          >
            <option value="active">Active</option>
            <option value="dropped">Dropped</option>
            <option value="all">All statuses</option>
          </select>

          <div className="ml-auto flex gap-2">
            {/* Quick single-add dropdown */}
            {availableStudents.length > 0 && (
              <form action={enrollAction} className="flex gap-1.5">
                <input type="hidden" name="group_id" value={group.id} />
                <select
                  name="student_id"
                  required
                  className="w-44 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F]"
                >
                  <option value="">Add student…</option>
                  {availableStudents.slice(0, 100).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                    </option>
                  ))}
                </select>
                <select
                  name="enrollment_type"
                  defaultValue="primary"
                  className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-sm text-[#0B1F3A] outline-none"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
                <SubmitButton label="Add" pendingLabel="…" />
              </form>
            )}

            {/* Bulk add button */}
            {availableStudents.length > 0 && (
              <button
                onClick={() => { setShowBulk(true); setSelected(new Set()); setBulkSearch('') }}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0B1F3A] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
              >
                Bulk Add
              </button>
            )}
          </div>
        </div>

        {/* Enroll error */}
        {enrollState && !enrollState.success && (
          <div className="border-b border-[#E2E8F0] bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {enrollState.error.message}
          </div>
        )}
        {rowError && (
          <div className="border-b border-[#E2E8F0] bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {rowError}
            <button onClick={() => setRowError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#94A3B8]">
            {search || filterType !== 'all' || filterStatus !== 'active'
              ? 'No students match the current filters.'
              : 'No students enrolled yet. Use "Add student" or "Bulk Add" above.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="w-8 px-3 py-2.5 text-center text-xs font-medium text-[#94A3B8]">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Parent</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Joined</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, idx) => (
                  <tr key={e.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] font-semibold text-[#94A3B8]">{idx + 1}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-[#64748B]">{e.student_code ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[#0B1F3A]">
                        {e.first_name && e.last_name
                          ? `${e.first_name} ${e.last_name}`
                          : e.student_email}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">{e.student_email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B]">{e.phone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">
                      {e.parent_phone_1 ?? '—'}
                      {e.parent_phone_2 && <span className="block text-[11px] text-[#94A3B8]">{e.parent_phone_2}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.status === 'active' ? (
                        <button
                          onClick={() => handleChangeType(e)}
                          disabled={isPending}
                          className="group flex items-center gap-1 disabled:opacity-50"
                          title={`Switch to ${e.enrollment_type === 'primary' ? 'secondary' : 'primary'}`}
                        >
                          <TypeBadge type={e.enrollment_type} />
                          <span className="hidden text-[10px] text-[#94A3B8] group-hover:inline">↻</span>
                        </button>
                      ) : (
                        <TypeBadge type={e.enrollment_type} />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B]">
                      {new Date(e.joined_at).toLocaleDateString('en-GB')}
                      {e.left_at && (
                        <span className="block text-[11px] text-[#94A3B8]">
                          Left {new Date(e.left_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/students/${e.student_id}`}
                          className="text-xs font-medium text-[#64748B] hover:text-[#0B1F3A]"
                        >
                          View
                        </Link>
                        {e.status === 'active' && (
                          <button
                            onClick={() => handleRemove(e)}
                            disabled={isPending}
                            className="text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="border-t border-[#E2E8F0] px-4 py-2.5 text-xs text-[#94A3B8]">
            Showing {filtered.length} of {enrollments.length} record{enrollments.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Bulk Add dialog ──────────────────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">Bulk Add Students</p>
                <p className="text-xs text-[#64748B]">{availableStudents.length} student{availableStudents.length !== 1 ? 's' : ''} available · {selected.size} selected</p>
              </div>
              <button onClick={() => setShowBulk(false)} className="text-[#94A3B8] hover:text-[#0B1F3A]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Search + type select */}
            <div className="flex gap-2 border-b border-[#E2E8F0] px-4 py-3">
              <input
                type="text"
                placeholder="Search by name, code, email…"
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
              <select
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value as 'primary' | 'secondary')}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-sm outline-none"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto">
              {filteredAvailable.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#94A3B8]">No students available.</p>
              ) : (
                <>
                  {/* Select all */}
                  <label className="flex cursor-pointer items-center gap-3 border-b border-[#E2E8F0] px-4 py-2.5 hover:bg-[#F8FAFC]">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredAvailable.length && filteredAvailable.length > 0}
                      onChange={toggleAll}
                      className="rounded border-[#CBD5E1] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                    />
                    <span className="text-xs font-medium text-[#64748B]">Select all ({filteredAvailable.length})</span>
                  </label>

                  {filteredAvailable.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-[#E2E8F0] px-4 py-2.5 last:border-0 hover:bg-[#F8FAFC]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelected(s.id)}
                        className="rounded border-[#CBD5E1] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#0B1F3A]">
                          {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                          {s.student_code && (
                            <span className="ml-2 font-mono text-xs text-[#94A3B8]">{s.student_code}</span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-[#94A3B8]">{s.phone ?? s.user_email}</p>
                      </div>
                    </label>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              {bulkState && !bulkState.success && (
                <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  {bulkState.error.message}
                </p>
              )}
              {bulkSuccess && (
                <p className="mb-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs text-green-700">
                  Enrolled {bulkState.data.enrolled} student{bulkState.data.enrolled !== 1 ? 's' : ''}
                  {bulkState.data.skipped > 0 ? `, ${bulkState.data.skipped} skipped` : ''}.
                </p>
              )}

              <form
                action={(fd) => {
                  // Inject selected student IDs into the form
                  for (const id of selected) fd.append('student_ids', id)
                  return bulkAction(fd)
                }}
                className="flex items-center justify-between"
              >
                <input type="hidden" name="group_id"        value={group.id} />
                <input type="hidden" name="enrollment_type" value={bulkType} />

                <p className="text-xs text-[#64748B]">
                  {selected.size} student{selected.size !== 1 ? 's' : ''} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulk(false)}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
                  >
                    Close
                  </button>
                  {selected.size === 0 ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-[#FF8A1F] px-4 py-1.5 text-sm font-medium text-white opacity-40 cursor-not-allowed"
                    >
                      Enroll students
                    </button>
                  ) : (
                    <SubmitButton
                      label={`Enroll ${selected.size} student${selected.size !== 1 ? 's' : ''}`}
                      pendingLabel="Enrolling…"
                    />
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
