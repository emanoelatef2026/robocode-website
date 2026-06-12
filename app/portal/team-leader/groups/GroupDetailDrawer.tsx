'use client'

import { useEffect, useState, useTransition } from 'react'
import { getGroupDetailDataAction, archiveGroupAction }
  from '@/modules/groups/modal-actions'
import type { GroupDetailData, GroupDetailStudent, GroupDetailSession }
  from '@/modules/groups/modal-actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'students' | 'attendance' | 'performance' | 'schedule'

interface Props {
  group:      GroupOperationalRow | null
  isTL:       boolean
  onClose:    () => void
  onEdit:     (g: GroupOperationalRow) => void
  onArchived: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
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
    const target      = DAY_INDEX[dayOfWeek]
    const daysToFirst = (target - start.getDay() + 7) % 7
    const first       = new Date(start.getTime() + daysToFirst * 86_400_000)
    if (first > end) return 0
    return Math.floor((end.getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  }
  return Math.floor((end.getTime() - start.getTime()) / (7 * 86_400_000))
}

function fmt12(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{level}</span>
}

function PctBar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={`text-[12px] font-semibold ${value >= 75 ? 'text-green-600' : value >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{value}%</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0B1F3A]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  )
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ group }: { group: GroupOperationalRow }) {
  const schedule    = [group.day_of_week ? DAYS_FULL[group.day_of_week] : null, fmt12(group.start_time)]
    .filter(Boolean).join(' · ')
  const elapsed     = group.completed_sessions
  const total       = estimateTotalSessions(group.start_date, group.day_of_week, group.end_date)
  const progressPct = total ? Math.min(100, Math.round((elapsed / total) * 100)) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Students" value={group.student_count} sub={group.capacity ? `of ${group.capacity} max` : undefined} />
        <StatCard label="Health" value={group.health_score > 0 ? `${group.health_score}%` : '—'} />
        <StatCard label="Status" value={<span className="capitalize">{group.status}</span>} />
        <StatCard
          label="Sessions"
          value={total != null ? `${elapsed} / ${total}` : elapsed > 0 ? `${elapsed} done` : '—'}
          sub={progressPct != null ? `${progressPct}% complete` : undefined}
        />
      </div>

      <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <Row label="Branch"      value={group.branch_name} />
        <Row label="Course"      value={group.course_name ?? '—'} />
        <Row
          label="Instructor"
          value={
            group.active_allocation
              ? `${group.active_allocation.instructor_name} (Sessions ${group.active_allocation.from_session}–${group.active_allocation.to_session ?? '∞'})`
              : group.status === 'handoff_pending'
                ? 'Awaiting Instructor Handoff'
                : (group.lead_instructor_name ?? '—')
          }
        />
        <Row label="Schedule"    value={schedule || '—'} />
        {group.duration_minutes && <Row label="Duration" value={`${group.duration_minutes} min`} />}
        <Row label="Start Date"  value={fmtDate(group.start_date)} />
        {group.end_date && <Row label="End Date" value={fmtDate(group.end_date)} />}

        {/* Session progress bar */}
        {progressPct != null && (
          <div className="flex items-start justify-between gap-4">
            <span className="min-w-24 text-[12px] font-medium text-[#64748B]">Progress</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className={`h-full rounded-full transition-all ${
                    progressPct >= 100 ? 'bg-red-400' :
                    progressPct >= 70  ? 'bg-amber-400' :
                    progressPct >= 10  ? 'bg-blue-400' : 'bg-[#CBD5E1]'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[12px] text-[#64748B]">{progressPct}%</span>
            </div>
          </div>
        )}

        {group.meeting_link && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[#64748B]">Meeting Link</span>
            <a href={group.meeting_link} target="_blank" rel="noopener noreferrer"
               className="text-[12px] text-[#FF8A1F] underline hover:text-[#e87c18]">
              Open →
            </a>
          </div>
        )}
        {group.notes && <Row label="Notes" value={group.notes} />}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-24 text-[12px] font-medium text-[#64748B]">{label}</span>
      <span className="text-right text-[13px] text-[#0B1F3A]">{value}</span>
    </div>
  )
}

// ── Tab: Students ──────────────────────────────────────────────────────────────

function StudentsTab({ students, loading }: { students: GroupDetailStudent[]; loading: boolean }) {
  if (loading) return <LoadingState />

  if (!students.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-10 w-10 opacity-40">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
    <div className="divide-y divide-[#F1F5F9]">
      {sorted.map(s => (
        <div key={s.student_id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Line 1: Name */}
            <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
            {/* Line 2: Code • Age */}
            <p className="text-[11px] text-[#64748B]">
              {s.student_code ?? '—'}{' • '}{s.age != null ? `${s.age}y` : '—'}
            </p>
            {/* Line 3: Student phone */}
            <p className="font-mono text-[11px] text-[#374151]">{s.phone ?? '—'}</p>
            {/* Line 4: Parent phone */}
            <p className="font-mono text-[11px] text-[#374151]">Parent: {s.parent_phone ?? '—'}</p>
            {/* Line 5: Joined date */}
            <p className="text-[11px] text-[#94A3B8]">Joined {fmtDate(s.joined_at)}</p>
            {/* Line 6: Attendance + sessions */}
            <p className="text-[11px]">
              <span className={s.attendance_pct >= 75 ? 'text-green-600' : s.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-500'}>
                {s.attendance_pct}% att.
              </span>
              <span className="text-[#94A3B8]">{' • '}</span>
              <span className={s.sessions_remaining != null && s.sessions_remaining <= 2 ? 'text-red-500' : 'text-[#64748B]'}>
                {s.sessions_remaining != null ? `${s.sessions_remaining} left` : '—'}
              </span>
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <RiskBadge level={s.risk_level} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────

function AttendanceTab({ sessions, loading }: { sessions: GroupDetailSession[]; loading: boolean }) {
  if (loading) return <LoadingState />

  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= new Date())
  const past     = sessions.filter(s => new Date(s.scheduled_at) < new Date())

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Upcoming</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.slice(0, 5).map(s => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recent Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {past.slice(0, 10).map(s => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </div>
      )}

      {!upcoming.length && !past.length && (
        <p className="py-8 text-center text-sm text-[#94A3B8]">No sessions found.</p>
      )}
    </div>
  )
}

function SessionRow({ session }: { session: GroupDetailSession }) {
  const isPast    = new Date(session.scheduled_at) < new Date()
  const statusCls = session.status === 'completed' ? 'bg-green-100 text-green-700' :
                    session.status === 'scheduled'  ? 'bg-blue-100 text-blue-700'  :
                                                      'bg-[#F1F5F9] text-[#64748B]'
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium ${isPast ? 'text-[#0B1F3A]' : 'text-[#374151]'}`}>
          {fmtDateTime(session.scheduled_at)}
        </p>
        {session.topic && <p className="mt-0.5 text-[11px] text-[#64748B] truncate">{session.topic}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
          {session.status}
        </span>
        {session.duration_minutes > 0 && (
          <span className="text-[11px] text-[#94A3B8]">{session.duration_minutes}min</span>
        )}
      </div>
    </div>
  )
}

// ── Tab: Performance ───────────────────────────────────────────────────────────

function PerformanceTab({ group }: { group: GroupOperationalRow }) {
  const metrics = [
    { label: 'Attendance',   value: group.attendance_avg },
    { label: 'Assignments',  value: group.assignment_avg },
    { label: 'Portfolio',    value: group.portfolio_avg  },
    { label: 'Health Score', value: group.health_score  },
  ]

  const flags = [
    group.is_low_attendance  && 'Low attendance (< 60%)',
    group.is_low_capacity    && 'Under capacity (< 50% filled)',
    group.is_overloaded      && 'Overloaded (≥ 90% filled)',
    !group.has_instructor    && 'No instructor assigned',
    !group.has_course        && 'No course assigned',
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#374151]">{m.label}</span>
            <PctBar value={m.value} />
          </div>
        ))}
      </div>

      {flags.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="mb-2 text-[12px] font-semibold text-amber-700">Alerts</p>
          <ul className="space-y-1">
            {flags.map(f => (
              <li key={String(f)} className="flex items-center gap-2 text-[12px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {flags.length === 0 && group.health_score >= 75 && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700 font-medium">
          Group is performing well ✓
        </div>
      )}
    </div>
  )
}

// ── Tab: Schedule ──────────────────────────────────────────────────────────────

function ScheduleTab({ group, sessions, loading }: { group: GroupOperationalRow; sessions: GroupDetailSession[]; loading: boolean }) {
  const schedule = [
    group.day_of_week ? DAYS_FULL[group.day_of_week] : null,
    fmt12(group.start_time),
    group.duration_minutes ? `${group.duration_minutes} min` : null,
  ].filter(Boolean).join(' · ')

  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= new Date()).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2.5">
        <Row label="Recurring" value={schedule || '—'} />
        <Row label="Start Date" value={fmtDate(group.start_date)} />
        {group.end_date && <Row label="End Date" value={fmtDate(group.end_date)} />}
        {group.meeting_link && (
          <Row label="Meeting" value={
            <a href={group.meeting_link} target="_blank" rel="noopener noreferrer"
               className="text-[#FF8A1F] underline hover:text-[#e87c18]">
              Join →
            </a>
          } />
        )}
      </div>

      {loading ? <LoadingState /> : upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Next Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.map(s => <SessionRow key={s.id} session={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
    </div>
  )
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

export default function GroupDetailDrawer({ group, isTL, onClose, onEdit, onArchived }: Props) {
  const [tab, setTab]         = useState<Tab>('overview')
  const [detailData, setDetailData] = useState<GroupDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!group) { setDetailData(null); return }
    setTab('overview')
    setDetailData(null)
    setDetailLoading(true)
    setArchiveConfirm(false)
    startTransition(() => {
      getGroupDetailDataAction(group.group_id).then(data => {
        setDetailData(data)
        setDetailLoading(false)
      }).catch(() => setDetailLoading(false))
    })
  }, [group?.group_id])

  useEffect(() => {
    if (!group) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [group, onClose])

  function handleArchive() {
    if (!group) return
    startTransition(async () => {
      await archiveGroupAction(group.group_id)
      onArchived()
    })
  }

  if (!group) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview'     },
    { key: 'students',     label: `Students (${group.student_count})` },
    { key: 'attendance',   label: 'Attendance'   },
    { key: 'performance',  label: 'Performance'  },
    { key: 'schedule',     label: 'Schedule'     },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-[#0B1F3A]">{group.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#64748B]">
              <span>{group.branch_name}</span>
              {group.code && <><span>·</span><span className="font-mono">{group.code}</span></>}
              <span>·</span>
              <span className={`capitalize font-medium ${group.status === 'active' ? 'text-green-600' : group.status === 'forming' ? 'text-blue-600' : 'text-[#94A3B8]'}`}>
                {group.status}
              </span>
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1">
            {isTL && (
              <button onClick={() => onEdit(group)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition min-h-9 flex items-center">
                Edit
              </button>
            )}
            <button onClick={onClose}
              className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#E2E8F0] px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'shrink-0 border-b-2 px-3 py-3 text-[12px] font-medium transition whitespace-nowrap',
                tab === t.key
                  ? 'border-[#FF8A1F] text-[#FF8A1F]'
                  : 'border-transparent text-[#64748B] hover:text-[#374151]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview'    && <OverviewTab    group={group} />}
          {tab === 'students'    && <StudentsTab    students={detailData?.students ?? []} loading={detailLoading} />}
          {tab === 'attendance'  && <AttendanceTab  sessions={detailData?.sessions ?? []} loading={detailLoading} />}
          {tab === 'performance' && <PerformanceTab group={group} />}
          {tab === 'schedule'    && <ScheduleTab    group={group} sessions={detailData?.sessions ?? []} loading={detailLoading} />}
        </div>

        {/* Footer (TL only) */}
        {isTL && (
          <div className="border-t border-[#E2E8F0] px-5 py-3">
            {archiveConfirm ? (
              <div className="flex items-center gap-3">
                <span className="flex-1 text-[12px] text-[#64748B]">Archive this group?</span>
                <button onClick={() => setArchiveConfirm(false)}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition">
                  Cancel
                </button>
                <button onClick={handleArchive}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-red-600">
                  Confirm
                </button>
              </div>
            ) : (
              <button onClick={() => setArchiveConfirm(true)}
                className="text-[12px] font-medium text-[#94A3B8] hover:text-red-500 transition">
                Archive Group
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
