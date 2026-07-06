'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { StudentOperationsRow } from '@/modules/finance/types'
import {
  RISK_ROW_BG, STATUS_COLORS, STATUS_LABELS,
  computeSessionExhaustion,
} from '@/modules/finance/types'
import StudentOpsDrawer from './StudentOpsDrawer'
import EnrollmentWizard from './EnrollmentWizard'
import { buildWhatsAppUrl } from '@/lib/contact-utils'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function fmtDateShort(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function rowPriority(r: StudentOperationsRow): number {
  if (r.financial_status === 'BLOCKED') return 0
  if (r.financial_status === 'OVERDUE') return 1
  const ex = computeSessionExhaustion(r.enrolled_sessions, r.remaining_sessions)
  if (ex === 'EXHAUSTED') return 2
  if (ex === 'CRITICAL')  return 3
  if (r.consecutive_absences >= 3) return 4
  if (r.sessions_attended > 0 && r.attendance_pct < 60) return 5
  if (r.sessions_attended > 0 && r.attendance_pct < 80) return 6
  if (r.sessions_attended >= 10 && r.remaining_amount > 0) return 7
  if (r.risk_level === 'HIGH')   return 8
  if (r.risk_level === 'MEDIUM') return 9
  return 10
}

function getStatusBadge(r: StudentOperationsRow): { label: string; cls: string } | null {
  if (!r.account_id) return { label: 'No Package', cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' }
  if (!r.financial_status) return null
  const cls = STATUS_COLORS[r.financial_status as keyof typeof STATUS_COLORS] ?? 'bg-[#F8FAFC] text-[#475569] border-slate-200'
  return { label: STATUS_LABELS[r.financial_status as keyof typeof STATUS_LABELS] ?? r.financial_status, cls }
}

function getActionBadge(r: StudentOperationsRow): { label: string; cls: string } | null {
  const ex = computeSessionExhaustion(r.enrolled_sessions, r.remaining_sessions)
  if (r.financial_status === 'BLOCKED')  return { label: 'Collect Now', cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]' }
  if (r.financial_status === 'OVERDUE')  return { label: 'Collect Now', cls: 'bg-[#FEE2E2] text-[#EF4444] border-[#FECACA]' }
  if (ex === 'EXHAUSTED')                return { label: 'Renew', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
  if (r.consecutive_absences >= 3)       return { label: 'Absent ×' + r.consecutive_absences, cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' }
  if (r.sessions_attended >= 10 && r.remaining_amount > 0)
                                         return { label: 'Missing Pay', cls: 'bg-[#FFFBEB] text-[#92400E] border-amber-300' }
  return null
}

type SortField = 'student_name' | 'attendance_pct' | 'remaining_amount' | 'risk_level' | 'sessions_attended'

interface Props {
  rows:        StudentOperationsRow[]
  branchIds:   string[]
  branches:    { id: string; name: string }[]
  groups:      { id: string; name: string }[]
  instructors: { id: string; name: string }[]
  multiBranch: boolean
}

export default function StudentOpsTable({ rows, branchIds, branches, groups, instructors, multiBranch }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const sp         = useSearchParams()

  // ── Filter state — initialized from URL ──────────────────────────────────────
  const [searchInput,      setSearchInput]      = useState(() => sp.get('q')          ?? '')
  const [search,           setSearch]           = useState(() => sp.get('q')          ?? '')
  const [filterGroup,      setFilterGroup]      = useState(() => sp.get('g')          ?? '')
  const [filterInstructor, setFilterInstructor] = useState(() => sp.get('i')          ?? '')
  const [filterBranch,     setFilterBranch]     = useState(() => sp.get('b')          ?? '')
  const [filterFinStatus,  setFilterFinStatus]  = useState(() => sp.get('s')          ?? '')
  const [overdueOnly,      setOverdueOnly]      = useState(() => sp.get('ov') === '1')
  const [sortField,        setSortField]        = useState<SortField>('risk_level')
  const [sortAsc,          setSortAsc]          = useState(true)
  const [selectedStudent,  setSelectedStudent]  = useState<StudentOperationsRow | null>(null)
  const [showWizard,       setShowWizard]       = useState(false)
  const [filtersOpen,      setFiltersOpen]      = useState(false)

  // ── Debounce search (300ms) + stale guard ────────────────────────────────────
  const searchVersion = useRef(0)
  useEffect(() => {
    const v = ++searchVersion.current
    const t = setTimeout(() => { if (searchVersion.current === v) setSearch(searchInput) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Persist filters to URL ───────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams()
    if (search)           params.set('q',  search)
    if (filterGroup)      params.set('g',  filterGroup)
    if (filterInstructor) params.set('i',  filterInstructor)
    if (filterBranch)     params.set('b',  filterBranch)
    if (filterFinStatus)  params.set('s',  filterFinStatus)
    if (overdueOnly)      params.set('ov', '1')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [search, filterGroup, filterInstructor, filterBranch, filterFinStatus, overdueOnly, pathname, router])

  const handleSort = useCallback((field: SortField) => {
    setSortField(f => { if (f === field) { setSortAsc(a => !a); return f } setSortAsc(true); return field })
  }, [])

  const filtered = useMemo(() => {
    let out = rows
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.student_name.toLowerCase().includes(q) ||
        (r.student_code  ?? '').toLowerCase().includes(q) ||
        (r.parent_name   ?? '').toLowerCase().includes(q) ||
        (r.student_phone ?? '').includes(q) ||
        (r.parent_phone_1 ?? '').includes(q) ||
        (r.parent_phone_2 ?? '').includes(q) ||
        (r.group_name    ?? '').toLowerCase().includes(q) ||
        (r.instructor_name ?? '').toLowerCase().includes(q)
      )
    }
    if (filterBranch)    out = out.filter(r => r.branch_id === filterBranch)
    if (filterGroup)     out = out.filter(r => r.group_id  === filterGroup)
    if (filterInstructor)out = out.filter(r => r.instructor_id === filterInstructor)
    if (filterFinStatus) out = out.filter(r => r.financial_status === filterFinStatus)
    if (overdueOnly)     out = out.filter(r => r.financial_status === 'OVERDUE' && r.days_overdue > 0)

    out = [...out].sort((a, b) => {
      let diff = 0
      if (sortField === 'risk_level') {
        diff = rowPriority(a) - rowPriority(b)
        if (diff === 0) diff = b.remaining_amount - a.remaining_amount
      } else if (sortField === 'student_name') {
        diff = a.student_name.localeCompare(b.student_name)
      } else if (sortField === 'attendance_pct') {
        diff = a.attendance_pct - b.attendance_pct
      } else if (sortField === 'remaining_amount') {
        diff = a.remaining_amount - b.remaining_amount
      } else if (sortField === 'sessions_attended') {
        diff = a.sessions_attended - b.sessions_attended
      }
      return sortAsc ? diff : -diff
    })
    return out
  }, [rows, search, filterBranch, filterGroup, filterInstructor, filterFinStatus, overdueOnly, sortField, sortAsc])

  const highCount    = rows.filter(r => r.risk_level === 'HIGH').length
  const overdueCount = rows.filter(r => r.financial_status === 'OVERDUE').length
  const blockedCount = rows.filter(r => r.financial_status === 'BLOCKED').length
  const noGroupCount = rows.filter(r => !r.group_id).length

  function clearFilters() {
    setSearchInput(''); setSearch(''); setFilterBranch('')
    setFilterGroup(''); setFilterInstructor(''); setFilterFinStatus(''); setOverdueOnly(false)
  }

  function exportCSV() {
    const params = new URLSearchParams()
    params.set('branches', branchIds.join(','))
    if (filterFinStatus) params.set('status', filterFinStatus)
    window.open(`/api/finance/export?${params}`, '_blank')
  }

  const hasFilter = !!(searchInput || filterBranch || filterGroup || filterInstructor || filterFinStatus || overdueOnly)

  const SortTh = ({ field, children, cls = '' }: { field: SortField; children: React.ReactNode; cls?: string }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B] hover:text-[#0B1F3A] ${cls}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3 w-3 transition-transform ${sortAsc ? '' : 'rotate-180'}`}>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </th>
  )

  return (
    <>
      {/* ── Summary strip ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {highCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-[#FEE2E2] px-2.5 py-1 font-medium text-[#EF4444]">
            🔴 {highCount} HIGH risk
          </span>
        )}
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FCA5A5] bg-[#FEE2E2] px-2.5 py-1 font-medium text-[#991B1B]">
            🚫 {blockedCount} BLOCKED
          </span>
        )}
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 font-medium text-[#B45309]">
            ⚠️ {overdueCount} overdue
          </span>
        )}
        {noGroupCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 font-medium text-[#475569]">
            📋 {noGroupCount} no group
          </span>
        )}
      </div>

      {/* ── Filters (sticky) ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 ds-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] p-3">
          {/* Search */}
          <div className="relative min-w-48 flex-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name, code, phone, parent, group…"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          {multiBranch && branches.length > 0 && (
            <Select value={filterBranch} onChange={setFilterBranch} placeholder="All branches">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          {groups.length > 0 && (
            <Select value={filterGroup} onChange={setFilterGroup} placeholder="All groups">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          )}
          {instructors.length > 0 && (
            <Select value={filterInstructor} onChange={setFilterInstructor} placeholder="All instructors">
              {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          )}
          <Select value={filterFinStatus} onChange={setFilterFinStatus} placeholder="All status">
            <option value="BLOCKED">Blocked</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="CURRENT">Current</option>
            <option value="PAID">Paid</option>
          </Select>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#FF8A1F]" />
            Overdue only
          </label>

          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-[#FF8A1F] hover:underline">Clear ×</button>
          )}

          <span className="ml-auto text-xs text-[#94A3B8]">{filtered.length} students</span>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export
          </button>

          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Payment
          </button>
        </div>

        {/* ── Desktop table (no horizontal scroll) ───────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No students found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Adjust the filters or add a payment contract.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-175 table-fixed text-sm">
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
                <thead className="ds-table-head">
                  <tr className="border-b border-[#E2E8F0]">
                    <SortTh field="student_name">Student</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Group / Course</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <SortTh field="sessions_attended">Sessions</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Payment Status</th>
                    <SortTh field="remaining_amount">Remaining</SortTh>
                    <SortTh field="attendance_pct">Att %</SortTh>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const statusBadge = getStatusBadge(row)
                    const actionBadge = getActionBadge(row)
                    const ex = computeSessionExhaustion(row.enrolled_sessions, row.remaining_sessions)
                    return (
                      <tr
                        key={row.enrollment_id ?? row.student_id}
                        className={`border-b border-[#E2E8F0] last:border-0 transition-colors hover:bg-[#F8FAFC] ${RISK_ROW_BG[row.risk_level]}`}
                      >
                        {/* Student */}
                        <td className="px-3 py-2.5">
                          <button onClick={() => setSelectedStudent(row)} className="w-full text-left">
                            <p className="truncate font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{row.student_name}</p>
                            <p className="text-[11px] text-[#94A3B8]">
                              {row.student_code ? `#${row.student_code}` : ''}
                              {multiBranch && row.branch_name ? ` · ${row.branch_name}` : ''}
                            </p>
                          </button>
                        </td>

                        {/* Group / Course */}
                        <td className="px-3 py-2.5">
                          {row.group_name
                            ? <p className="truncate text-xs font-medium text-[#0B1F3A]">{row.group_name}</p>
                            : row.course_name
                              ? <p className="truncate text-xs text-[#0B1F3A]">{row.course_name}</p>
                              : <span className="text-[11px] font-medium text-[#F59E0B]">No group</span>}
                          {row.course_name && row.group_name && (
                            <p className="truncate text-[11px] text-[#94A3B8]">{row.course_name}</p>
                          )}
                          {!row.course_name && row.group_start_date && (
                            <p className="text-[11px] text-[#94A3B8]">Since {fmtDateShort(row.group_start_date)}</p>
                          )}
                        </td>

                        {/* Instructor */}
                        <td className="px-3 py-2.5">
                          {row.instructor_name
                            ? <p className="truncate text-xs text-[#64748B]">{row.instructor_name}</p>
                            : <span className="text-[11px] font-medium text-[#F59E0B]">Unassigned</span>}
                        </td>

                        {/* Sessions (attendance + package) */}
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-[#64748B]">
                            <span className={row.sessions_attended >= 10 && row.remaining_amount > 0 ? 'font-semibold text-[#B45309]' : ''}>
                              {row.sessions_attended}
                            </span>
                            <span className="text-[#94A3B8]">/{row.total_sessions}</span>
                          </p>
                          {row.enrolled_sessions > 0 && (
                            <p className={`text-[11px] font-medium ${
                              ex === 'EXHAUSTED' ? 'text-[#EF4444]' :
                              ex === 'CRITICAL'  ? 'text-[#EF4444]' :
                              ex === 'WARNING'   ? 'text-[#F59E0B]' : 'text-[#10B981]'
                            }`}>
                              {row.remaining_sessions <= 0 ? 'Exhausted' : `${row.remaining_sessions} left`}
                            </p>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1">
                            {statusBadge && (
                              <span className={`inline-block w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                            )}
                            {actionBadge && (
                              <span className={`inline-block w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${actionBadge.cls}`}>
                                {actionBadge.label}
                              </span>
                            )}
                            {!statusBadge && !actionBadge && (
                              <span className="text-[10px] text-[#10B981]">✓ OK</span>
                            )}
                          </div>
                        </td>

                        {/* Remaining */}
                        <td className="px-3 py-2.5">
                          {row.account_id ? (
                            row.remaining_amount > 0 ? (
                              <span className={`text-xs font-semibold ${
                                row.financial_status === 'OVERDUE' || row.financial_status === 'BLOCKED'
                                  ? 'text-[#EF4444]' : 'text-[#0B1F3A]'
                              }`}>
                                EGP {fmt(row.remaining_amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-[#10B981]">Paid ✓</span>
                            )
                          ) : (
                            <span className="text-[11px] font-medium text-[#F59E0B]">No pkg</span>
                          )}
                          {row.next_due_date && row.days_overdue > 0 && (
                            <p className="text-[10px] font-medium text-[#EF4444]">{row.days_overdue}d late</p>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold ${
                            row.attendance_pct >= 80 ? 'text-[#10B981]' :
                            row.attendance_pct >= 60 ? 'text-[#F59E0B]' :
                            row.total_sessions > 0   ? 'text-[#EF4444]' :
                            'text-[#94A3B8]'
                          }`}>
                            {row.total_sessions > 0 ? `${row.attendance_pct}%` : '—'}
                          </span>
                          {row.consecutive_absences >= 3 && (
                            <p className="text-[10px] font-medium text-[#EF4444]">{row.consecutive_absences} consec.</p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="overflow-hidden px-2 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {row.parent_phone_1 && (
                              <>
                                <a
                                  href={buildWhatsAppUrl(row.parent_phone_1, null) ?? '#'}
                                  target="_blank" rel="noopener noreferrer"
                                  title="WhatsApp parent"
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#10B981] hover:bg-[#E7F8EE]"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8a7.96 7.96 0 01-4.126-1.144L2 18l1.168-3.744A7.96 7.96 0 012 10c0-4.418 3.582-8 8-8s8 3.582 8 8zm-8 6a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                                  </svg>
                                </a>
                                <a
                                  href={`tel:${row.parent_phone_1}`}
                                  title="Call parent"
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#2563EB] hover:bg-[#EFF6FF]"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                  </svg>
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedStudent(row)}
                              title="View detail"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#FF8A1F] hover:bg-orange-50"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ──────────────────────────────────────────────── */}
            <div className="block space-y-2 p-3 md:hidden">
              {filtered.map(row => {
                const statusBadge = getStatusBadge(row)
                const actionBadge = getActionBadge(row)
                return (
                  <div
                    key={row.enrollment_id ?? row.student_id}
                    className={`rounded-xl border border-[#E2E8F0] p-4 ${RISK_ROW_BG[row.risk_level]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setSelectedStudent(row)} className="text-left font-semibold text-[#0B1F3A] truncate block w-full">
                          {row.student_name}
                        </button>
                        <p className="text-xs text-[#64748B] truncate">
                          {row.group_name ?? <span className="text-[#F59E0B]">No group</span>}
                          {row.instructor_name ? ` · ${row.instructor_name}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {statusBadge && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        )}
                        {actionBadge && (
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${actionBadge.cls}`}>
                            {actionBadge.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[#94A3B8]">Attendance</p>
                        <p className={`font-semibold ${
                          row.attendance_pct >= 80 ? 'text-[#10B981]' :
                          row.attendance_pct >= 60 ? 'text-[#F59E0B]' :
                          row.total_sessions > 0   ? 'text-[#EF4444]' :
                          'text-[#94A3B8]'
                        }`}>
                          {row.total_sessions > 0
                            ? `${row.attendance_pct}% (${row.sessions_attended}/${row.total_sessions})`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#94A3B8]">Remaining</p>
                        <p className={`font-semibold ${row.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {row.account_id
                            ? (row.remaining_amount > 0 ? `EGP ${fmt(row.remaining_amount)}` : 'Paid ✓')
                            : <span className="text-[#F59E0B]">No package</span>}
                        </p>
                      </div>
                      {row.parent_name && (
                        <div>
                          <p className="text-[#94A3B8]">Parent</p>
                          <p className="font-medium text-[#0B1F3A]">{row.parent_name}</p>
                        </div>
                      )}
                      {row.next_due_date && (
                        <div>
                          <p className="text-[#94A3B8]">Next Due</p>
                          <p className={`font-medium ${row.days_overdue > 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                            {fmtDateShort(row.next_due_date)}
                            {row.days_overdue > 0 && ` (${row.days_overdue}d)`}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-[#E2E8F0] pt-2">
                      {row.parent_phone_1 && (
                        <>
                          <a href={buildWhatsAppUrl(row.parent_phone_1, null) ?? '#'} target="_blank" rel="noopener noreferrer"
                            className="rounded-lg bg-[#E7F8EE] px-2.5 py-1 text-xs font-medium text-[#15803D]">
                            WhatsApp
                          </a>
                          <a href={`tel:${row.parent_phone_1}`}
                            className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]">
                            Call
                          </a>
                        </>
                      )}
                      <button onClick={() => setSelectedStudent(row)}
                        className="ml-auto rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-[#FF8A1F]">
                        View Detail →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      {selectedStudent && (
        <StudentOpsDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* ── Add Payment Wizard ────────────────────────────────────────────────── */}
      {showWizard && (
        <EnrollmentWizard
          branchIds={branchIds}
          onClose={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); window.location.reload() }}
        />
      )}

      {/* ── Mobile sticky action bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex gap-3 border-t border-[#E2E8F0] bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden">
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          Filters {hasFilter && '·'}
        </button>
        <button
          onClick={() => setShowWizard(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-medium text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Payment
        </button>
      </div>

      {/* Bottom padding so sticky bar doesn't overlap last card */}
      <div className="h-20 md:hidden" />
    </>
  )
}

function Select({
  value, onChange, placeholder, children,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}
