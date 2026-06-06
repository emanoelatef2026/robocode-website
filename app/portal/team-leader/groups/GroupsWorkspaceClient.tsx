'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GroupFormModal from './GroupFormModal'
import { getGroupDetailDataAction, archiveGroupAction } from '@/modules/groups/modal-actions'
import type { GroupDetailData, GroupDetailStudent, GroupDetailSession } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'

// ════════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════════

const DAYS_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
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

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtCurrency(n: number): string {
  if (!n) return '—'
  return n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
}

function estimateElapsedSessions(
  startDate: string | null,
  dayOfWeek: string | null,
  endDate: string | null | undefined,
): number {
  if (!startDate) return 0
  const start   = parseLocalDate(startDate)
  const ceiling = endDate
    ? new Date(Math.min(Date.now(), parseLocalDate(endDate).getTime()))
    : new Date()
  if (start > ceiling) return 0
  if (dayOfWeek && DAY_INDEX[dayOfWeek] !== undefined) {
    const target      = DAY_INDEX[dayOfWeek]
    const daysToFirst = (target - start.getDay() + 7) % 7
    const first       = new Date(start.getTime() + daysToFirst * 86_400_000)
    if (first > ceiling) return 0
    return Math.floor((ceiling.getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  }
  return Math.floor((ceiling.getTime() - start.getTime()) / (7 * 86_400_000))
}

// ════════════════════════════════════════════════════════════════════
//  FILTER TYPES
// ════════════════════════════════════════════════════════════════════

interface Filters {
  q:              string
  branch_id:      string
  active_only:    boolean
  forming:        boolean
  no_instructor:  boolean
  low_attendance: boolean
  low_capacity:   boolean
  overloaded:     boolean
  starts_soon:    boolean
}

const DEFAULT_FILTERS: Filters = {
  q: '', branch_id: '',
  active_only: false, forming: false, no_instructor: false,
  low_attendance: false, low_capacity: false, overloaded: false, starts_soon: false,
}

function applyFilters(groups: GroupOperationalRow[], f: Filters): GroupOperationalRow[] {
  return groups.filter(g => {
    if (f.branch_id     && g.branch_id !== f.branch_id)                      return false
    if (f.active_only   && g.status !== 'active' && g.status !== 'forming')  return false
    if (f.forming       && g.status !== 'forming')                            return false
    if (f.no_instructor && g.has_instructor)                                  return false
    if (f.low_attendance && !g.is_low_attendance)                             return false
    if (f.low_capacity   && !g.is_low_capacity)                               return false
    if (f.overloaded     && !g.is_overloaded)                                 return false
    if (f.starts_soon    && !g.starts_soon)                                   return false
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

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-slate-400">—</span>
  const cls = status === 'PAID'     ? 'bg-green-100 text-green-700'
            : status === 'OVERDUE'  ? 'bg-red-100 text-red-700'
            : status === 'DUE_SOON' ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
  const lbl = status === 'DUE_SOON' ? 'Due Soon' : status.charAt(0) + status.slice(1).toLowerCase()
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{lbl}</span>
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-14">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  GROUP LIST ITEM — Left sidebar card
// ════════════════════════════════════════════════════════════════════

function GroupListItem({
  group, selected, onClick,
}: {
  group:    GroupOperationalRow
  selected: boolean
  onClick:  () => void
}) {
  const elapsed = estimateElapsedSessions(group.start_date, group.day_of_week, group.end_date)
  const sched   = [group.day_of_week ? DAYS_SHORT[group.day_of_week] : null, fmt12(group.start_time)]
    .filter(Boolean).join(' · ')
  const attPct  = group.attendance_avg || 0
  const capFill = group.capacity
    ? `${group.student_count} / ${group.capacity}`
    : `${group.student_count}`

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3.5 border-b border-[#F1F5F9] transition-colors',
        selected
          ? 'bg-[#FFF7ED] border-l-[3px] border-l-[#FF8A1F]'
          : 'hover:bg-[#F8FAFC] border-l-[3px] border-l-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{group.name}</p>
          {group.course_name && (
            <p className="text-[11px] text-[#64748B] truncate">{group.course_name}</p>
          )}
        </div>
        <StatusChip status={group.status} />
      </div>

      <p className="text-[11px] text-[#94A3B8] mb-2">
        {group.lead_instructor_name ?? 'No instructor'}
        {sched ? ` · ${sched}` : ''}
      </p>

      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-[#64748B]">{capFill} students</span>
        <span className="text-[#64748B]">{elapsed} sess.</span>
        <span className={
          attPct >= 75 ? 'text-green-600 font-semibold' :
          attPct >= 60 ? 'text-amber-600 font-semibold' :
          attPct > 0   ? 'text-red-600 font-semibold'   : 'text-[#94A3B8]'
        }>
          {attPct > 0 ? `${attPct}%` : '—'}
        </span>
      </div>

      {/* Alert dots */}
      {(group.is_low_attendance || !group.has_instructor || group.is_low_capacity || group.is_overloaded || group.starts_soon) && (
        <div className="mt-1.5 flex gap-1.5">
          {group.is_low_attendance && <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" title="Low attendance" />}
          {!group.has_instructor   && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" title="No instructor" />}
          {group.is_low_capacity   && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" title="Under capacity" />}
          {group.is_overloaded     && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 inline-block" title="Overloaded" />}
          {group.starts_soon       && <span className="h-1.5 w-1.5 rounded-full bg-teal-400 inline-block" title="Starting soon" />}
        </div>
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════
//  LEFT SIDEBAR
// ════════════════════════════════════════════════════════════════════

const QUICK_CHIPS: { key: keyof Filters; label: string }[] = [
  { key: 'active_only',    label: 'Active'         },
  { key: 'forming',        label: 'Forming'        },
  { key: 'no_instructor',  label: 'No Instructor'  },
  { key: 'low_attendance', label: 'Low Attendance' },
  { key: 'low_capacity',   label: 'Under Capacity' },
  { key: 'overloaded',     label: 'Full'           },
  { key: 'starts_soon',    label: 'Starting Soon'  },
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
  const hasFilter = Object.entries(filters).some(([k, v]) => k !== 'branch_id' && v !== '' && v !== false)

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#0B1F3A]">Groups</h2>
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
            New
          </button>
        )}
      </div>

      {/* Search + branch */}
      <div className="border-b border-[#E2E8F0] px-3 py-2.5 space-y-2 shrink-0">
        <input
          type="text"
          value={filters.q}
          onChange={e => onFilterChange({ q: e.target.value })}
          placeholder="Search name, instructor, course…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
        />
        {options.branches.length > 1 && (
          <select
            value={filters.branch_id}
            onChange={e => onFilterChange({ branch_id: e.target.value })}
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F]"
          >
            <option value="">All Branches</option>
            {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Quick filter chips */}
      <div className="border-b border-[#E2E8F0] px-3 py-2 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map(c => (
            <button
              key={c.key}
              onClick={() => onFilterChange({ [c.key]: !filters[c.key] } as Partial<Filters>)}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                filters[c.key]
                  ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
              ].join(' ')}
            >
              {c.label}
            </button>
          ))}
          {hasFilter && (
            <button
              onClick={() => onFilterChange({ q: '', active_only: false, forming: false, no_instructor: false, low_attendance: false, low_capacity: false, overloaded: false, starts_soon: false })}
              className="rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-[11px] text-[#94A3B8] hover:text-red-500 transition"
            >
              Clear
            </button>
          )}
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
//  GROUP SUMMARY BAR — Top of right workspace panel
// ════════════════════════════════════════════════════════════════════

function GroupSummaryBar({
  group, sessionsCompleted, isTL, onEdit,
}: {
  group:             GroupOperationalRow
  sessionsCompleted: number
  isTL:              boolean
  onEdit:            (g: GroupOperationalRow) => void
}) {
  const sched = [
    group.day_of_week ? DAYS_FULL[group.day_of_week] : null,
    fmt12(group.start_time),
    group.duration_minutes ? `${group.duration_minutes}m` : null,
  ].filter(Boolean).join(' · ')

  const attPct = group.attendance_avg || 0

  const infoItems: { label: string; value: string }[] = [
    { label: 'Course',     value: group.course_name ?? '—'          },
    { label: 'Instructor', value: group.lead_instructor_name ?? '—' },
    ...(group.asst_instructor_name ? [{ label: 'Asst.', value: group.asst_instructor_name }] : []),
    { label: 'Branch',     value: group.branch_name                 },
    { label: 'Schedule',   value: sched || '—'                      },
    { label: 'Start',      value: fmtDate(group.start_date)         },
    ...(group.end_date ? [{ label: 'End', value: fmtDate(group.end_date) }] : []),
    { label: 'Capacity',   value: group.capacity ? `${group.student_count} / ${group.capacity}` : `${group.student_count}` },
    { label: 'Sessions',   value: `${sessionsCompleted} done`        },
    { label: 'Avg Att.',   value: attPct > 0 ? `${attPct}%` : '—'  },
  ]

  return (
    <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 shrink-0">
      {/* Title row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-[15px] font-bold text-[#0B1F3A] truncate">{group.name}</h2>
          {group.code && (
            <span className="font-mono text-[11px] text-[#94A3B8] shrink-0">{group.code}</span>
          )}
          <StatusChip status={group.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {group.meeting_link && (
            <a
              href={group.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#FF8A1F]">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              Meeting
            </a>
          )}
          {isTL && (
            <button
              onClick={() => onEdit(group)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {infoItems.map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="text-[11px] text-[#94A3B8]">{item.label}:</span>
            <span className="text-[11px] font-medium text-[#374151]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  STUDENTS TABLE — Main operational grid
// ════════════════════════════════════════════════════════════════════

function GroupStudentsTable({
  students, loading, isTL,
}: {
  students: GroupDetailStudent[]
  loading:  boolean
  isTL:     boolean
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[960px]">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] sticky top-0 z-10">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Student</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B]">Age</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Student Phone</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Parent Phone</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B]">Att. %</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Sessions</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B]">Left</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B] whitespace-nowrap">Pay Status</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#64748B]">Paid</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#64748B]">Balance</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B]">Risk</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B]">Joined</th>
            <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#64748B]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => {
            const attColor = s.attendance_pct >= 75 ? 'text-green-600'
                           : s.attendance_pct >= 60 ? 'text-amber-600'
                           : s.attendance_pct > 0   ? 'text-red-600'
                                                    : 'text-[#94A3B8]'

            const sessStat = s.sessions_used != null && s.sessions_total != null
              ? `${s.sessions_used} / ${s.sessions_total}`
              : s.sessions_used != null
                ? `${s.sessions_used}`
                : '—'

            const sessLeft      = s.sessions_remaining
            const sessLeftColor = sessLeft != null && sessLeft <= 2
              ? 'text-red-600 font-semibold'
              : 'text-[#374151]'

            const waPhone = (s.parent_phone ?? s.phone)?.replace(/\D/g, '')

            return (
              <tr key={s.student_id} className="border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors">
                {/* Name */}
                <td className="px-4 py-2.5">
                  <p className="text-[13px] font-semibold text-[#0B1F3A] whitespace-nowrap">{s.student_name}</p>
                  {s.student_code && (
                    <p className="font-mono text-[10px] text-[#94A3B8]">{s.student_code}</p>
                  )}
                </td>

                {/* Age */}
                <td className="px-3 py-2.5 text-center text-[12px] text-[#64748B]">
                  {s.age != null ? `${s.age}y` : '—'}
                </td>

                {/* Student phone */}
                <td className="px-3 py-2.5">
                  <span className="font-mono text-[12px] text-[#374151] whitespace-nowrap">
                    {s.phone ?? '—'}
                  </span>
                </td>

                {/* Parent phone */}
                <td className="px-3 py-2.5">
                  <span className="font-mono text-[12px] text-[#374151] whitespace-nowrap">
                    {s.parent_phone ?? '—'}
                  </span>
                </td>

                {/* Attendance % */}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[12px] font-semibold ${attColor}`}>
                    {s.attendance_pct > 0 ? `${s.attendance_pct}%` : '—'}
                  </span>
                </td>

                {/* Sessions used/total */}
                <td className="px-3 py-2.5 text-center text-[12px] text-[#64748B] whitespace-nowrap">
                  {sessStat}
                </td>

                {/* Sessions remaining */}
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[12px] ${sessLeftColor}`}>
                    {sessLeft != null ? sessLeft : '—'}
                  </span>
                </td>

                {/* Payment status */}
                <td className="px-3 py-2.5 text-center">
                  <PaymentBadge status={s.payment_status ?? null} />
                </td>

                {/* Paid amount */}
                <td className="px-3 py-2.5 text-right text-[12px] text-[#374151] whitespace-nowrap">
                  {s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'}
                </td>

                {/* Remaining balance */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className={`text-[12px] ${s.remaining_balance > 0 ? 'text-red-600 font-semibold' : 'text-[#94A3B8]'}`}>
                    {s.remaining_balance > 0 ? fmtCurrency(s.remaining_balance) : '—'}
                  </span>
                </td>

                {/* Risk */}
                <td className="px-3 py-2.5 text-center">
                  <RiskBadge level={s.risk_level} />
                </td>

                {/* Joined date */}
                <td className="px-3 py-2.5 text-[11px] text-[#94A3B8] whitespace-nowrap">
                  {fmtDateShort(s.joined_at?.slice(0, 10))}
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-0.5">
                    {/* WhatsApp */}
                    {waPhone && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="rounded p-1.5 text-green-600 hover:bg-green-50 transition"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    )}

                    {/* Call */}
                    {s.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        title="Call student"
                        className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    )}

                    {/* Open student */}
                    <Link
                      href={`/portal/team-leader/students?search=${encodeURIComponent(s.student_name)}`}
                      title="Open student"
                      className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>

                    {/* Add payment (TL only) */}
                    {isTL && (
                      <Link
                        href={`/portal/team-leader/finance?search=${encodeURIComponent(s.student_name)}`}
                        title="Add payment"
                        className="rounded p-1.5 text-[#FF8A1F] hover:bg-[#FFF7ED] transition"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </Link>
                    )}
                  </div>
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
//  ATTENDANCE TAB
// ════════════════════════════════════════════════════════════════════

function SessionRow({ session }: { session: GroupDetailSession }) {
  const isPast = new Date(session.scheduled_at) < new Date()
  const fmt    = new Date(session.scheduled_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const statusCls = session.status === 'completed' ? 'bg-green-100 text-green-700'
                  : session.status === 'scheduled'  ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-[#F1F5F9] text-[#64748B]'
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium ${isPast ? 'text-[#0B1F3A]' : 'text-[#374151]'}`}>{fmt}</p>
        {session.topic && (
          <p className="mt-0.5 text-[11px] text-[#64748B] truncate">{session.topic}</p>
        )}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${statusCls}`}>
        {session.status}
      </span>
    </div>
  )
}

function GroupAttendanceTab({
  sessions, group, loading,
}: {
  sessions: GroupDetailSession[]
  group:    GroupOperationalRow
  loading:  boolean
}) {
  if (loading && !sessions.length) return <LoadingSpinner />

  const now      = new Date()
  const past     = sessions.filter(s => new Date(s.scheduled_at) < now)
  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= now)

  return (
    <div className="p-4 space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Avg Attendance', value: group.attendance_avg > 0 ? `${group.attendance_avg}%` : '—',
            color: group.attendance_avg >= 75 ? 'text-green-600' : group.attendance_avg >= 60 ? 'text-amber-600' : group.attendance_avg > 0 ? 'text-red-600' : 'text-[#0B1F3A]' },
          { label: 'Students', value: String(group.student_count), color: 'text-[#0B1F3A]' },
          { label: 'Sessions Done', value: String(estimateElapsedSessions(group.start_date, group.day_of_week, group.end_date)), color: 'text-[#0B1F3A]' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Upcoming</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.slice(0, 5).map(s => <SessionRow key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recent Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {past.slice(0, 12).map(s => <SessionRow key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {!past.length && !upcoming.length && (
        <p className="py-10 text-center text-sm text-[#94A3B8]">No sessions recorded yet.</p>
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
      {/* Finance KPIs */}
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

      {/* Student finance rows */}
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
                  {s.paid_amount > 0 && (
                    <span className="text-[11px] text-green-600">Paid: {fmtCurrency(s.paid_amount)}</span>
                  )}
                  {s.remaining_balance > 0 && (
                    <span className="text-[11px] text-red-600 font-medium">Balance: {fmtCurrency(s.remaining_balance)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PaymentBadge status={s.payment_status ?? null} />
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
//  GROUP WORKSPACE — Right panel
// ════════════════════════════════════════════════════════════════════

type WorkspaceTab = 'students' | 'attendance' | 'finance' | 'performance'

function GroupWorkspace({
  group, isTL, onEdit, onArchived, refreshKey,
}: {
  group:      GroupOperationalRow
  isTL:       boolean
  onEdit:     (g: GroupOperationalRow) => void
  onArchived: () => void
  refreshKey: number
}) {
  const [tab, setTab]                   = useState<WorkspaceTab>('students')
  const [detailData, setDetailData]     = useState<GroupDetailData | null>(null)
  const [loading, setLoading]           = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [, startT] = useTransition()

  // Re-fetch on group change (tab reset handled by key-based remount) or after save (refreshKey++)
  useEffect(() => {
    setLoading(true)
    getGroupDetailDataAction(group.group_id)
      .then(d => { setDetailData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [group.group_id, refreshKey])

  const sessionsCompleted = estimateElapsedSessions(group.start_date, group.day_of_week, group.end_date)

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
      />

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#E2E8F0] px-4 shrink-0 bg-white">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'shrink-0 border-b-2 px-4 py-2.5 text-[12px] font-medium transition whitespace-nowrap',
              tab === t.key
                ? 'border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-transparent text-[#64748B] hover:text-[#374151]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'students'    && <GroupStudentsTable students={detailData?.students ?? []} loading={loading} isTL={isTL} />}
        {tab === 'attendance'  && <GroupAttendanceTab sessions={detailData?.sessions ?? []} group={group} loading={loading} />}
        {tab === 'finance'     && <GroupFinanceTab students={detailData?.students ?? []} loading={loading} />}
        {tab === 'performance' && <GroupPerformanceTab group={group} />}
      </div>

      {/* Footer — archive (TL only) */}
      {isTL && (
        <div className="border-t border-[#E2E8F0] bg-white px-5 py-2 shrink-0">
          {archiveConfirm ? (
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[12px] text-[#64748B]">Archive this group?</span>
              <button
                onClick={() => setArchiveConfirm(false)}
                className="rounded border border-[#E2E8F0] px-3 py-1 text-[12px] text-[#374151] hover:bg-[#F8FAFC] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => startT(async () => {
                  await archiveGroupAction(group.group_id)
                  onArchived()
                })}
                className="rounded bg-red-500 px-3 py-1 text-[12px] font-medium text-white hover:bg-red-600 transition"
              >
                Confirm Archive
              </button>
            </div>
          ) : (
            <button
              onClick={() => setArchiveConfirm(true)}
              className="text-[12px] text-[#94A3B8] hover:text-red-500 transition"
            >
              Archive Group
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  EMPTY STATE — No group selected
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
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════

interface Props {
  groups:          GroupOperationalRow[]
  options:         GroupFormOptions
  studentOptions:  GroupStudentOption[]
  defaultBranchId: string
  isTL:            boolean
}

export default function GroupsWorkspaceClient({
  groups, options, studentOptions, defaultBranchId, isTL,
}: Props) {
  const router = useRouter()

  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS)
  // ID-based selection: auto-syncs to updated group data after router.refresh()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const selectedGroup = groups.find(g => g.group_id === selectedGroupId) ?? null
  const [refreshKey, setRefreshKey]       = useState(0)
  const [modalOpen, setModalOpen]         = useState(false)
  const [modalMode, setModalMode]         = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup]         = useState<GroupOperationalRow | undefined>()
  // Mobile: 'list' shows left panel, 'detail' shows right panel
  const [mobilePanel, setMobilePanel]     = useState<'list' | 'detail'>('list')

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

  function handleArchived() {
    setSelectedGroupId(null)
    setMobilePanel('list')
  }

  function handleGroupSaved(groupId: string) {
    setModalOpen(false)
    setSelectedGroupId(groupId)   // select created/edited group
    setRefreshKey(k => k + 1)    // trigger detail re-fetch in GroupWorkspace
    router.refresh()              // update groups list from server (counts, capacity, etc.)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-5 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B] leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Split panel workspace ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">

        {/* Left sidebar — hidden on mobile when detail is visible */}
        <div className={[
          'w-[340px] shrink-0 border-r border-[#E2E8F0] overflow-hidden flex flex-col',
          mobilePanel === 'detail' ? 'hidden md:flex' : 'flex',
        ].join(' ')}>
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

        {/* Right workspace — fills remaining width */}
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
              onArchived={handleArchived}
              refreshKey={refreshKey}
            />
          ) : (
            <EmptyWorkspace />
          )}
        </div>
      </div>

      {/* ── Create / Edit modal ───────────────────────────────────────── */}
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
