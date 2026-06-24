'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { GroupHealthRow } from '@/modules/tl-dashboard/dashboard-v2-queries'
import { HealthBadge, ScoreBar } from '../_components/RiskBadge'

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAYS_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function fmt12(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: GroupHealthRow }) {
  const { health_status, health_score } = group
  const borderCls = health_status === 'danger'  ? 'border-[#FECACA]'   :
                    health_status === 'warning' ? 'border-[#FDE68A]' : 'border-[#E2E8F0]'

  const attPct = group.avg_attendance_pct ?? 0
  const attCls = attPct >= 75 ? 'text-[#10B981]' : attPct >= 55 ? 'text-[#F59E0B]' : 'text-[#EF4444]'

  const schedule = [DAYS_SHORT[group.day_of_week ?? ''], fmt12(group.group_time)].filter(Boolean).join(' ')

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden ${borderCls} transition hover:shadow-sm`}>
      {/* Header */}
      <div className={`flex items-start justify-between gap-2 border-b px-4 py-3 ${borderCls}`}>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{group.group_name}</p>
          {schedule && <p className="mt-0.5 text-[10px] text-[#94A3B8]">{schedule}</p>}
        </div>
        <HealthBadge status={health_status} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] border-b border-[#F1F5F9]">
        {[
          { label: 'Students',   value: String(group.active_students),  sub: group.capacity ? `of ${group.capacity}` : null },
          { label: 'Attendance', value: attPct > 0 ? `${attPct}%` : '—', cls: attCls },
          { label: 'Score',      value: String(health_score) },
        ].map(stat => (
          <div key={stat.label} className="px-3 py-2 text-center">
            <p className={`text-[15px] font-bold ${stat.cls ?? 'text-[#0B1F3A]'}`}>{stat.value}</p>
            <p className="text-[9px] font-medium uppercase tracking-wide text-[#94A3B8]">{stat.label}</p>
            {stat.sub && <p className="text-[9px] text-[#CBD5E1]">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="px-4 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#64748B] truncate">
            {group.instructor_name
              ? <span>👤 {group.instructor_name}</span>
              : <span className="text-[#F59E0B] font-medium">⚠ No instructor</span>}
          </span>
          {group.course_name && <span className="text-[10px] text-[#94A3B8] truncate max-w-[100px]">{group.course_name}</span>}
        </div>

        <ScoreBar value={attPct} />

        {/* Warnings row */}
        {(group.unpaid_students > 0 || group.critical_sessions_count > 0 || group.sessions_missing_attendance > 0) && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {group.unpaid_students > 0 && (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[9px] font-semibold text-[#EF4444]">
                {group.unpaid_students} unpaid
              </span>
            )}
            {group.critical_sessions_count > 0 && (
              <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[9px] font-semibold text-[#B45309]">
                {group.critical_sessions_count} expiring
              </span>
            )}
            {group.sessions_missing_attendance > 0 && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-semibold text-orange-700">
                {group.sessions_missing_attendance} no attendance
              </span>
            )}
          </div>
        )}

        {/* Last / next session */}
        <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
          <span>Last: {fmtDate(group.last_session_date)}</span>
          {group.next_session_at && <span className="text-[#3B82F6]">Next: {fmtDate(group.next_session_at)}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-2 border-t px-4 py-2.5 ${borderCls}`}>
        <Link
          href={`/portal/team-leader/groups/${group.group_id}`}
          className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          Open
        </Link>
        <Link
          href={`/portal/team-leader/attendance/record?group=${group.group_id}`}
          className="flex-1 rounded-lg bg-[#FF8A1F] py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#e87c18]"
        >
          Attendance
        </Link>
      </div>
    </div>
  )
}

// ─── Sort / filter bar ────────────────────────────────────────────────────────

type SortKey = 'health' | 'attendance' | 'name' | 'students' | 'danger'
type FilterKey = 'all' | 'danger' | 'warning' | 'healthy' | 'no_instructor' | 'missing_attendance'

export default function GroupHealthBoardClient({ groups }: { groups: GroupHealthRow[] }) {
  const [sort, setSort]     = useState<SortKey>('health')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let rows = groups

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(g =>
        g.group_name.toLowerCase().includes(q) ||
        (g.instructor_name?.toLowerCase().includes(q) ?? false) ||
        (g.course_name?.toLowerCase().includes(q) ?? false)
      )
    }

    if (filter === 'danger')            rows = rows.filter(g => g.health_status === 'danger')
    else if (filter === 'warning')      rows = rows.filter(g => g.health_status === 'warning')
    else if (filter === 'healthy')      rows = rows.filter(g => g.health_status === 'healthy')
    else if (filter === 'no_instructor') rows = rows.filter(g => !g.instructor_name)
    else if (filter === 'missing_attendance') rows = rows.filter(g => g.sessions_missing_attendance > 0)

    if (sort === 'health')       rows = [...rows].sort((a, b) => a.health_score - b.health_score)
    else if (sort === 'attendance') rows = [...rows].sort((a, b) => (a.avg_attendance_pct ?? 0) - (b.avg_attendance_pct ?? 0))
    else if (sort === 'name')    rows = [...rows].sort((a, b) => a.group_name.localeCompare(b.group_name))
    else if (sort === 'students') rows = [...rows].sort((a, b) => b.active_students - a.active_students)
    else if (sort === 'danger')  rows = [...rows].sort((a, b) =>
      (['danger', 'warning', 'healthy'].indexOf(a.health_status)) -
      (['danger', 'warning', 'healthy'].indexOf(b.health_status))
    )

    return rows
  }, [groups, sort, filter, search])

  const dangerCount  = groups.filter(g => g.health_status === 'danger').length
  const warningCount = groups.filter(g => g.health_status === 'warning').length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[160px] flex-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#CBD5E1]">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full ds-card py-2 pl-8 pr-3 text-[12px] text-[#0B1F3A] placeholder-[#CBD5E1] focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'all',      label: 'All',        count: groups.length },
            { key: 'danger',   label: 'At Risk',     count: dangerCount, cls: 'text-[#EF4444]' },
            { key: 'warning',  label: 'Warning',     count: warningCount, cls: 'text-[#F59E0B]' },
            { key: 'no_instructor', label: 'No Instructor', count: groups.filter(g => !g.instructor_name).length },
          ] as const).map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key as FilterKey)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                filter === chip.key
                  ? 'bg-[#0B1F3A] text-white'
                  : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]'
              }`}
            >
              {chip.label}
              {chip.count > 0 && (
                <span className={`${ filter === chip.key ? 'text-white/70' : (('cls' in chip ? chip.cls as string : null) ?? 'text-[#94A3B8]')} tabular-nums`}>
                  {chip.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="ds-card py-2 pl-3 pr-7 text-[12px] text-[#64748B] focus:border-[#FF8A1F] focus:outline-none"
        >
          <option value="health">Sort: Health</option>
          <option value="danger">Sort: Danger First</option>
          <option value="attendance">Sort: Attendance</option>
          <option value="students">Sort: Students</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#94A3B8]">No groups match the filter.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(g => <GroupCard key={g.group_id} group={g} />)}
        </div>
      )}
    </div>
  )
}
