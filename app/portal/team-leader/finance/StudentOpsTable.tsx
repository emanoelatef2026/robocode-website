'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { StudentOperationsRow } from '@/modules/finance/types'
import {
  RISK_LEVEL_CLASSES, RISK_ROW_BG, RISK_FLAG_LABELS,
  STATUS_COLORS, STATUS_LABELS,
  computeSessionExhaustion,
} from '@/modules/finance/types'
import StudentOpsDrawer  from './StudentOpsDrawer'
import EnrollmentWizard   from './EnrollmentWizard'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function fmtDateShort(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Operational priority for default sort ─────────────────────────────────────
// Lower score = shows first. Mirrors the TL's daily action order.

function rowPriority(r: StudentOperationsRow): number {
  if (r.financial_status === 'BLOCKED') return 0
  if (r.financial_status === 'OVERDUE') return 1
  const exhaustion = computeSessionExhaustion(r.enrolled_sessions, r.remaining_sessions)
  if (exhaustion === 'EXHAUSTED') return 2
  if (exhaustion === 'CRITICAL')  return 3
  if (r.consecutive_absences >= 3) return 4
  if (r.sessions_attended > 0 && r.attendance_pct < 60) return 5
  if (r.sessions_attended > 0 && r.attendance_pct < 80) return 6
  if (r.sessions_attended >= 10 && r.remaining_amount > 0) return 7
  if (r.risk_level === 'HIGH')   return 8
  if (r.risk_level === 'MEDIUM') return 9
  return 10
}

// ── "Needs Action" badge ──────────────────────────────────────────────────────

function getNeedsAction(r: StudentOperationsRow): { label: string; color: string } | null {
  if (r.financial_status === 'BLOCKED')
    return { label: 'Collect Now', color: 'bg-red-100 text-red-800 border-red-300' }
  if (r.financial_status === 'OVERDUE')
    return { label: 'Collect Now', color: 'bg-red-50 text-red-600 border-red-200' }
  if (r.enrolled_sessions > 0 && r.remaining_sessions <= 0)
    return { label: 'Renew Package', color: 'bg-purple-50 text-purple-700 border-purple-200' }
  if (r.consecutive_absences >= 3)
    return { label: 'Attendance Risk', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (r.sessions_attended >= 10 && r.remaining_amount > 0)
    return { label: 'Missing Payment', color: 'bg-amber-100 text-amber-800 border-amber-300' }
  if (!r.group_id)
    return { label: 'No Group', color: 'bg-slate-50 text-slate-600 border-slate-200' }
  if (!r.instructor_name)
    return { label: 'No Instructor', color: 'bg-slate-50 text-slate-500 border-slate-200' }
  return null
}

type SortField = 'student_name' | 'attendance_pct' | 'remaining_amount' | 'next_due_date' | 'risk_level' | 'sessions_attended' | 'consecutive_absences'

interface Props {
  rows:        StudentOperationsRow[]
  branchIds:   string[]
  branches:    { id: string; name: string }[]
  groups:      { id: string; name: string }[]
  instructors: { id: string; name: string }[]
  multiBranch: boolean
}

export default function StudentOpsTable({ rows, branchIds, branches, groups, instructors, multiBranch }: Props) {
  const [searchInput,     setSearchInput]     = useState('')
  const [search,          setSearch]          = useState('')
  const [filterGroup,     setFilterGroup]     = useState('')
  const [filterInstructor,setFilterInstructor]= useState('')
  const [filterRisk,      setFilterRisk]      = useState('')
  const [filterFinStatus, setFilterFinStatus] = useState('')
  const [filterBranch,    setFilterBranch]    = useState('')
  const [overdueOnly,     setOverdueOnly]     = useState(false)
  const [sortField,       setSortField]       = useState<SortField>('risk_level')
  const [sortAsc,         setSortAsc]         = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<StudentOperationsRow | null>(null)
  const [showWizard,      setShowWizard]      = useState(false)

  // Debounced search (300 ms)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleSort = useCallback((field: SortField) => {
    setSortField(f => {
      if (f === field) { setSortAsc(a => !a); return f }
      setSortAsc(true)
      return field
    })
  }, [])

  const filtered = useMemo(() => {
    let out = rows

    if (search) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.student_name.toLowerCase().includes(q) ||
        (r.student_code ?? '').toLowerCase().includes(q) ||
        (r.parent_name  ?? '').toLowerCase().includes(q) ||
        (r.student_phone ?? '').includes(q) ||
        (r.parent_phone_1 ?? '').includes(q) ||
        (r.parent_phone_2 ?? '').includes(q)
      )
    }
    if (filterBranch)    out = out.filter(r => r.branch_id === filterBranch)
    if (filterGroup)     out = out.filter(r => r.group_id  === filterGroup)
    if (filterInstructor)out = out.filter(r => r.instructor_id === filterInstructor)
    if (filterRisk)      out = out.filter(r => r.risk_level === filterRisk)
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
      } else if (sortField === 'next_due_date') {
        diff = (a.next_due_date ?? '9999').localeCompare(b.next_due_date ?? '9999')
      } else if (sortField === 'sessions_attended') {
        diff = a.sessions_attended - b.sessions_attended
      } else if (sortField === 'consecutive_absences') {
        diff = a.consecutive_absences - b.consecutive_absences
      }
      return sortAsc ? diff : -diff
    })

    return out
  }, [rows, search, filterBranch, filterGroup, filterInstructor, filterRisk, filterFinStatus, overdueOnly, sortField, sortAsc])

  const highCount    = rows.filter(r => r.risk_level === 'HIGH').length
  const overdueCount = rows.filter(r => r.financial_status === 'OVERDUE').length
  const blockedCount = rows.filter(r => r.financial_status === 'BLOCKED').length
  const noGroupCount = rows.filter(r => !r.group_id).length

  function exportCSV() {
    const params = new URLSearchParams()
    params.set('branches', branchIds.join(','))
    if (filterFinStatus) params.set('status', filterFinStatus)
    window.open(`/api/finance/export?${params}`, '_blank')
  }

  const SortTh = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B] hover:text-[#0B1F3A]"
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
      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {highCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-600 border border-red-200">
            🔴 {highCount} HIGH risk
          </span>
        )}
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800 border border-red-300">
            🚫 {blockedCount} BLOCKED
          </span>
        )}
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 border border-amber-200">
            ⚠️ {overdueCount} overdue
          </span>
        )}
        {noGroupCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
            📋 {noGroupCount} no group
          </span>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] p-3">
          {/* Search */}
          <div className="relative min-w-50 flex-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search student, parent, phone…"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          {/* Branch filter (multi-branch only) */}
          {multiBranch && branches.length > 0 && (
            <Select value={filterBranch} onChange={setFilterBranch} placeholder="All branches">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}

          {/* Group filter */}
          {groups.length > 0 && (
            <Select value={filterGroup} onChange={setFilterGroup} placeholder="All groups">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          )}

          {/* Instructor filter */}
          {instructors.length > 0 && (
            <Select value={filterInstructor} onChange={setFilterInstructor} placeholder="All instructors">
              {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          )}

          {/* Risk filter */}
          <Select value={filterRisk} onChange={setFilterRisk} placeholder="All risk">
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </Select>

          {/* Financial status */}
          <Select value={filterFinStatus} onChange={setFilterFinStatus} placeholder="All status">
            <option value="BLOCKED">Blocked</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="CURRENT">Current</option>
            <option value="PAID">Paid</option>
          </Select>

          {/* Overdue toggle */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={e => setOverdueOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#FF8A1F]"
            />
            Overdue only
          </label>

          {/* Clear filters */}
          {(searchInput || filterBranch || filterGroup || filterInstructor || filterRisk || filterFinStatus || overdueOnly) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setFilterBranch(''); setFilterGroup(''); setFilterInstructor(''); setFilterRisk(''); setFilterFinStatus(''); setOverdueOnly(false) }}
              className="text-xs text-[#FF8A1F] hover:underline"
            >
              Clear ×
            </button>
          )}

          <span className="ml-auto text-xs text-[#94A3B8]">{filtered.length} students</span>

          {/* Export button */}
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export
          </button>

          {/* New enrollment button */}
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Enroll
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No students found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Try adjusting the filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                  <tr className="border-b border-[#E2E8F0]">
                    <SortTh field="student_name">Student</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <SortTh field="sessions_attended">Sessions</SortTh>
                    <SortTh field="attendance_pct">Att %</SortTh>
                    <SortTh field="consecutive_absences">Consec.</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Fin. Status</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Paid</th>
                    <SortTh field="remaining_amount">Remaining</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Installments</th>
                    <SortTh field="next_due_date">Next Due</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Pay %</th>
                    <SortTh field="risk_level">Priority</SortTh>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Needs Action</th>
                    <th className="sticky right-0 bg-[#F8FAFC] px-3 py-2.5 text-left text-xs font-medium text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const action = getNeedsAction(row)
                    return (
                      <tr
                        key={row.enrollment_id ?? row.student_id}
                        className={`border-b border-[#E2E8F0] last:border-0 transition-colors hover:bg-[#F8FAFC] ${RISK_ROW_BG[row.risk_level]}`}
                      >
                        {/* Student */}
                        <td className="px-3 py-2.5">
                          <button onClick={() => setSelectedStudent(row)} className="text-left">
                            <p className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{row.student_name}</p>
                            {row.student_code && <p className="text-[11px] text-[#94A3B8]">#{row.student_code}</p>}
                            {multiBranch && <p className="text-[11px] text-[#94A3B8]">{row.branch_name}</p>}
                          </button>
                        </td>

                        {/* Parent */}
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-[#0B1F3A]">{row.parent_name ?? '—'}</p>
                          {row.parent_phone_1 && <p className="text-[11px] text-[#64748B]">{row.parent_phone_1}</p>}
                        </td>

                        {/* Group */}
                        <td className="px-3 py-2.5">
                          {row.group_name
                            ? <p className="text-xs text-[#0B1F3A]">{row.group_name}</p>
                            : <span className="text-[11px] font-medium text-amber-600">No group</span>}
                          {row.group_start_date && <p className="text-[11px] text-[#94A3B8]">Since {fmtDateShort(row.group_start_date)}</p>}
                        </td>

                        {/* Instructor */}
                        <td className="px-3 py-2.5 text-xs">
                          {row.instructor_name
                            ? <span className="text-[#64748B]">{row.instructor_name}</span>
                            : <span className="font-medium text-amber-600">Unassigned</span>}
                        </td>

                        {/* Sessions */}
                        <td className="px-3 py-2.5 text-xs text-[#64748B]">
                          <span className={row.sessions_attended >= 10 && row.remaining_amount > 0 ? 'font-semibold text-amber-700' : ''}>
                            {row.sessions_attended}
                          </span>
                          <span className="text-[#94A3B8]">/{row.total_sessions}</span>
                          {row.sessions_attended >= 10 && row.remaining_amount > 0 && (
                            <p className="text-[10px] text-amber-600 font-medium">⚠ Sess. {row.sessions_attended}</p>
                          )}
                        </td>

                        {/* Attendance % */}
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold ${
                            row.attendance_pct >= 80 ? 'text-emerald-600' :
                            row.attendance_pct >= 60 ? 'text-amber-600' :
                            row.total_sessions > 0   ? 'text-red-600' :
                            'text-[#94A3B8]'
                          }`}>
                            {row.total_sessions > 0 ? `${row.attendance_pct}%` : '—'}
                          </span>
                          {row.last_attendance_date && (
                            <p className="text-[10px] text-[#94A3B8]">{fmtDateShort(row.last_attendance_date)}</p>
                          )}
                        </td>

                        {/* Consecutive absences */}
                        <td className="px-3 py-2.5">
                          <span className={`text-xs ${row.consecutive_absences >= 3 ? 'font-semibold text-red-600' : row.consecutive_absences > 0 ? 'text-amber-600' : 'text-[#94A3B8]'}`}>
                            {row.consecutive_absences > 0 ? row.consecutive_absences : '—'}
                          </span>
                        </td>

                        {/* Financial status */}
                        <td className="px-3 py-2.5">
                          {row.account_id ? (
                            row.financial_status ? (
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_COLORS[row.financial_status as keyof typeof STATUS_COLORS]}`}>
                                {STATUS_LABELS[row.financial_status as keyof typeof STATUS_LABELS]}
                              </span>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">—</span>
                            )
                          ) : (
                            <span className="text-[11px] font-medium text-amber-600">No package</span>
                          )}
                        </td>

                        {/* Paid */}
                        <td className="px-3 py-2.5 text-xs text-emerald-700">
                          {row.paid_amount > 0 ? `EGP ${fmt(row.paid_amount)}` : <span className="text-[#94A3B8]">—</span>}
                        </td>

                        {/* Remaining */}
                        <td className="px-3 py-2.5">
                          {row.account_id ? (
                            row.remaining_amount > 0 ? (
                              <span className={`text-xs font-semibold ${row.financial_status === 'OVERDUE' || row.financial_status === 'BLOCKED' ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                                EGP {fmt(row.remaining_amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-600">Paid ✓</span>
                            )
                          ) : (
                            <span className="text-[11px] font-medium text-amber-600">No package</span>
                          )}
                        </td>

                        {/* Installments */}
                        <td className="px-3 py-2.5 text-xs text-[#64748B]">
                          {row.installments_total > 0 ? (
                            <span>{row.installments_paid}/{row.installments_total}</span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>

                        {/* Next due date */}
                        <td className="px-3 py-2.5">
                          {row.next_due_date ? (
                            <span className={`text-xs ${row.days_overdue > 0 ? 'font-medium text-red-600' : 'text-[#64748B]'}`}>
                              {fmtDateShort(row.next_due_date)}
                              {row.days_overdue > 0 && <span className="block text-[10px]">{row.days_overdue}d late</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Payment % */}
                        <td className="px-3 py-2.5">
                          {row.account_id ? (
                            <div className="w-16">
                              <div className="h-1.5 w-full rounded-full bg-[#F1F5F9]">
                                <div
                                  className={`h-full rounded-full ${row.payment_progress_pct >= 80 ? 'bg-emerald-500' : row.payment_progress_pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(100, row.payment_progress_pct)}%` }}
                                />
                              </div>
                              <p className="mt-0.5 text-[10px] text-[#94A3B8]">{row.payment_progress_pct}%</p>
                            </div>
                          ) : <span className="text-xs text-[#94A3B8]">—</span>}
                        </td>

                        {/* Risk/Priority */}
                        <td className="px-3 py-2.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_LEVEL_CLASSES[row.risk_level]}`}>
                            {row.risk_level}
                          </span>
                        </td>

                        {/* Needs Action */}
                        <td className="px-3 py-2.5">
                          {action ? (
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${action.color}`}>
                              {action.label}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600">✓ OK</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="sticky right-0 bg-white px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {row.parent_phone_1 && (
                              <a
                                href={`https://wa.me/${row.parent_phone_1.replace(/\D/g, '')}`}
                                target="_blank" rel="noopener noreferrer"
                                title="WhatsApp parent"
                                className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8a7.96 7.96 0 01-4.126-1.144L2 18l1.168-3.744A7.96 7.96 0 012 10c0-4.418 3.582-8 8-8s8 3.582 8 8zm-8 6a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                                </svg>
                              </a>
                            )}
                            {row.parent_phone_1 && (
                              <a
                                href={`tel:${row.parent_phone_1}`}
                                title="Call parent"
                                className="rounded p-1 text-blue-600 hover:bg-blue-50"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                              </a>
                            )}
                            <button
                              onClick={() => setSelectedStudent(row)}
                              title="View full detail"
                              className="rounded p-1 text-[#FF8A1F] hover:bg-orange-50"
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

            {/* Mobile cards */}
            <div className="block space-y-2 p-3 md:hidden">
              {filtered.map(row => {
                const action = getNeedsAction(row)
                return (
                  <div
                    key={row.enrollment_id ?? row.student_id}
                    className={`rounded-xl border border-[#E2E8F0] p-4 ${RISK_ROW_BG[row.risk_level]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button onClick={() => setSelectedStudent(row)} className="text-left font-semibold text-[#0B1F3A]">
                          {row.student_name}
                        </button>
                        <p className="text-xs text-[#64748B]">
                          {row.group_name ?? <span className="text-amber-600">No group</span>} · {row.branch_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_LEVEL_CLASSES[row.risk_level]}`}>
                          {row.risk_level}
                        </span>
                        {action && (
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${action.color}`}>
                            {action.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[#94A3B8]">Attendance</p>
                        <p className={`font-semibold ${
                          row.attendance_pct >= 80 ? 'text-emerald-600' :
                          row.attendance_pct >= 60 ? 'text-amber-600' :
                          row.total_sessions > 0   ? 'text-red-600' :
                          'text-[#94A3B8]'
                        }`}>
                          {row.total_sessions > 0
                            ? `${row.attendance_pct}% (${row.sessions_attended}/${row.total_sessions})`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#94A3B8]">Remaining</p>
                        <p className={`font-semibold ${row.remaining_amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {row.account_id
                            ? (row.remaining_amount > 0 ? `EGP ${fmt(row.remaining_amount)}` : 'Paid ✓')
                            : <span className="text-amber-600">No package</span>}
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
                          <p className={`font-medium ${row.days_overdue > 0 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                            {fmtDateShort(row.next_due_date)}
                          </p>
                        </div>
                      )}
                    </div>

                    {row.risk_flags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.risk_flags.map(f => (
                          <span key={f} className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">
                            {RISK_FLAG_LABELS[f] ?? f}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 border-t border-[#E2E8F0] pt-2">
                      {row.parent_phone_1 && (
                        <>
                          <a href={`https://wa.me/${row.parent_phone_1.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            WhatsApp
                          </a>
                          <a href={`tel:${row.parent_phone_1}`}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
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

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      {selectedStudent && (
        <StudentOpsDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* ── Enrollment Wizard ────────────────────────────────────────────── */}
      {showWizard && (
        <EnrollmentWizard
          branchIds={branchIds}
          onClose={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); window.location.reload() }}
        />
      )}
    </>
  )
}

function Select({
  value, onChange, placeholder, children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  children: React.ReactNode
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
