'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname }           from 'next/navigation'
import GroupFormModal    from './GroupFormModal'
import GroupDetailDrawer from './GroupDetailDrawer'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  groups:         GroupOperationalRow[]
  options:        GroupFormOptions
  studentOptions: GroupStudentOption[]
  defaultBranchId: string
  isTL:           boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function fmt12(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDateShort(iso: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Count how many times dayOfWeek has occurred between startDate and ceiling (inclusive).
function estimateElapsedSessions(
  startDate: string | null,
  dayOfWeek: string | null,
  endDate:   string | null | undefined,
): number {
  if (!startDate) return 0
  const start   = parseLocalDate(startDate)
  const ceiling = endDate
    ? new Date(Math.min(Date.now(), parseLocalDate(endDate).getTime()))
    : new Date()
  if (start > ceiling) return 0

  if (dayOfWeek && DAY_INDEX[dayOfWeek] !== undefined) {
    const target     = DAY_INDEX[dayOfWeek]
    const daysToFirst = (target - start.getDay() + 7) % 7
    const first      = new Date(start.getTime() + daysToFirst * 86_400_000)
    if (first > ceiling) return 0
    return Math.floor((ceiling.getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  }
  // No recurring day set — estimate as weeks elapsed
  return Math.floor((ceiling.getTime() - start.getTime()) / (7 * 86_400_000))
}

function estimateTotalSessions(
  startDate: string | null,
  dayOfWeek: string | null,
  endDate:   string | null | undefined,
): number | null {
  if (!startDate || !endDate) return null
  const start = parseLocalDate(startDate)
  const end   = parseLocalDate(endDate)
  if (start >= end) return null
  if (dayOfWeek && DAY_INDEX[dayOfWeek] !== undefined) {
    const target     = DAY_INDEX[dayOfWeek]
    const daysToFirst = (target - start.getDay() + 7) % 7
    const first      = new Date(start.getTime() + daysToFirst * 86_400_000)
    if (first > end) return 0
    return Math.floor((end.getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  }
  return Math.floor((end.getTime() - start.getTime()) / (7 * 86_400_000))
}

function PctCell({ value }: { value: number | null }) {
  if (value == null || value === 0) return <span className="text-xs text-[#94A3B8]">—</span>
  const color = value >= 75 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`text-xs font-semibold ${color}`}>{value}%</span>
}

function StartDateCell({ g }: { g: GroupOperationalRow }) {
  const label = fmtDateShort(g.start_date)
  if (!label) return <span className="text-xs text-[#94A3B8]">—</span>
  const today           = new Date()
  const sd              = parseLocalDate(g.start_date!)
  const isOverdueForming = g.status === 'forming' && sd < today
  const isFuture         = sd > today
  if (isOverdueForming) {
    return (
      <span className="text-xs font-medium text-amber-600" title="Forming group is past its start date">
        {label} ⚠
      </span>
    )
  }
  return (
    <span className={`text-xs ${isFuture ? 'text-blue-600 font-medium' : 'text-[#64748B]'}`}>
      {label}
    </span>
  )
}

function SessionsCell({ g }: { g: GroupOperationalRow }) {
  if (!g.start_date) return <span className="text-xs text-[#94A3B8]">—</span>
  const elapsed = estimateElapsedSessions(g.start_date, g.day_of_week, g.end_date)
  const total   = estimateTotalSessions(g.start_date, g.day_of_week, g.end_date)
  const ratio   = total ? elapsed / total : null
  const color   = ratio == null
    ? 'text-[#64748B]'
    : ratio > 1    ? 'text-red-600'
    : ratio >= 0.7 ? 'text-amber-600'
    : ratio >= 0.3 ? 'text-[#64748B]'
    : elapsed === 0 ? 'text-[#94A3B8]'
    : 'text-blue-600'
  const label = total != null ? `${elapsed} / ${total}` : elapsed === 0 ? '0 sess.' : `${elapsed} sess.`
  return <span className={`text-xs font-semibold ${color}`}>{label}</span>
}

function HealthBadge({ score }: { score: number }) {
  if (!score) return <span className="text-xs text-[#94A3B8]">—</span>
  const cls = score >= 90 ? 'bg-green-100 text-green-700' : score >= 75 ? 'bg-blue-100 text-blue-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  const lbl = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Needs Attention' : 'At Risk'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{lbl}</span>
}

function StatusChip({ status }: { status: string }) {
  const cls = status === 'active' ? 'bg-green-100 text-green-700' : status === 'forming' ? 'bg-blue-100 text-blue-700' : status === 'completed' ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{status}</span>
}

// ── KPI data ───────────────────────────────────────────────────────────────────

function buildKpis(groups: GroupOperationalRow[]) {
  return [
    { label: 'Active',          value: groups.filter(g => g.status === 'active').length,        color: 'bg-blue-400'   },
    { label: 'Low Attendance',  value: groups.filter(g => g.is_low_attendance).length,           color: 'bg-red-400'    },
    { label: 'No Instructor',   value: groups.filter(g => !g.has_instructor).length,             color: 'bg-amber-400'  },
    { label: 'Under Capacity',  value: groups.filter(g => g.is_low_capacity).length,             color: 'bg-orange-400' },
    { label: 'Overloaded',      value: groups.filter(g => g.is_overloaded).length,               color: 'bg-purple-400' },
    { label: 'Starting Soon',   value: groups.filter(g => g.starts_soon).length,                 color: 'bg-teal-400'   },
  ]
}

// ── Filter / search logic ──────────────────────────────────────────────────────

interface Filters {
  q:              string
  branch_id:      string
  instructor_id:  string
  course_id:      string
  status:         string
  day_of_week:    string
  active_only:    boolean
  no_instructor:  boolean
  low_attendance: boolean
  low_capacity:   boolean
  overloaded:     boolean
}

function applyFilters(groups: GroupOperationalRow[], f: Filters): GroupOperationalRow[] {
  return groups.filter(g => {
    if (f.branch_id     && g.branch_id           !== f.branch_id)    return false
    if (f.instructor_id && g.lead_instructor_id   !== f.instructor_id) return false
    if (f.course_id     && g.course_id            !== f.course_id)    return false
    if (f.status        && g.status               !== f.status)       return false
    if (f.day_of_week   && g.day_of_week          !== f.day_of_week)  return false
    if (f.active_only   && g.status !== 'active' && g.status !== 'forming') return false
    if (f.no_instructor && g.has_instructor)       return false
    if (f.low_attendance && !g.is_low_attendance)  return false
    if (f.low_capacity   && !g.is_low_capacity)    return false
    if (f.overloaded     && !g.is_overloaded)      return false
    if (f.q) {
      const q = f.q.toLowerCase()
      const hay = [g.name, g.code, g.lead_instructor_name, g.course_name, g.branch_name,
        ...g.enrolled_students.map(s => s.student_name + ' ' + (s.student_code ?? ''))
      ].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function filtersFromParams(sp: URLSearchParams): Filters {
  return {
    q:             sp.get('q')             ?? '',
    branch_id:     sp.get('branch')        ?? '',
    instructor_id: sp.get('instructor')    ?? '',
    course_id:     sp.get('course')        ?? '',
    status:        sp.get('status')        ?? '',
    day_of_week:   sp.get('day')           ?? '',
    active_only:   sp.get('active_only')  === '1',
    no_instructor: sp.get('no_instr')     === '1',
    low_attendance: sp.get('low_att')     === '1',
    low_capacity:   sp.get('low_cap')     === '1',
    overloaded:     sp.get('overloaded')  === '1',
  }
}

function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q)              p.set('q',          f.q)
  if (f.branch_id)      p.set('branch',     f.branch_id)
  if (f.instructor_id)  p.set('instructor', f.instructor_id)
  if (f.course_id)      p.set('course',     f.course_id)
  if (f.status)         p.set('status',     f.status)
  if (f.day_of_week)    p.set('day',        f.day_of_week)
  if (f.active_only)    p.set('active_only','1')
  if (f.no_instructor)  p.set('no_instr',   '1')
  if (f.low_attendance) p.set('low_att',    '1')
  if (f.low_capacity)   p.set('low_cap',    '1')
  if (f.overloaded)     p.set('overloaded', '1')
  return p
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GroupsClient({ groups, options, studentOptions, defaultBranchId, isTL }: Props) {
  const router     = useRouter()
  const pathname   = usePathname()
  const sp         = useSearchParams()
  const [,startT]  = useTransition()

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(sp))

  // ── URL sync ────────────────────────────────────────────────────────────────
  function updateFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    const params = filtersToParams(next).toString()
    startT(() => router.replace(`${pathname}${params ? `?${params}` : ''}`, { scroll: false }))
  }

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]   = useState(false)
  const [modalMode, setModalMode]   = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup]   = useState<GroupOperationalRow | undefined>()

  // ── Drawer state ─────────────────────────────────────────────────────────────
  const [drawerGroup, setDrawerGroup] = useState<GroupOperationalRow | null>(null)

  function openCreate() { setModalMode('create'); setEditGroup(undefined); setModalOpen(true) }
  function openEdit(g: GroupOperationalRow) { setModalMode('edit'); setEditGroup(g); setModalOpen(true); setDrawerGroup(null) }
  function closeModal() { setModalOpen(false) }
  function handleSuccess(_id: string) { setModalOpen(false) }

  // ── Filtered groups ──────────────────────────────────────────────────────────
  const visible = applyFilters(groups, filters)
  const kpis    = buildKpis(groups)

  const toggles: { key: keyof Filters; label: string }[] = [
    { key: 'active_only',    label: 'Active / Forming' },
    { key: 'no_instructor',  label: 'No Instructor'    },
    { key: 'low_attendance', label: 'Low Attendance'   },
    { key: 'low_capacity',   label: 'Under Capacity'   },
    { key: 'overloaded',     label: 'Overloaded'       },
  ]

  return (
    <div className="space-y-5">
      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-5 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B] leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Header + filters ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-[#0B1F3A]">Groups</h1>
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
              {visible.length}{visible.length !== groups.length ? ` / ${groups.length}` : ''}
            </span>
          </div>
          {isTL && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] min-h-9">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New Group
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="border-b border-[#E2E8F0] px-4 py-3 space-y-3">
          {/* Search + dropdowns row */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={filters.q}
              onChange={e => updateFilters({ q: e.target.value })}
              placeholder="Search name, instructor, course, student…"
              className="flex-1 min-w-48 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white focus:ring-2 focus:ring-[#FF8A1F]/20"
            />

            {options.branches.length > 1 && (
              <select value={filters.branch_id} onChange={e => updateFilters({ branch_id: e.target.value })}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white">
                <option value="">All Branches</option>
                {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}

            <select value={filters.instructor_id} onChange={e => updateFilters({ instructor_id: e.target.value })}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white">
              <option value="">All Instructors</option>
              {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>

            <select value={filters.course_id} onChange={e => updateFilters({ course_id: e.target.value })}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white">
              <option value="">All Courses</option>
              {options.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>

            <select value={filters.status} onChange={e => updateFilters({ status: e.target.value })}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white">
              <option value="">All Status</option>
              {['forming','active','completed','cancelled'].map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>

            <select value={filters.day_of_week} onChange={e => updateFilters({ day_of_week: e.target.value })}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white">
              <option value="">All Days</option>
              {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>
              ))}
            </select>

            {/* Clear */}
            {Object.values(filters).some(v => v !== '' && v !== false) && (
              <button onClick={() => updateFilters({ q:'', branch_id:'', instructor_id:'', course_id:'', status:'', day_of_week:'', active_only:false, no_instructor:false, low_attendance:false, low_capacity:false, overloaded:false })}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#94A3B8] hover:text-[#374151] hover:bg-[#F8FAFC] transition">
                Clear
              </button>
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-2">
            {toggles.map(t => (
              <button
                key={t.key}
                onClick={() => updateFilters({ [t.key]: !filters[t.key] } as Partial<Filters>)}
                className={[
                  'rounded-full border px-3 py-1 text-[12px] font-medium transition',
                  filters[t.key]
                    ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                    : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table / cards ──────────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-10 w-10 opacity-40">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium">No groups match the current filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-[#E2E8F0] md:hidden">
              {visible.map(g => {
                const sched = [g.day_of_week ? DAYS_SHORT[g.day_of_week] : null, fmt12(g.start_time)].filter(Boolean).join(' · ')
                return (
                  <div key={g.group_id}
                    className="cursor-pointer px-4 py-4 hover:bg-[#FAFAFA] transition active:bg-[#F1F5F9]"
                    onClick={() => setDrawerGroup(g)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#0B1F3A]">{g.name}</p>
                        <p className="mt-0.5 text-[12px] text-[#64748B] truncate">
                          {g.lead_instructor_name ?? 'No instructor'}
                          {g.course_name && ` · ${g.course_name}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <HealthBadge score={g.health_score} />
                        <StatusChip status={g.status} />
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Attend.',   value: g.attendance_avg || null },
                        { label: 'Homework',  value: g.assignment_avg || null },
                        { label: 'Portfolio', value: g.portfolio_avg  || null },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className="text-[10px] text-[#94A3B8]">{label}</p>
                          <p className={`text-sm font-semibold ${value == null ? 'text-[#94A3B8]' : value >= 75 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {value != null ? `${value}%` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-[#64748B]">
                      <span>
                        {g.student_count} students
                        {g.capacity ? ` / ${g.capacity}` : ''}
                        {sched ? ` · ${sched}` : ''}
                      </span>
                      {/* Alert dots */}
                      <div className="flex gap-1">
                        {g.is_low_attendance  && <span className="h-2 w-2 rounded-full bg-red-400"    title="Low attendance" />}
                        {!g.has_instructor    && <span className="h-2 w-2 rounded-full bg-amber-400"  title="No instructor" />}
                        {g.is_low_capacity    && <span className="h-2 w-2 rounded-full bg-orange-400" title="Under capacity" />}
                        {g.is_overloaded      && <span className="h-2 w-2 rounded-full bg-purple-400" title="Overloaded" />}
                      </div>
                    </div>
                    {/* Start date + session progress row */}
                    {g.start_date && (() => {
                      const label    = fmtDateShort(g.start_date)!
                      const elapsed  = estimateElapsedSessions(g.start_date, g.day_of_week, g.end_date)
                      const total    = estimateTotalSessions(g.start_date, g.day_of_week, g.end_date)
                      const today    = new Date()
                      const overdue  = g.status === 'forming' && parseLocalDate(g.start_date) < today
                      return (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className={overdue ? 'text-amber-600 font-medium' : 'text-[#64748B]'}>
                            {overdue ? '⚠ ' : ''}Starts: {label}
                          </span>
                          {(elapsed > 0 || total != null) && (
                            <span className="text-[#94A3B8]">
                              {total != null ? `${elapsed} / ${total} sess.` : `${elapsed} sess.`}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Day / Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Start</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Sessions</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Attend.</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Homework</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Health</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map(g => {
                    const sched = [g.day_of_week ? DAYS_SHORT[g.day_of_week] : null, fmt12(g.start_time)].filter(Boolean).join(' · ')
                    return (
                      <tr key={g.group_id}
                        className="cursor-pointer border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition"
                        onClick={() => setDrawerGroup(g)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0B1F3A]">{g.name}</p>
                          <div className="flex items-center gap-1.5">
                            {g.code && <p className="font-mono text-[10px] text-[#94A3B8]">{g.code}</p>}
                            {g.is_low_attendance  && <span className="h-1.5 w-1.5 rounded-full bg-red-400"    title="Low attendance" />}
                            {!g.has_instructor    && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"  title="No instructor" />}
                            {g.is_overloaded      && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" title="Overloaded" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{g.lead_instructor_name ?? <span className="text-[#94A3B8]">—</span>}</td>
                        <td className="px-4 py-3 text-[#64748B]">{g.course_name ?? <span className="text-[#94A3B8]">—</span>}</td>
                        <td className="px-4 py-3 text-[#64748B]">{sched || <span className="text-[#94A3B8]">—</span>}</td>
                        <td className="px-4 py-3"><StartDateCell g={g} /></td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-[#0B1F3A]">{g.student_count}</span>
                          {g.capacity && <span className="text-[#94A3B8] text-xs">/{g.capacity}</span>}
                        </td>
                        <td className="px-4 py-3 text-right"><SessionsCell g={g} /></td>
                        <td className="px-4 py-3 text-center"><PctCell value={g.attendance_avg || null} /></td>
                        <td className="px-4 py-3 text-center"><PctCell value={g.assignment_avg || null} /></td>
                        <td className="px-4 py-3"><HealthBadge score={g.health_score} /></td>
                        <td className="px-4 py-3"><StatusChip status={g.status} /></td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          {isTL && (
                            <button onClick={() => openEdit(g)}
                              className="rounded px-2 py-1 text-[12px] font-medium text-[#FF8A1F] hover:bg-[#FFF7ED] transition">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <GroupFormModal
        key={`${modalMode}-${editGroup?.group_id ?? 'new'}`}
        isOpen={modalOpen}
        mode={modalMode}
        group={editGroup}
        options={options}
        studentOptions={studentOptions}
        defaultBranchId={defaultBranchId}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      <GroupDetailDrawer
        group={drawerGroup}
        isTL={isTL}
        onClose={() => setDrawerGroup(null)}
        onEdit={openEdit}
        onArchived={() => setDrawerGroup(null)}
      />
    </div>
  )
}
