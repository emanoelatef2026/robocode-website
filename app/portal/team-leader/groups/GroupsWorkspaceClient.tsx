'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import GroupFormModal from './GroupFormModal'
import EnrollmentWizard from '../finance/EnrollmentWizard'
import type { StudentResult, GroupContext } from '../finance/EnrollmentWizard'
import StudentOpsDrawer from '../finance/StudentOpsDrawer'
import StudentQuickViewModal from './StudentQuickViewModal'
import type { StudentOperationsRow } from '@/modules/finance/types'
import {
  getGroupDetailDataAction,
  deleteGroupAction,
  removeStudentFromGroupAction,
  addStudentsToGroupAction,
  editGroupSessionAction,
  deleteGroupSessionAction,
  rebuildGroupAttendanceAction,
} from '@/modules/groups/modal-actions'
import type { GroupDetailData, GroupDetailStudent, GroupDetailSession } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'
import { buildWhatsAppUrl, buildTelUrl } from '@/lib/phone'
import GroupAttendanceModal from './GroupAttendanceModal'

// ════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════

const DAYS_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function fmt12(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function parseLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const clean = iso.slice(0, 10)
  const [y, m, d] = clean.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtCurrency(n: number): string {
  if (!n) return '—'
  return n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
}


// ════════════════════════════════════════════════════════════════════
//  FILTER TYPES
// ════════════════════════════════════════════════════════════════════

type QuickFilter =
  | '' | 'active' | 'forming' | 'no_instructor'
  | 'low_attendance' | 'low_capacity' | 'overloaded' | 'starts_soon' | 'archived'

interface Filters {
  q:           string
  branch_id:   string
  quickFilter: QuickFilter
}

const DEFAULT_FILTERS: Filters = { q: '', branch_id: '', quickFilter: '' }

function applyFilters(groups: GroupOperationalRow[], f: Filters): GroupOperationalRow[] {
  return groups.filter(g => {
    if (f.branch_id && g.branch_id !== f.branch_id) return false
    if (f.quickFilter === 'active'         && g.status !== 'active')                                       return false
    if (f.quickFilter === 'forming'        && g.status !== 'forming')                                      return false
    if (f.quickFilter === 'no_instructor'  && g.has_instructor)                                            return false
    if (f.quickFilter === 'low_attendance' && !g.is_low_attendance)                                        return false
    if (f.quickFilter === 'low_capacity'   && !g.is_low_capacity)                                          return false
    if (f.quickFilter === 'overloaded'     && !g.is_overloaded)                                            return false
    if (f.quickFilter === 'starts_soon'    && !g.starts_soon)                                              return false
    if (f.quickFilter === 'archived'       && g.status !== 'cancelled' && g.status !== 'archived')         return false
    if (f.q) {
      const q   = f.q.toLowerCase()
      const hay = [g.name, g.code, g.lead_instructor_name, g.course_name, g.branch_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
//  KPI DATA
// ════════════════════════════════════════════════════════════════════

function buildKpis(groups: GroupOperationalRow[]) {
  return [
    { label: 'Active',         value: groups.filter(g => g.status === 'active').length,   color: 'bg-blue-400'   },
    { label: 'Low Attendance', value: groups.filter(g => g.is_low_attendance).length,      color: 'bg-red-400'    },
    { label: 'No Instructor',  value: groups.filter(g => !g.has_instructor).length,        color: 'bg-amber-400'  },
    { label: 'Under Capacity', value: groups.filter(g => g.is_low_capacity).length,        color: 'bg-orange-400' },
    { label: 'Overloaded',     value: groups.filter(g => g.is_overloaded).length,          color: 'bg-purple-400' },
    { label: 'Starting Soon',  value: groups.filter(g => g.starts_soon).length,            color: 'bg-teal-400'   },
  ]
}

// ════════════════════════════════════════════════════════════════════
//  SHARED BADGES
// ════════════════════════════════════════════════════════════════════

function StatusChip({ status }: { status: string }) {
  const cls = status === 'active'    ? 'bg-green-100 text-green-700'
            : status === 'forming'   ? 'bg-blue-100 text-blue-700'
            : status === 'completed' ? 'bg-slate-100 text-slate-500'
                                     : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{status}</span>
}

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = level === 'HIGH'   ? 'bg-red-100 text-red-700'
            : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700'
                                 : 'bg-green-100 text-green-700'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{level}</span>
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  COMPACT GROUP LIST ITEM
// ════════════════════════════════════════════════════════════════════

function GroupListItem({
  group, selected, onClick,
}: {
  group:    GroupOperationalRow
  selected: boolean
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2 border-b border-[#F1F5F9] transition-colors',
        selected
          ? 'bg-[#FFF7ED] border-l-[3px] border-l-[#FF8A1F]'
          : 'active:bg-[#F8FAFC] border-l-[3px] border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#0B1F3A] truncate">{group.name}</p>
        <StatusChip status={group.status} />
      </div>
      <p className="mt-0.5 text-[11px] text-[#94A3B8]">
        {group.student_count} student{group.student_count !== 1 ? 's' : ''}
        {group.day_of_week ? <span className="ml-1.5 capitalize">{group.day_of_week.slice(0, 3)}</span> : null}
      </p>
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════
//  LEFT SIDEBAR — search, filters, group list
// ════════════════════════════════════════════════════════════════════

const QUICK_FILTER_OPTIONS: {
  value: QuickFilter
  label: string
  count: (g: GroupOperationalRow[]) => number
}[] = [
  { value: '',               label: 'All Groups',     count: g => g.length                              },
  { value: 'active',         label: 'Active',         count: g => g.filter(x => x.status === 'active').length },
  { value: 'forming',        label: 'Forming',        count: g => g.filter(x => x.status === 'forming').length },
  { value: 'no_instructor',  label: 'No Instructor',  count: g => g.filter(x => !x.has_instructor).length      },
  { value: 'low_attendance', label: 'Low Attendance', count: g => g.filter(x => x.is_low_attendance).length    },
  { value: 'low_capacity',   label: 'Under Capacity', count: g => g.filter(x => x.is_low_capacity).length      },
  { value: 'overloaded',     label: 'Full',           count: g => g.filter(x => x.is_overloaded).length        },
  { value: 'starts_soon',    label: 'Starting Soon',  count: g => g.filter(x => x.starts_soon).length          },
  { value: 'archived',       label: 'Archived',       count: g => g.filter(x => x.status === 'cancelled' || x.status === 'archived').length },
]

function GroupSidebar({
  groups, allGroups, filters, onFilterChange, options,
  selectedId, onSelect, isTL, onCreateGroup,
}: {
  groups:          GroupOperationalRow[]
  allGroups:       GroupOperationalRow[]
  filters:         Filters
  onFilterChange:  (patch: Partial<Filters>) => void
  options:         GroupFormOptions
  selectedId:      string | null
  onSelect:        (g: GroupOperationalRow) => void
  isTL:            boolean
  onCreateGroup:   () => void
}) {
  const baseFiltered   = applyFilters(allGroups, { ...filters, quickFilter: '' })
  const searchFiltered = applyFilters(allGroups, { q: filters.q, branch_id: '', quickFilter: '' })

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-[#0B1F3A] md:text-[13px]">Groups</h2>
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
            {groups.length}{groups.length !== allGroups.length ? ` / ${allGroups.length}` : ''}
          </span>
        </div>
        {isTL && (
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#e87c18] transition"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Group
          </button>
        )}
      </div>

      {/* Search + branch + quick filter */}
      <div className="border-b border-[#E2E8F0] px-3 py-2 space-y-1.5 shrink-0">
        <input
          type="text"
          value={filters.q}
          onChange={e => onFilterChange({ q: e.target.value })}
          placeholder="Search name, instructor, course…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
        />
        <div className={options.branches.length > 1 ? "grid grid-cols-2 gap-1.5" : ""}>
          {options.branches.length > 1 && (
            <select
              value={filters.branch_id}
              onChange={e => onFilterChange({ branch_id: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F]"
            >
              <option value="">All Branches ({searchFiltered.length})</option>
              {options.branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({searchFiltered.filter(g => g.branch_id === b.id).length})
                </option>
              ))}
            </select>
          )}
          <select
            value={filters.quickFilter}
            onChange={e => onFilterChange({ quickFilter: e.target.value as QuickFilter })}
            className={[
              'w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none focus:border-[#FF8A1F] transition',
              filters.quickFilter
                ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F] font-medium'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#374151]',
            ].join(' ')}
          >
            {QUICK_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.count(baseFiltered)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Group list — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-9 w-9 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-[12px]">No groups found.</p>
          </div>
        ) : (
          groups.map(g => (
            <GroupListItem
              key={g.group_id}
              group={g}
              selected={g.group_id === selectedId}
              onClick={() => onSelect(g)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  GROUP ACTIONS DROPDOWN
// ════════════════════════════════════════════════════════════════════

function GroupActionsDropdown({
  group, onRecordAttendance, onAddStudent, onEdit, onDelete,
}: {
  group:              GroupOperationalRow
  onRecordAttendance: () => void
  onAddStudent:       () => void
  onEdit:             () => void
  onDelete:           () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#e87c18] transition"
      >
        Actions
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-xl">

            {/* Record Attendance — primary action */}
            <button
              onClick={() => { setOpen(false); onRecordAttendance() }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold text-[#FF8A1F] hover:bg-[#FFF7ED] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Record Attendance
            </button>

            <div className="my-1 border-t border-[#F1F5F9]" />

            {/* Add Student */}
            <button
              onClick={() => { setOpen(false); onAddStudent() }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8] shrink-0">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              Add Student
            </button>

            <div className="my-1 border-t border-[#F1F5F9]" />

            {/* Edit Group */}
            <button
              onClick={() => { setOpen(false); onEdit() }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8] shrink-0">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Edit Group
            </button>

            {/* Delete Group */}
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete Group
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  GROUP SUMMARY BAR — compact header for selected group
// ════════════════════════════════════════════════════════════════════

function GroupSummaryBar({
  group, sessionsCompleted, isTL, onEdit, onDelete, onRecordAttendance, onAddStudent,
}: {
  group:              GroupOperationalRow
  sessionsCompleted:  number
  isTL:               boolean
  onEdit:             (g: GroupOperationalRow) => void
  onDelete:           () => void
  onRecordAttendance: () => void
  onAddStudent:       () => void
}) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted]   = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!infoOpen) return
    const close = () => { setInfoOpen(false); setPopupPos(null) }
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [infoOpen])

  function handleToggle() {
    if (infoOpen) {
      setInfoOpen(false); setPopupPos(null)
    } else {
      const rect = barRef.current?.getBoundingClientRect()
      if (rect) setPopupPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
      setInfoOpen(true)
    }
  }

  const sched = [
    group.day_of_week ? DAYS_FULL[group.day_of_week] : null,
    fmt12(group.start_time),
    group.duration_minutes ? `${group.duration_minutes}m` : null,
  ].filter(Boolean).join(' · ')

  const attPct = group.attendance_avg || 0

  const activeAlloc = group.active_allocation
  const instrDisplay = activeAlloc
    ? `${activeAlloc.instructor_name} (Sessions ${activeAlloc.from_session}–${activeAlloc.to_session ?? '∞'})`
    : group.status === 'handoff_pending'
      ? 'Awaiting Instructor Handoff'
      : (group.lead_instructor_name ?? '—')

  const infoItems: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: 'Course', value: group.course_name ?? '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>,
    },
    {
      label: 'Instructor', value: instrDisplay,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Branch', value: group.branch_name,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Schedule', value: sched || '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Start Date', value: fmtDate(group.start_date),
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
    },
    ...(group.end_date ? [{
      label: 'End Date', value: fmtDate(group.end_date),
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
    }] : []),
    {
      label: 'Capacity', value: group.capacity ? `${group.student_count} / ${group.capacity}` : `${group.student_count}`,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" /></svg>,
    },
    {
      label: 'Sessions', value: `${sessionsCompleted} done`,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Avg Att.', value: attPct > 0 ? `${attPct}%` : '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
    },
  ]

  return (
    <div ref={barRef} className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 shrink-0">
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        {/* Name + code + status */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-[#0B1F3A] truncate">{group.name}</h2>
          {group.code && (
            <span className="font-mono text-[11px] text-[#94A3B8] shrink-0 hidden sm:inline">{group.code}</span>
          )}
          <StatusChip status={group.status} />
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {group.meeting_link && (
            <a
              href={group.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F1F5F9] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#FF8A1F]">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              Meeting
            </a>
          )}

          {/* Info popup toggle */}
          <button
            onClick={handleToggle}
            aria-label={infoOpen ? 'Close group details' : 'View group details'}
            className={[
              'flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors duration-150',
              infoOpen
                ? 'bg-[#FF8A1F]/10 text-[#FF8A1F] hover:bg-[#FF8A1F]/20'
                : 'text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B]',
            ].join(' ')}
          >
            <span className="text-[12px] font-medium">Group details</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition-transform duration-200 ${infoOpen ? 'rotate-180' : ''}`}
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isTL && (
            <GroupActionsDropdown
              group={group}
              onRecordAttendance={onRecordAttendance}
              onAddStudent={onAddStudent}
              onEdit={() => onEdit(group)}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>

      {/* Info popup — floats over content via portal */}
      {mounted && infoOpen && popupPos && createPortal(
        <>
          {/* Backdrop — closes popup on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setInfoOpen(false); setPopupPos(null) }}
          />
          {/* Floating panel */}
          <div
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width, zIndex: 50 }}
            className="rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
              {infoItems.map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <span className="shrink-0 text-[#94A3B8]">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] leading-none mb-0.5">{item.label}</p>
                    <p className="text-[12px] font-semibold text-[#374151] truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SELECTION TOOLBAR — labeled bulk actions + Move Group
// ════════════════════════════════════════════════════════════════════

function StudentSelectionToolbar({
  students, selectedIds, isTL, onRemove, onAddPayment, onMoveGroup, onView, onClear,
}: {
  students:     GroupDetailStudent[]
  selectedIds:  Set<string>
  isTL:         boolean
  onRemove:     (ids: string[]) => void
  onAddPayment: (student: GroupDetailStudent) => void
  onMoveGroup:  () => void
  onView:       (student: GroupDetailStudent) => void
  onClear:      () => void
}) {
  const [removeConfirm, setRemoveConfirm] = useState(false)

  const selected  = students.filter(s => selectedIds.has(s.student_id))
  const single    = selected.length === 1 ? selected[0] : null
  const firstWa   = selected.find(s => s.parent_phone ?? s.phone)
  const waUrl     = firstWa ? buildWhatsAppUrl(firstWa.parent_phone, firstWa.phone) : null
  const callUrl   = single  ? buildTelUrl(single.parent_phone, single.phone) : null

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#FF8A1F]/40 bg-[#FFF7ED] px-2.5 py-1.5 flex-wrap">
      <span className="text-[11px] font-bold text-[#FF8A1F] mr-1">
        {selectedIds.size} selected
      </span>
      <div className="h-3.5 w-px bg-[#FF8A1F]/30 mr-0.5" />

      {/* WhatsApp */}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={selected.length > 1 ? `WhatsApp first (${selected.length} selected)` : 'WhatsApp'}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 transition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
      )}

      {/* Call — single only */}
      {callUrl && (
        <a
          href={callUrl}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Call
        </a>
      )}

      {/* View Student — single only, opens modal */}
      {single && (
        <button
          onClick={() => onView(single)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View
        </button>
      )}

      {/* Payment — single + TL only */}
      {single && isTL && (
        <button
          onClick={() => onAddPayment(single)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#FF8A1F] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          Payment
        </button>
      )}

      {/* Move Group — TL only */}
      {isTL && (
        <button
          onClick={onMoveGroup}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-white transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Move Group
        </button>
      )}

      {/* Remove — TL only, inline confirm */}
      {isTL && (
        removeConfirm ? (
          <span className="flex items-center gap-1 ml-1">
            <button
              onClick={() => { setRemoveConfirm(false); onRemove(Array.from(selectedIds)) }}
              className="rounded px-2 py-1 text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition"
            >
              Confirm Remove ({selectedIds.size})
            </button>
            <button
              onClick={() => setRemoveConfirm(false)}
              className="rounded p-1 text-[#94A3B8] hover:text-[#374151] hover:bg-white transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </span>
        ) : (
          <button
            onClick={() => setRemoveConfirm(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h7m5-5l4 4m0 0l4-4m-4 4V7" />
            </svg>
            Remove
          </button>
        )
      )}

      <div className="h-3.5 w-px bg-[#FF8A1F]/30 ml-0.5" />

      {/* Clear */}
      <button
        onClick={() => { setRemoveConfirm(false); onClear() }}
        title="Clear selection"
        className="rounded p-1 text-[#94A3B8] hover:text-[#374151] hover:bg-white transition"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  HIGH-DENSITY STUDENTS TABLE — py-1.5 rows, 12 columns incl. Joined
// ════════════════════════════════════════════════════════════════════

function GroupStudentsTable({
  students, loading, selectedIds, onToggleStudent, onToggleAll,
}: {
  students:        GroupDetailStudent[]
  loading:         boolean
  selectedIds:     Set<string>
  onToggleStudent: (id: string) => void
  onToggleAll:     () => void
}) {
  if (loading && !students.length) return <LoadingSpinner />

  if (!students.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-10 w-10 opacity-40">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No students enrolled yet.</p>
      </div>
    )
  }

  const sorted = [...students].sort((a, b) => {
    const ro: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (ro[a.risk_level] ?? 3) - (ro[b.risk_level] ?? 3)
  })

  const allSelected = sorted.length > 0 && sorted.every(s => selectedIds.has(s.student_id))

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full text-sm min-w-240">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
            <th className="pl-3 pr-2 py-2 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-3.5 w-3.5 cursor-pointer rounded border-[#CBD5E1] accent-[#FF8A1F]"
              />
            </th>
            <th className="w-7 px-1 py-2 text-center text-[11px] font-semibold text-[#94A3B8]">#</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Student</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B]">Age</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Stu. Phone</th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Par. Phone</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Sessions</th>
            <th className="px-2 py-2 text-center text-[11px] font-semibold text-[#64748B]">Left</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Subscription</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B]">Paid</th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#64748B]">Remaining</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#64748B]">Risk</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-[#64748B]">Joined</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, idx) => {
            const isSelected = selectedIds.has(s.student_id)

            const attColor = s.attendance_pct >= 75 ? 'text-green-600'
                           : s.attendance_pct >= 60 ? 'text-amber-600'
                           : s.attendance_pct > 0   ? 'text-red-600'
                                                    : 'text-[#CBD5E1]'

            const sessStat = s.sessions_used != null && s.sessions_total != null
              ? `${s.sessions_used}/${s.sessions_total}`
              : s.sessions_used != null ? `${s.sessions_used}` : '—'

            const sessLeft      = s.sessions_remaining
            const sessLeftColor = sessLeft != null && sessLeft <= 2
              ? 'text-red-600 font-semibold'
              : 'text-[#374151]'

            return (
              <tr
                key={s.student_id}
                onClick={() => onToggleStudent(s.student_id)}
                className={[
                  'border-b border-[#F1F5F9] cursor-pointer transition-colors',
                  isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#FAFAFA]',
                ].join(' ')}
              >
                {/* Checkbox */}
                <td className="pl-3 pr-2 py-1.5 w-8" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleStudent(s.student_id)}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-[#CBD5E1] accent-[#FF8A1F]"
                  />
                </td>

                {/* # */}
                <td className="w-7 px-1 py-1.5 text-center text-[11px] font-semibold text-[#94A3B8]">
                  {idx + 1}
                </td>

                {/* Student — name + code + att% */}
                <td className="px-3 py-1.5">
                  <p className="text-[12px] font-semibold text-[#0B1F3A] whitespace-nowrap leading-tight">{s.student_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {s.student_code && (
                      <span className="font-mono text-[10px] text-[#94A3B8]">{s.student_code}</span>
                    )}
                    {s.attendance_pct > 0 && (
                      <span className={`text-[10px] font-semibold ${attColor}`}>{s.attendance_pct}%</span>
                    )}
                  </div>
                </td>

                {/* Age */}
                <td className="px-2 py-1.5 text-center text-[11px] text-[#64748B]">
                  {s.age != null ? `${s.age}y` : '—'}
                </td>

                {/* Student phone */}
                <td className="px-3 py-1.5">
                  <span className="font-mono text-[11px] text-[#374151] whitespace-nowrap">{s.phone ?? '—'}</span>
                </td>

                {/* Parent phone */}
                <td className="px-3 py-1.5">
                  <span className="font-mono text-[11px] text-[#374151] whitespace-nowrap">{s.parent_phone ?? '—'}</span>
                </td>

                {/* Sessions used/total */}
                <td className="px-2 py-1.5 text-center text-[11px] text-[#64748B] whitespace-nowrap">
                  {sessStat}
                </td>

                {/* Sessions remaining */}
                <td className="px-2 py-1.5 text-center">
                  <span className={`text-[11px] ${sessLeftColor}`}>
                    {sessLeft != null ? sessLeft : '—'}
                  </span>
                </td>

                {/* Subscription */}
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {s.subscription_amount
                    ? <span className="text-[11px] text-[#374151]">{fmtCurrency(s.subscription_amount)}</span>
                    : <span className="text-[10px] text-[#CBD5E1]">No Package</span>
                  }
                </td>

                {/* Paid */}
                <td className="px-3 py-1.5 text-right text-[11px] text-[#374151] whitespace-nowrap">
                  {s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'}
                </td>

                {/* Balance */}
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  <span className={`text-[11px] ${s.remaining_balance > 0 ? 'text-red-600 font-semibold' : 'text-[#94A3B8]'}`}>
                    {s.remaining_balance > 0 ? fmtCurrency(s.remaining_balance) : '—'}
                  </span>
                </td>

                {/* Risk */}
                <td className="px-3 py-1.5 text-center">
                  <RiskBadge level={s.risk_level} />
                </td>

                {/* Joined */}
                <td className="px-3 py-1.5 text-center text-[11px] text-[#94A3B8] whitespace-nowrap">
                  {fmtDateShort(s.joined_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  ATTENDANCE TAB — full session management
// ════════════════════════════════════════════════════════════════════

const WS_ATT_STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const
type WsAttStatus = typeof WS_ATT_STATUSES[number]

function wsAttCls(s: string): string {
  if (s === 'present') return 'bg-emerald-100 text-emerald-700'
  if (s === 'late')    return 'bg-amber-100 text-amber-700'
  if (s === 'absent')  return 'bg-red-100 text-red-700'
  if (s === 'excused') return 'bg-blue-100 text-blue-700'
  if (s === 'makeup')  return 'bg-purple-100 text-purple-700'
  return 'bg-slate-100 text-slate-500'
}

function WsSessionEditForm({
  session, students, onSave, onCancel,
}: {
  session:  GroupDetailSession
  students: GroupDetailStudent[]
  onSave:   (patch: Parameters<typeof editGroupSessionAction>[1]) => Promise<void>
  onCancel: () => void
}) {
  const toLocalISO = (iso: string) => {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const [datetime, setDatetime] = useState(toLocalISO(session.scheduled_at))
  const [topic,    setTopic]    = useState(session.topic ?? '')
  const [duration, setDuration] = useState(String(session.duration_minutes || 60))
  const [delivery, setDelivery] = useState<'online' | 'offline'>(
    session.delivery === 'offline' ? 'offline' : 'online'
  )
  const [statuses, setStatuses] = useState<Record<string, WsAttStatus>>(() => {
    const m: Record<string, WsAttStatus> = {}
    for (const s of students) {
      const rec = session.student_attendance.find(r => r.student_id === s.student_id)
      m[s.student_id] = (rec?.status ?? 'present') as WsAttStatus
    }
    return m
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const originalISO = toLocalISO(session.scheduled_at)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const patch: Parameters<typeof editGroupSessionAction>[1] = {
        student_statuses: students.map(s => ({
          student_id: s.student_id,
          status:     statuses[s.student_id] ?? 'present',
        })),
      }
      if (topic.trim() !== (session.topic ?? '').trim())                      patch.topic            = topic.trim()
      const dur = Number(duration) || 60
      if (dur !== session.duration_minutes)                                    patch.duration_minutes = dur
      if (delivery !== (session.delivery === 'offline' ? 'offline' : 'online')) patch.delivery       = delivery
      if (datetime !== originalISO)                                            patch.scheduled_at     = new Date(datetime).toISOString()
      await onSave(patch)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[#FF8A1F]/30 bg-orange-50/30 p-3 space-y-3">
      <p className="text-[11px] font-semibold text-[#0B1F3A]">Edit Session</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Date &amp; Time</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
          {datetime !== originalISO && (
            <p className="mt-0.5 text-[9px] text-amber-600">⚠ Date change re-evaluates package eligibility</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Duration (min)</label>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
            min={15} max={240} step={15}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Topic</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. CSS Selectors…"
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Delivery</label>
          <div className="flex gap-2 mt-0.5">
            {(['online', 'offline'] as const).map(d => (
              <button key={d} type="button" onClick={() => setDelivery(d)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-medium border transition ${
                  delivery === d
                    ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#FF8A1F]'
                }`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {students.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1.5">Attendance Statuses</label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-[#0B1F3A] truncate flex-1 min-w-0">{s.student_name}</span>
                <div className="flex gap-1 shrink-0">
                  {WS_ATT_STATUSES.map(st => (
                    <button key={st} type="button"
                      onClick={() => setStatuses(prev => ({ ...prev, [s.student_id]: st }))}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition ${
                        statuses[s.student_id] === st
                          ? wsAttCls(st)
                          : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]'
                      }`}>
                      {st === 'makeup' ? 'mkp' : st.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[10px] text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save & Recalculate'}
        </button>
      </div>
    </div>
  )
}

function WsSessionRow({
  session, students, confirmId, deletingId, editingId,
  onConfirmOpen, onConfirmClose, onDelete, onEditOpen, onEditClose, onEditSave,
}: {
  session:        GroupDetailSession
  students:       GroupDetailStudent[]
  confirmId:      string | null
  deletingId:     string | null
  editingId:      string | null
  onConfirmOpen:  (id: string) => void
  onConfirmClose: () => void
  onDelete:       (id: string) => void
  onEditOpen:     (id: string) => void
  onEditClose:    () => void
  onEditSave:     (id: string, patch: Parameters<typeof editGroupSessionAction>[1]) => Promise<void>
}) {
  const isPast     = new Date(session.scheduled_at) < new Date()
  const fmt        = new Date(session.scheduled_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const statusCls  = session.status === 'completed' ? 'bg-green-100 text-green-700'
                   : session.status === 'scheduled'  ? 'bg-blue-100 text-blue-700'
                                                     : 'bg-[#F1F5F9] text-[#64748B]'
  const isConfirming = confirmId  === session.id
  const isDeleting   = deletingId === session.id
  const isEditing    = editingId  === session.id

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {session.session_number != null && (
              <span className="text-[10px] font-semibold text-[#94A3B8]">#{session.session_number}</span>
            )}
            <p className={`text-[13px] font-medium ${isPast ? 'text-[#0B1F3A]' : 'text-[#374151]'}`}>{fmt}</p>
            {session.delivery && (
              <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${
                session.delivery === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
              }`}>{session.delivery}</span>
            )}
          </div>
          {session.topic && (
            <p className="mt-0.5 text-[11px] text-[#64748B] truncate">{session.topic}</p>
          )}
          {session.status === 'completed' && (
            <div className="mt-1 flex items-center gap-2">
              {session.present_count > 0 && (
                <span className="text-[10px] font-medium text-emerald-600">✓ {session.present_count} present</span>
              )}
              {session.absent_count > 0 && (
                <span className="text-[10px] font-medium text-red-500">✗ {session.absent_count} absent</span>
              )}
              {session.present_count === 0 && session.absent_count === 0 && (
                <span className="text-[10px] text-[#94A3B8]">No attendance recorded</span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
            {session.status}
          </span>
          {session.duration_minutes > 0 && (
            <span className="text-[10px] text-[#94A3B8]">{session.duration_minutes}min</span>
          )}
          {session.status === 'completed' && !isConfirming && !isEditing && (
            <div className="flex gap-2">
              <button onClick={() => onEditOpen(session.id)}
                className="text-[10px] text-[#64748B] hover:text-[#0B1F3A] transition">Edit</button>
              <button onClick={() => onConfirmOpen(session.id)}
                className="text-[10px] text-red-400 hover:text-red-600 transition">Delete</button>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <WsSessionEditForm
          session={session}
          students={students}
          onSave={patch => onEditSave(session.id, patch)}
          onCancel={onEditClose}
        />
      )}

      {isConfirming && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <span className="flex-1 text-[11px] text-red-700">Delete session? This reverses all package consumptions.</span>
          <button onClick={onConfirmClose}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button onClick={() => onDelete(session.id)} disabled={isDeleting}
            className="rounded bg-red-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-600 transition disabled:opacity-50">
            {isDeleting ? '…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}

function GroupAttendanceTab({
  sessions, students, group, loading, isTL, onOpenAddSession, onSessionsChanged,
}: {
  sessions:          GroupDetailSession[]
  students:          GroupDetailStudent[]
  group:             GroupOperationalRow
  loading:           boolean
  isTL:              boolean
  onOpenAddSession:  () => void
  onSessionsChanged: () => void
}) {
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [toast,      setToast]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  if (loading && !sessions.length) return <LoadingSpinner />

  const now      = new Date()
  const past     = sessions.filter(s => new Date(s.scheduled_at) < now)
  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= now)

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDelete(scheduleId: string) {
    setDeletingId(scheduleId)
    try {
      await deleteGroupSessionAction(scheduleId)
      setConfirmId(null)
      onSessionsChanged()
      showToast('success', 'Session deleted — package consumption reversed')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleEditSave(
    scheduleId: string,
    patch: Parameters<typeof editGroupSessionAction>[1],
  ) {
    const res = await editGroupSessionAction(scheduleId, patch)
    if (!res.success) throw new Error(res.error ?? 'Save failed')
    setEditingId(null)
    onSessionsChanged()
    showToast('success', 'Session updated — consumption recalculated')
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const res = await rebuildGroupAttendanceAction(group.group_id)
      onSessionsChanged()
      showToast('success', `Rebuilt — ${res.fixed_enrollments} enrollment(s) corrected`)
    } catch {
      showToast('error', 'Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Avg Attendance',
            value: group.attendance_avg > 0 ? `${group.attendance_avg}%` : '—',
            color: group.attendance_avg >= 75 ? 'text-green-600'
                 : group.attendance_avg >= 60 ? 'text-amber-600'
                 : group.attendance_avg  >  0 ? 'text-red-600'
                                              : 'text-[#0B1F3A]',
          },
          { label: 'Students',     value: String(group.student_count), color: 'text-[#0B1F3A]' },
          { label: 'Sessions Done', value: String(past.length),        color: 'text-[#0B1F3A]' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {isTL && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-[#94A3B8]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            {past.length > 0 && <span className="ml-1 text-emerald-600">· {past.length} recorded</span>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              title="Recalculate package consumption for all students"
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition disabled:opacity-50"
            >
              {rebuilding ? 'Rebuilding…' : 'Rebuild'}
            </button>
            <button
              onClick={() => { setEditingId(null); onOpenAddSession() }}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition"
            >
              + Add Session
            </button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Upcoming</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.slice(0, 5).map(s => (
              <WsSessionRow
                key={s.id} session={s} students={students}
                confirmId={confirmId} deletingId={deletingId} editingId={editingId}
                onConfirmOpen={id => setConfirmId(id)} onConfirmClose={() => setConfirmId(null)}
                onDelete={handleDelete} onEditOpen={id => setEditingId(id)}
                onEditClose={() => setEditingId(null)} onEditSave={handleEditSave}
              />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recorded Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {past.map(s => (
              <WsSessionRow
                key={s.id} session={s} students={students}
                confirmId={confirmId} deletingId={deletingId} editingId={editingId}
                onConfirmOpen={id => setConfirmId(id)} onConfirmClose={() => setConfirmId(null)}
                onDelete={handleDelete} onEditOpen={id => setEditingId(id)}
                onEditClose={() => setEditingId(null)} onEditSave={handleEditSave}
              />
            ))}
          </div>
        </div>
      )}

      {!past.length && !upcoming.length && !isTL && (
        <p className="py-10 text-center text-sm text-[#94A3B8]">No sessions recorded yet.</p>
      )}
      {!past.length && !upcoming.length && isTL && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#94A3B8] mb-3">No sessions recorded yet.</p>
          <button onClick={onOpenAddSession}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition">
            + Add First Session
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  FINANCE TAB
// ════════════════════════════════════════════════════════════════════

function GroupFinanceTab({ students, loading }: { students: GroupDetailStudent[]; loading: boolean }) {
  if (loading && !students.length) return <LoadingSpinner />

  const totalPaid      = students.reduce((s, st) => s + (st.paid_amount ?? 0), 0)
  const totalBalance   = students.reduce((s, st) => s + (st.remaining_balance ?? 0), 0)
  const overdueCount   = students.filter(s => s.payment_status === 'OVERDUE').length
  const exhaustedCount = students.filter(s => (s.sessions_remaining ?? 1) <= 0).length

  const sorted = [...students].sort((a, b) => {
    const order: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, CURRENT: 2, PAID: 3 }
    return (order[a.payment_status ?? ''] ?? 4) - (order[b.payment_status ?? ''] ?? 4)
  })

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Collected', value: totalPaid > 0 ? fmtCurrency(totalPaid) : '—', alert: false },
          { label: 'Outstanding',     value: totalBalance > 0 ? fmtCurrency(totalBalance) : '—', alert: totalBalance > 0 },
          { label: 'Overdue',         value: String(overdueCount),   alert: overdueCount > 0   },
          { label: 'Exhausted Pkgs',  value: String(exhaustedCount), alert: exhaustedCount > 0 },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.alert ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#94A3B8]">No finance data available.</p>
        ) : sorted.map(s => {
          const sessLeft    = s.sessions_remaining ?? null
          const isExhausted = sessLeft != null && sessLeft <= 0
          return (
            <div key={s.student_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
                <div className="flex items-center flex-wrap gap-2 mt-0.5">
                  {sessLeft != null && (
                    <span className={`text-[11px] ${isExhausted ? 'text-red-600 font-semibold' : 'text-[#64748B]'}`}>
                      {sessLeft} sess. left
                    </span>
                  )}
                  {s.subscription_amount != null && s.subscription_amount > 0 && (
                    <span className="text-[11px] text-[#64748B]">Pkg: {fmtCurrency(s.subscription_amount)}</span>
                  )}
                  {s.paid_amount > 0 && (
                    <span className="text-[11px] text-green-600">Paid: {fmtCurrency(s.paid_amount)}</span>
                  )}
                  {s.remaining_balance > 0 && (
                    <span className="text-[11px] text-red-600 font-medium">Due: {fmtCurrency(s.remaining_balance)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.payment_status && (
                  <span className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    s.payment_status === 'PAID'     ? 'bg-green-100 text-green-700'
                    : s.payment_status === 'OVERDUE'  ? 'bg-red-100 text-red-700'
                    : s.payment_status === 'DUE_SOON' ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-blue-100 text-blue-700',
                  ].join(' ')}>
                    {s.payment_status === 'DUE_SOON' ? 'Due Soon' : s.payment_status.charAt(0) + s.payment_status.slice(1).toLowerCase()}
                  </span>
                )}
                {isExhausted && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">EXHAUSTED</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  PERFORMANCE TAB
// ════════════════════════════════════════════════════════════════════

function GroupPerformanceTab({ group }: { group: GroupOperationalRow }) {
  const metrics = [
    { label: 'Attendance',   value: group.attendance_avg, desc: 'Group avg attendance rate'  },
    { label: 'Assignments',  value: group.assignment_avg, desc: 'Homework completion rate'    },
    { label: 'Portfolio',    value: group.portfolio_avg,  desc: 'Portfolio submission rate'   },
    { label: 'Health Score', value: group.health_score,   desc: 'Overall group health score'  },
  ]

  const alerts = [
    group.is_low_attendance && 'Low attendance (< 60%)',
    group.is_low_capacity   && 'Under capacity (< 50% filled)',
    group.is_overloaded     && 'Overloaded (≥ 90% filled)',
    !group.has_instructor   && 'No lead instructor assigned',
    !group.has_course       && 'No course assigned',
  ].filter(Boolean) as string[]

  return (
    <div className="p-4 space-y-4">
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="mb-2 text-[12px] font-semibold text-amber-700">Active Alerts</p>
          <ul className="space-y-1">
            {alerts.map(a => (
              <li key={a} className="flex items-center gap-2 text-[12px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-5">
        {metrics.map(m => (
          <div key={m.label}>
            <div className="flex items-start justify-between mb-1.5">
              <div>
                <p className="text-[13px] font-semibold text-[#374151]">{m.label}</p>
                <p className="text-[11px] text-[#94A3B8]">{m.desc}</p>
              </div>
              <span className={`text-[15px] font-bold ${
                m.value >= 75 ? 'text-green-600' :
                m.value >= 60 ? 'text-amber-600' :
                m.value > 0   ? 'text-red-600'   : 'text-[#94A3B8]'
              }`}>
                {m.value > 0 ? `${m.value}%` : '—'}
              </span>
            </div>
            {m.value > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className={`h-full rounded-full ${m.value >= 75 ? 'bg-green-500' : m.value >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, m.value)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {alerts.length === 0 && group.health_score >= 75 && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700 font-medium">
          This group is performing well ✓
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  QUICK ADD STUDENT MODAL
// ════════════════════════════════════════════════════════════════════

function QuickAddStudentModal({
  isOpen, group, studentOptions, currentStudentIds, onClose, onAdded,
}: {
  isOpen:            boolean
  group:             GroupOperationalRow
  studentOptions:    GroupStudentOption[]
  currentStudentIds: string[]
  onClose:           () => void
  onAdded:           () => void
}) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError]       = useState<string | null>(null)
  const [, startT]              = useTransition()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) { setSearch(''); setSelected(new Set()); setError(null) }
  }, [isOpen])

  if (!isOpen) return null

  const eligible = studentOptions.filter(s => !currentStudentIds.includes(s.student_id))

  const q        = search.trim().toLowerCase()
  const filtered = q
    ? eligible.filter(s => {
        const hay = [s.student_name, s.student_code, s.phone, s.parent_phone, s.branch_name]
          .filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    : eligible

  const newTotal       = group.student_count + selected.size
  const isOverCapacity = group.capacity != null && newTotal > group.capacity

  function toggleStudent(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setError(null)
  }

  function handleAdd() {
    if (!selected.size) return
    if (isOverCapacity) { setError(`Would exceed capacity of ${group.capacity}.`); return }
    setError(null)
    startT(async () => {
      const res = await addStudentsToGroupAction(group.group_id, Array.from(selected))
      if (!res.success) { setError(res.error?.message ?? 'Failed to add students.'); return }
      onAdded()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col rounded-t-2xl bg-white shadow-xl max-h-[90dvh] md:rounded-2xl md:max-w-lg">
        {/* drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-5 py-3 md:py-4 shrink-0">
          <div>
            <h3 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">Add Student</h3>
            <p className="mt-0.5 text-[12px] text-[#64748B]">to {group.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[#E2E8F0] px-4 py-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code, phone…"
            autoFocus
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
            <span>{filtered.length} available</span>
            {group.capacity && (
              <span className={isOverCapacity ? 'font-semibold text-red-600' : ''}>
                Capacity: {newTotal} / {group.capacity}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No eligible students found.</p>
          ) : filtered.map(s => {
            const isSelected = selected.has(s.student_id)
            return (
              <button
                key={s.student_id}
                onClick={() => toggleStudent(s.student_id)}
                className={[
                  'w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-colors',
                  isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className={[
                    'mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center',
                    isSelected ? 'border-[#FF8A1F] bg-[#FF8A1F]' : 'border-[#CBD5E1]',
                  ].join(' ')}>
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
                      {s.student_code && <span className="font-mono text-[10px] text-[#94A3B8]">{s.student_code}</span>}
                      {s.age != null && <span className="text-[11px] text-[#64748B]">{s.age}y</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {s.phone && <span className="font-mono text-[11px] text-[#64748B]">{s.phone}</span>}
                      {s.parent_phone && <span className="font-mono text-[11px] text-[#94A3B8]">P: {s.parent_phone}</span>}
                      <span className="text-[11px] text-[#94A3B8]">{s.branch_name}</span>
                      {s.sessions_remaining != null && (
                        <span className={`text-[11px] ${s.sessions_remaining <= 2 ? 'font-medium text-red-600' : 'text-[#64748B]'}`}>
                          {s.sessions_remaining} sess. left
                        </span>
                      )}
                    </div>
                    {s.group_name && (
                      <p className="mt-0.5 text-[11px] text-amber-600">Currently in: {s.group_name}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!selected.size || isOverCapacity}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selected.size > 0 ? `Add (${selected.size}) to Group` : 'Add to Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  MOVE GROUP MODAL — move selected students to another group
// ════════════════════════════════════════════════════════════════════

function MoveGroupModal({
  isOpen, currentGroup, allGroups, selectedIds, onClose, onMoved,
}: {
  isOpen:        boolean
  currentGroup:  GroupOperationalRow
  allGroups:     GroupOperationalRow[]
  selectedIds:   Set<string>
  onClose:       () => void
  onMoved:       () => void
}) {
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)
  const [search, setSearch]               = useState('')
  const [error, setError]                 = useState<string | null>(null)
  const [loading, setLoading]             = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) { setTargetGroupId(null); setSearch(''); setError(null); setLoading(false) }
  }, [isOpen])

  if (!isOpen) return null

  const eligible = allGroups.filter(g =>
    g.group_id !== currentGroup.group_id &&
    g.status !== 'cancelled' &&
    g.status !== 'archived'
  )

  const q        = search.trim().toLowerCase()
  const filtered = q
    ? eligible.filter(g => {
        const hay = [g.name, g.code, g.course_name, g.branch_name, g.lead_instructor_name]
          .filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    : eligible

  const targetGroup   = filtered.find(g => g.group_id === targetGroupId) ?? null
  const wouldOverfill = targetGroup?.capacity != null
    ? (targetGroup.student_count + selectedIds.size) > targetGroup.capacity
    : false

  async function handleMove() {
    if (!targetGroupId) return
    setLoading(true)
    setError(null)
    try {
      for (const sid of Array.from(selectedIds)) {
        await removeStudentFromGroupAction(currentGroup.group_id, sid)
      }
      const res = await addStudentsToGroupAction(targetGroupId, Array.from(selectedIds))
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to add students to new group')
        return
      }
      onMoved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Move failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col rounded-t-2xl bg-white shadow-xl max-h-[90dvh] md:rounded-2xl md:max-w-md">
        {/* drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-5 py-3 md:py-4 shrink-0">
          <div>
            <h3 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">Move to Group</h3>
            <p className="mt-0.5 text-[12px] text-[#64748B]">
              Moving {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} from {currentGroup.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[#E2E8F0] px-4 py-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups by name, course, branch…"
            autoFocus
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
          />
          <p className="mt-1.5 text-[11px] text-[#94A3B8]">{filtered.length} available groups</p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No eligible groups found.</p>
          ) : filtered.map(g => {
            const isSelected  = targetGroupId === g.group_id
            const capDisplay  = g.capacity ? `${g.student_count}/${g.capacity}` : `${g.student_count} students`
            const isOverCap   = g.capacity != null && (g.student_count + selectedIds.size) > g.capacity
            return (
              <button
                key={g.group_id}
                onClick={() => setTargetGroupId(g.group_id)}
                className={[
                  'w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-colors',
                  isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={[
                      'h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-[#FF8A1F] bg-[#FF8A1F]' : 'border-[#CBD5E1]',
                    ].join(' ')}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{g.name}</p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {g.course_name ?? '—'} · {g.branch_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOverCap && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Over cap</span>
                    )}
                    <span className="text-[11px] text-[#94A3B8]">{capDisplay}</span>
                    <StatusChip status={g.status} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>
          )}
          {wouldOverfill && !error && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Warning: this will exceed the target group&apos;s capacity.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={!targetGroupId || loading}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Moving…' : targetGroup ? `Move to ${targetGroup.name}` : 'Select a Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  BUILD STUDENT RESULT — for EnrollmentWizard
// ════════════════════════════════════════════════════════════════════

function buildStudentResult(s: GroupDetailStudent, group: GroupOperationalRow): StudentResult {
  return {
    id:                       s.student_id,
    name:                     s.student_name,
    code:                     s.student_code,
    email:                    null,
    phone:                    s.phone,
    age:                      s.age,
    branch_id:                group.branch_id,
    branch_name:              group.branch_name,
    parent_name:              null,
    parent_phone:             s.parent_phone,
    active_enrollments_count: 1,
    active_course_ids:        [],
    active_group_name:        group.name,
    financial_status:         s.payment_status,
    enrolled_sessions:        s.sessions_total,
    remaining_sessions:       s.sessions_remaining,
    active_summaries:         [],
  }
}

// ════════════════════════════════════════════════════════════════════
//  MAP GROUP STUDENT → StudentOperationsRow for the Finance drawer
// ════════════════════════════════════════════════════════════════════

function mapToOpsRow(s: GroupDetailStudent, group: GroupOperationalRow): StudentOperationsRow {
  const sub = s.subscription_amount ?? 0
  return {
    enrollment_id:          s.enrollment_id,
    student_id:             s.student_id,
    account_id:             s.account_id,
    group_id:               group.group_id,
    instructor_id:          group.lead_instructor_id,
    student_name:           s.student_name,
    student_code:           s.student_code,
    student_phone:          s.phone,
    student_status:         'active',
    parent_name:            null,
    parent_phone_1:         s.parent_phone,
    parent_phone_2:         null,
    branch_id:              group.branch_id,
    branch_name:            group.branch_name,
    group_name:             group.name,
    course_name:            group.course_name,
    group_start_date:       group.start_date,
    instructor_name:        group.lead_instructor_name,
    total_sessions:         0,
    sessions_attended:      0,
    attendance_pct:         s.attendance_pct,
    last_attendance_date:   null,
    consecutive_absences:   0,
    enrolled_sessions:      s.sessions_total  ?? 0,
    consumed_sessions:      s.sessions_used   ?? 0,
    remaining_sessions:     s.sessions_remaining ?? 0,
    financial_status:       s.payment_status as StudentOperationsRow['financial_status'],
    total_amount:           sub,
    net_amount:             sub,
    paid_amount:            s.paid_amount,
    remaining_amount:       s.remaining_balance,
    installments_total:     0,
    installments_paid:      0,
    installments_remaining: 0,
    next_due_date:          null,
    payment_progress_pct:   sub > 0 ? Math.min(100, Math.round((s.paid_amount / sub) * 100)) : 0,
    days_overdue:           0,
    risk_level:             s.risk_level,
    risk_flags:             [],
  }
}

// ════════════════════════════════════════════════════════════════════
//  GROUP WORKSPACE — right panel with tabs
// ════════════════════════════════════════════════════════════════════

type WorkspaceTab = 'students' | 'attendance' | 'finance' | 'performance'

function GroupWorkspace({
  group, isTL, onEdit, onDelete, onStudentsChanged, studentOptions, refreshKey, allGroups,
}: {
  group:             GroupOperationalRow
  isTL:              boolean
  onEdit:            (g: GroupOperationalRow) => void
  onDelete:          () => void
  onStudentsChanged: () => void
  studentOptions:    GroupStudentOption[]
  refreshKey:        number
  allGroups:         GroupOperationalRow[]
}) {
  const [tab, setTab]                       = useState<WorkspaceTab>('students')
  const [detailData, setDetailData]         = useState<GroupDetailData | null>(null)
  const [loading, setLoading]               = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState(false)
  const [deleteError, setDeleteError]       = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen]         = useState(false)
  const [moveGroupOpen, setMoveGroupOpen]       = useState(false)
  const [attendanceOpen, setAttendanceOpen]     = useState(false)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  // Finance gateway: drawer for existing contracts, wizard for new ones
  const [drawerOpsRow, setDrawerOpsRow]     = useState<StudentOperationsRow | null>(null)
  const [paymentStudent, setPaymentStudent] = useState<GroupDetailStudent | null>(null)
  // Quick view modal
  const [quickViewStudent, setQuickViewStudent] = useState<GroupDetailStudent | null>(null)
  const [, startT]                          = useTransition()

  function reloadDetail() {
    setLoading(true)
    getGroupDetailDataAction(group.group_id)
      .then(d => { setDetailData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    setSelectedIds(new Set())
    reloadDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.group_id, refreshKey])

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const all = detailData?.students ?? []
    if (all.every(s => selectedIds.has(s.student_id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(all.map(s => s.student_id)))
    }
  }

  async function handleRemoveStudents(ids: string[]) {
    for (const id of ids) {
      await removeStudentFromGroupAction(group.group_id, id)
    }
    setSelectedIds(new Set())
    onStudentsChanged()
  }

  // Finance gateway: open drawer if student has existing contract, wizard otherwise
  function handleAddPayment(student: GroupDetailStudent) {
    if (student.account_id) {
      setDrawerOpsRow(mapToOpsRow(student, group))
    } else {
      setPaymentStudent(student)
    }
  }

  function handleDeleteClick() { setDeleteError(null); setDeleteConfirm(true) }

  function handleDeleteConfirm() {
    setDeleteError(null)
    startT(async () => {
      const res = await deleteGroupAction(group.group_id)
      if (!res.success) { setDeleteError(res.error?.message ?? 'Failed to delete group.'); return }
      setDeleteConfirm(false)
      onDelete()
    })
  }

  const currentStudentIds = (detailData?.students ?? []).map(s => s.student_id)
  const sessionsCompleted = group.completed_sessions

  const TABS: { key: WorkspaceTab; label: string }[] = [
    { key: 'students',    label: `Students (${group.student_count})` },
    { key: 'attendance',  label: 'Attendance'  },
    { key: 'finance',     label: 'Finance'     },
    { key: 'performance', label: 'Performance' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <GroupSummaryBar
        group={group}
        sessionsCompleted={sessionsCompleted}
        isTL={isTL}
        onEdit={onEdit}
        onDelete={handleDeleteClick}
        onRecordAttendance={() => setAttendanceOpen(true)}
        onAddStudent={() => setQuickAddOpen(true)}
      />

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] shrink-0 bg-white overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 md:flex-none shrink-0 border-b-2 px-2 md:px-4 py-2.5 text-[11px] md:text-[12px] font-medium transition whitespace-nowrap text-center',
              tab === t.key
                ? 'border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-transparent text-[#64748B] hover:text-[#374151]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Students tab toolbar */}
      {tab === 'students' && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] bg-white px-4 py-2 flex-wrap">
          <span className="text-[12px] text-[#64748B]">
            {loading ? '' : `${detailData?.students.length ?? 0} students`}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <StudentSelectionToolbar
                students={detailData?.students ?? []}
                selectedIds={selectedIds}
                isTL={isTL}
                onRemove={handleRemoveStudents}
                onAddPayment={handleAddPayment}
                onMoveGroup={() => setMoveGroupOpen(true)}
                onView={s => setQuickViewStudent(s)}
                onClear={() => setSelectedIds(new Set())}
              />
            )}
          </div>
        </div>
      )}

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'students' && (
          <GroupStudentsTable
            students={detailData?.students ?? []}
            loading={loading}
            selectedIds={selectedIds}
            onToggleStudent={toggleStudent}
            onToggleAll={toggleAll}
          />
        )}
        {tab === 'attendance'  && (
          <GroupAttendanceTab
            sessions={detailData?.sessions ?? []}
            students={detailData?.students ?? []}
            group={group}
            loading={loading}
            isTL={isTL}
            onOpenAddSession={() => setAttendanceOpen(true)}
            onSessionsChanged={reloadDetail}
          />
        )}
        {tab === 'finance'     && <GroupFinanceTab students={detailData?.students ?? []} loading={loading} />}
        {tab === 'performance' && <GroupPerformanceTab group={group} />}
      </div>

      {/* Finance drawer — student has existing contract */}
      {drawerOpsRow && isTL && (
        <StudentOpsDrawer
          student={drawerOpsRow}
          onClose={() => {
            setDrawerOpsRow(null)
            setSelectedIds(new Set())
            onStudentsChanged()
          }}
        />
      )}

      {/* EnrollmentWizard — student has no contract yet; group context pre-fills course/instructor/group */}
      {paymentStudent && isTL && (
        <EnrollmentWizard
          branchIds={[group.branch_id]}
          preselectedStudent={buildStudentResult(paymentStudent, group)}
          groupContext={{
            group_id:        group.group_id,
            group_name:      group.name,
            course_id:       group.course_id   ?? null,
            course_name:     group.course_name ?? null,
            instructor_id:   group.lead_instructor_id   ?? null,
            instructor_name: group.lead_instructor_name ?? null,
          } satisfies GroupContext}
          onClose={() => setPaymentStudent(null)}
          onSuccess={() => {
            setPaymentStudent(null)
            setSelectedIds(new Set())
            onStudentsChanged()
          }}
        />
      )}

      {/* Move Group modal */}
      <MoveGroupModal
        isOpen={moveGroupOpen}
        currentGroup={group}
        allGroups={allGroups}
        selectedIds={selectedIds}
        onClose={() => setMoveGroupOpen(false)}
        onMoved={() => {
          setMoveGroupOpen(false)
          setSelectedIds(new Set())
          onStudentsChanged()
        }}
      />

      {/* Student quick view modal */}
      {quickViewStudent && (
        <StudentQuickViewModal
          student={quickViewStudent}
          group={group}
          onClose={() => setQuickViewStudent(null)}
          onStudentUpdated={() => {
            setQuickViewStudent(null)
            onStudentsChanged()
          }}
          onOpenFullFinance={() => {
            const s = quickViewStudent
            setQuickViewStudent(null)
            if (s.account_id) {
              setDrawerOpsRow(mapToOpsRow(s, group))
            }
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-[15px] font-bold text-[#0B1F3A]">Delete Group</h3>
            <p className="mb-4 text-[13px] text-[#64748B]">
              Permanently remove <strong>{group.name}</strong>?
            </p>
            <div className="mb-4 space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#64748B]">Active students</span>
                <span className="font-semibold text-[#0B1F3A]">{group.student_count}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#64748B]">Sessions completed</span>
                <span className="font-semibold text-[#0B1F3A]">{sessionsCompleted}</span>
              </div>
              {(detailData?.students ?? []).some(s => s.paid_amount > 0) && (
                <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                  This group has financial records. Payment history will be preserved.
                </p>
              )}
            </div>
            <p className="mb-5 text-[11px] text-[#94A3B8]">
              The group will be archived. Student payment and attendance history are never deleted.
            </p>
            {deleteError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#374151] hover:bg-[#F8FAFC] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-lg bg-red-500 py-2 text-[13px] font-semibold text-white hover:bg-red-600 transition"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Student modal */}
      <QuickAddStudentModal
        isOpen={quickAddOpen}
        group={group}
        studentOptions={studentOptions}
        currentStudentIds={currentStudentIds}
        onClose={() => setQuickAddOpen(false)}
        onAdded={onStudentsChanged}
      />

      {/* Group Attendance modal — records session for all students in this group */}
      <GroupAttendanceModal
        group={group}
        students={detailData?.students ?? []}
        isOpen={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        onSuccess={() => {
          setAttendanceOpen(false)
          reloadDetail()
          onStudentsChanged()
        }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  EMPTY STATE
// ════════════════════════════════════════════════════════════════════

function EmptyWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[#94A3B8]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4 h-14 w-14 opacity-25">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-[15px] font-semibold text-[#374151] mb-1">Select a group</p>
      <p className="text-[13px] text-[#94A3B8]">Choose a group from the left panel to open its workspace.</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  PAGE-LEVEL KPI CARDS
// ════════════════════════════════════════════════════════════════════

function buildPageKpis(groups: GroupOperationalRow[]) {
  const totalStudents = groups.reduce((s, g) => s + (g.student_count ?? 0), 0)
  return [
    { label: 'Total Groups', value: groups.length,                                                             dotColor: 'bg-slate-400',   bgColor: 'bg-white',         valueColor: 'text-[#0B1F3A]'  },
    { label: 'Active',       value: groups.filter(g => g.status === 'active').length,                          dotColor: 'bg-emerald-400', bgColor: 'bg-emerald-50/60', valueColor: 'text-emerald-700' },
    { label: 'Forming',      value: groups.filter(g => g.status === 'forming').length,                         dotColor: 'bg-blue-400',    bgColor: 'bg-blue-50/60',    valueColor: 'text-blue-700'    },
    { label: 'Completed',    value: groups.filter(g => g.status === 'completed').length,                       dotColor: 'bg-slate-400',   bgColor: 'bg-slate-50',      valueColor: 'text-slate-600'   },
    { label: 'Archived',     value: groups.filter(g => g.status === 'cancelled' || g.status === 'archived').length, dotColor: 'bg-red-300', bgColor: 'bg-red-50/60',    valueColor: 'text-red-600'     },
    { label: 'Students',     value: totalStudents,                                                             dotColor: 'bg-violet-400',  bgColor: 'bg-violet-50/60',  valueColor: 'text-violet-700'  },
  ]
}

// ════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

interface Props {
  groups:          GroupOperationalRow[]
  options:         GroupFormOptions
  studentOptions:  GroupStudentOption[]
  defaultBranchId: string
  isTL:            boolean
  showPageHeader?: boolean
}

export default function GroupsWorkspaceClient({
  groups, options, studentOptions, defaultBranchId, isTL, showPageHeader = false,
}: Props) {
  const router = useRouter()

  const [filters, setFilters]                 = useState<Filters>(DEFAULT_FILTERS)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const selectedGroup = groups.find(g => g.group_id === selectedGroupId) ?? null
  const [refreshKey, setRefreshKey]           = useState(0)
  const [modalOpen, setModalOpen]             = useState(false)
  const [modalMode, setModalMode]             = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup]             = useState<GroupOperationalRow | undefined>()
  const [mobilePanel, setMobilePanel]         = useState<'list' | 'detail'>('list')

  // Resizable panel
  const containerRef   = useRef<HTMLDivElement>(null)
  const isDraggingRef  = useRef(false)
  const panelWidthRef  = useRef(30)
  const [panelWidth, setPanelWidth] = useState(30)
  const [isDesktop, setIsDesktop]   = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('groups_panel_width')
    if (stored) {
      const w = Number(stored)
      if (w >= 15 && w <= 45) { setPanelWidth(w); panelWidthRef.current = w }
    }
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDraggingRef.current = true
    function onMouseMove(ev: MouseEvent) {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const minPct = (250 / rect.width) * 100
      const newW = Math.max(minPct, Math.min(45, ((ev.clientX - rect.left) / rect.width) * 100))
      panelWidthRef.current = newW
      setPanelWidth(newW)
    }
    function onMouseUp() {
      isDraggingRef.current = false
      localStorage.setItem('groups_panel_width', String(Math.round(panelWidthRef.current)))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleDividerDoubleClick() {
    setPanelWidth(prev => {
      const next = prev < 25 ? 30 : prev < 35 ? 40 : 20
      panelWidthRef.current = next
      localStorage.setItem('groups_panel_width', String(next))
      return next
    })
  }

  const visible = applyFilters(groups, filters)
  const kpis    = buildKpis(groups)

  function openCreate() {
    setModalMode('create')
    setEditGroup(undefined)
    setModalOpen(true)
  }
  function openEdit(g: GroupOperationalRow) {
    setModalMode('edit')
    setEditGroup(g)
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false) }

  function selectGroup(g: GroupOperationalRow) {
    setSelectedGroupId(g.group_id)
    setMobilePanel('detail')
  }

  function handleGroupDeleted() {
    const nextGroup = visible.find(g => g.group_id !== selectedGroupId) ?? null
    setSelectedGroupId(nextGroup?.group_id ?? null)
    if (!nextGroup) setMobilePanel('list')
    router.refresh()
  }

  function handleStudentsChanged() {
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  function handleGroupSaved(groupId: string) {
    setModalOpen(false)
    setSelectedGroupId(groupId)
    setRefreshKey(k => k + 1)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Page header (showPageHeader mode) ───────────────────────── */}
      {showPageHeader && (
        <div className="shrink-0">
          <div className="mb-3">
            <h1 className="text-[22px] font-bold text-[#0B1F3A] leading-tight">Groups</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Manage academy groups, students and operations</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {buildPageKpis(groups).map(k => (
              <div key={k.label} className={`rounded-xl border border-[#E2E8F0] ${k.bgColor} p-3`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`h-2 w-2 rounded-full ${k.dotColor} shrink-0`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{k.label}</p>
                </div>
                <p className={`text-[22px] font-bold leading-none ${k.valueColor}`}>{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Compact KPI strip — only when no page header ────────────── */}
      {!showPageHeader && (
        <div className="hidden md:flex items-center gap-5 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 shrink-0 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Overview</span>
          <div className="h-4 w-px bg-[#E2E8F0]" />
          {kpis.map(k => (
            <div key={k.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${k.color} shrink-0`} />
              <span className="text-[13px] font-bold text-[#0B1F3A]">{k.value}</span>
              <span className="text-[11px] text-[#94A3B8]">{k.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Split panel workspace ────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 flex overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">

        {/* Left panel — resizable on desktop */}
        <div
          className={[
            'shrink-0 border-r border-[#E2E8F0] overflow-hidden flex flex-col',
            mobilePanel === 'detail' ? 'hidden md:flex' : 'flex',
            !isDesktop ? 'w-full' : '',
          ].join(' ')}
          style={isDesktop ? { width: `${panelWidth}%` } : undefined}
        >
          <GroupSidebar
            groups={visible}
            allGroups={groups}
            filters={filters}
            onFilterChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
            options={options}
            selectedId={selectedGroup?.group_id ?? null}
            onSelect={selectGroup}
            isTL={isTL}
            onCreateGroup={openCreate}
          />
        </div>

        {/* Resizable divider — desktop only */}
        <div
          className="hidden md:flex w-1 shrink-0 cursor-col-resize flex-col items-center justify-center bg-[#F1F5F9] hover:bg-[#FF8A1F]/20 active:bg-[#FF8A1F]/30 transition-colors select-none group"
          onMouseDown={handleDividerMouseDown}
          onDoubleClick={handleDividerDoubleClick}
          title="Drag to resize · Double-click to cycle widths (20 / 30 / 40%)"
        >
          <div className="h-8 w-0.5 rounded-full bg-[#CBD5E1] group-hover:bg-[#FF8A1F]/70 transition-colors" />
        </div>

        {/* Right workspace */}
        <div className={[
          'flex-1 min-w-0 overflow-hidden flex flex-col',
          mobilePanel === 'list' ? 'hidden md:flex' : 'flex',
        ].join(' ')}>
          {/* Mobile back button */}
          {mobilePanel === 'detail' && selectedGroup && (
            <div className="flex items-center border-b border-[#E2E8F0] px-4 py-2.5 md:hidden shrink-0 bg-white">
              <button
                onClick={() => setMobilePanel('list')}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748B] hover:text-[#374151]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back to groups
              </button>
            </div>
          )}

          {selectedGroup ? (
            <GroupWorkspace
              key={selectedGroup.group_id}
              group={selectedGroup}
              isTL={isTL}
              onEdit={openEdit}
              onDelete={handleGroupDeleted}
              onStudentsChanged={handleStudentsChanged}
              studentOptions={studentOptions}
              refreshKey={refreshKey}
              allGroups={groups}
            />
          ) : (
            <EmptyWorkspace />
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ──────────────────────────────────────── */}
      <GroupFormModal
        key={`${modalMode}-${editGroup?.group_id ?? 'new'}`}
        isOpen={modalOpen}
        mode={modalMode}
        group={editGroup}
        options={options}
        studentOptions={studentOptions}
        defaultBranchId={defaultBranchId}
        onClose={closeModal}
        onSuccess={handleGroupSaved}
      />
    </div>
  )
}
