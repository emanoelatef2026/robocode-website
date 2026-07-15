import { requirePortalRole, requirePermission }             from '@/modules/rbac/guards'
import { listStudentOperations }                             from '@/modules/finance/queries'
import { computeAttendanceHealth, ATTENDANCE_TREND_CONFIG } from '@/modules/operational-engine'
import {
  getAttendanceReconciliationStatus,
  getRecentAttendance,
} from '@/modules/attendance/queries'
import Link from 'next/link'
import { TopbarAction } from '@/components/shared/layout/TopbarActionContext'

interface Props {
  searchParams: Promise<{ q?: string; risk?: string; att?: string; view?: string }>
}

// ── Status pill colours ───────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  present: 'bg-[#E7F8EE] text-[#15803D]',
  absent:  'bg-[#FEE2E2]    text-[#EF4444]',
  late:    'bg-[#FFFBEB]  text-[#B45309]',
  excused: 'bg-[#EFF6FF]   text-[#1D4ED8]',
  makeup:  'bg-purple-100 text-purple-700',
}

export default async function TLAttendancePage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_attendance')
  const params = await searchParams

  const search = params.q    ?? ''
  const riskF  = params.risk ?? ''
  const attF   = params.att  ?? ''
  const view   = params.view ?? 'monitor'   // 'overview' | 'monitor'

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [rows, reconciliation, recentTimeline] = await Promise.all([
    listStudentOperations(user.branchIds),
    getAttendanceReconciliationStatus(user.branchIds),
    getRecentAttendance(user.branchIds, 10),
  ])

  // ── KPI derivations ───────────────────────────────────────────────────────
  const chronicAbsence  = rows.filter(r => r.consecutive_absences >= 3).length
  const belowThreshold  = rows.filter(r => r.total_sessions >= 3 && r.attendance_pct < 60).length
  const nearExhaustion  = rows.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions <= 2 && r.remaining_sessions > 0).length
  const unpaidAttending = rows.filter(r => r.remaining_amount > 0 && r.sessions_attended > 0).length
  const neverAttended   = rows.filter(r => r.total_sessions >= 2 && r.sessions_attended === 0).length

  // ── Filter ────────────────────────────────────────────────────────────────
  let filtered = rows
  if (riskF)               filtered = filtered.filter(r => r.risk_level === riskF)
  if (attF === 'low')      filtered = filtered.filter(r => r.total_sessions >= 3 && r.attendance_pct < 60)
  if (attF === 'chronic')  filtered = filtered.filter(r => r.consecutive_absences >= 3)
  if (attF === 'never')    filtered = filtered.filter(r => r.total_sessions >= 2 && r.sessions_attended === 0)
  if (attF === 'exhausted') filtered = filtered.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions <= 0)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(r =>
      r.student_name.toLowerCase().includes(q) ||
      (r.student_code?.toLowerCase().includes(q) ?? false) ||
      (r.group_name?.toLowerCase().includes(q) ?? false) ||
      (r.instructor_name?.toLowerCase().includes(q) ?? false)
    )
  }

  const attHref = (a: string) => {
    const p = new URLSearchParams()
    if (riskF) p.set('risk', riskF)
    if (a)     p.set('att', a)
    if (search) p.set('q', search)
    return `/portal/team-leader/attendance?${p}`
  }

  const integrityHealthy = reconciliation.drift_count === 0 && reconciliation.unmatched_count === 0

  return (
    <div className="space-y-5">

      {/* ── Warning Banner ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-[#EFF6FF] px-4 py-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-[#3B82F6]">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-[#1D4ED8]">
          <span className="font-semibold">Attendance is academic history.</span>{' '}
          It represents real student participation and must reflect reality — independent of contracts, payments, or packages.
          Record sessions for any past date; financial attribution can be linked later.
        </p>
      </div>

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <TopbarAction>
        <Link
          href="/portal/team-leader/attendance/record"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Record Session
        </Link>
      </TopbarAction>
      <div className="flex justify-end">
        <Link
          href={`/portal/team-leader/attendance?view=${view === 'overview' ? 'monitor' : 'overview'}${riskF ? `&risk=${riskF}` : ''}${attF ? `&att=${attF}` : ''}`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
        >
          {view === 'overview' ? 'Switch to Monitor' : 'Switch to Overview'}
        </Link>
      </div>

      {/* ── Overview mode: hero + rules + quick actions + reconciliation ───── */}
      {view === 'overview' && (
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Record Session',
                desc:  'Log today or any past session',
                href:  '/portal/team-leader/attendance/record',
                color: 'bg-[#FF8A1F]',
                icon:  (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                label: 'Chronic Absence',
                desc:  `${chronicAbsence} students · 3+ consecutive`,
                href:  attHref('chronic'),
                color: chronicAbsence > 0 ? 'bg-[#EF4444]' : 'bg-[#94A3B8]',
                icon:  (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ),
              },
              {
                label: 'Missing Contracts',
                desc:  `${reconciliation.students_without_contracts} students unfunded`,
                href:  attHref('never'),
                color: reconciliation.students_without_contracts > 0 ? 'bg-[#F59E0B]' : 'bg-[#94A3B8]',
                icon:  (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                ),
              },
              {
                label: 'Near Exhaustion',
                desc:  `${nearExhaustion} students · ≤2 sessions left`,
                href:  attHref('exhausted'),
                color: nearExhaustion > 0 ? 'bg-[#FF8A1F]' : 'bg-[#94A3B8]',
                icon:  (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                ),
              },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex flex-col gap-3 ds-card p-4 transition hover:border-[#CBD5E1] hover:shadow-sm"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${a.color}`}>
                  {a.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">{a.label}</p>
                  <p className="mt-0.5 text-xs text-[#64748B]">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Two-column: Reconciliation Status + Recent Timeline */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* Reconciliation Status */}
            <div className="ds-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0B1F3A]">Reconciliation Health</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${integrityHealthy ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
                  {integrityHealthy ? 'HEALTHY' : 'NEEDS ATTENTION'}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: 'Unfunded Sessions',
                    value: reconciliation.unmatched_count,
                    desc:  'attendance records without a contract attribution',
                    warn:  reconciliation.unmatched_count > 0,
                  },
                  {
                    label: 'Students Without Contracts',
                    value: reconciliation.students_without_contracts,
                    desc:  'students with sessions but no active enrollment',
                    warn:  reconciliation.students_without_contracts > 0,
                  },
                  {
                    label: 'Active Packages',
                    value: reconciliation.contracts_with_unused,
                    desc:  'enrollments with remaining session capacity',
                    warn:  false,
                  },
                  {
                    label: 'Session Counter Drift',
                    value: reconciliation.drift_count,
                    desc:  'enrollments where stored count ≠ ledger count',
                    warn:  reconciliation.drift_count > 0,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0B1F3A]">{stat.label}</p>
                      <p className="text-xs text-[#94A3B8]">{stat.desc}</p>
                    </div>
                    <span className={`shrink-0 text-lg font-bold ${stat.warn ? 'text-[#F59E0B]' : stat.value > 0 ? 'text-[#10B981]' : 'text-[#94A3B8]'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
              {!integrityHealthy && (
                <div className="mt-4 rounded-lg bg-[#FFFBEB] p-3 text-xs text-[#B45309]">
                  Run reconciliation to link unfunded sessions to available contracts automatically.
                </div>
              )}
            </div>

            {/* Recent Attendance Timeline */}
            <div className="ds-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0B1F3A]">Recent Sessions</h2>
                <Link
                  href="/portal/team-leader/attendance?view=monitor"
                  className="text-xs font-medium text-[#FF8A1F] hover:underline"
                >
                  View all →
                </Link>
              </div>
              {recentTimeline.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#94A3B8]">No sessions recorded yet.</p>
              ) : (
                <ul className="divide-y divide-[#E2E8F0]">
                  {recentTimeline.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#0B1F3A]">{r.student_name}</p>
                        <p className="truncate text-xs text-[#94A3B8]">
                          {r.group_name}
                          {r.branch_name ? ` · ${r.branch_name}` : ''}
                          {' · '}
                          {new Date(r.session_date).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_PILL[r.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Important Rules Card */}
          <div className="ds-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">How This Works — Important Rules</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: '📋',
                  title: 'Attendance is Always Recordable',
                  body: 'Sessions can be recorded regardless of payment status, contract state, or package balance. Academic history is never blocked.',
                },
                {
                  icon: '🔗',
                  title: 'Contracts Link Later',
                  body: 'If no active package exists at session time, the session is marked "Unfunded." Contracts added later will automatically reconcile.',
                },
                {
                  icon: '📅',
                  title: 'Historical Backfill',
                  body: 'You can record a session for any past date — even weeks ago. The system will retroactively match it to the correct enrollment package.',
                },
                {
                  icon: '🔄',
                  title: 'FIFO Package Attribution',
                  body: 'Sessions are attributed to the oldest active enrollment first. Start dates determine eligibility — only sessions after the start date count against that package.',
                },
                {
                  icon: '👁️',
                  title: 'Visible Everywhere',
                  body: 'Every attendance record is immediately visible in admin, instructor, student, and parent portals — no sync needed.',
                },
                {
                  icon: '🔒',
                  title: 'Records Are Immutable',
                  body: 'Attendance records represent real learning events. They are never deleted when packages change, expire, or are cancelled.',
                },
              ].map((rule) => (
                <div key={rule.title} className="rounded-lg bg-[#F8FAFC] p-4">
                  <p className="mb-1.5 text-base">{rule.icon}</p>
                  <p className="text-sm font-semibold text-[#0B1F3A]">{rule.title}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Monitor mode (default): KPI + filters + table ──────────────────── */}
      {view !== 'overview' && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Chronic Absence (3+)',  value: chronicAbsence,  color: chronicAbsence > 0 ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]',   att: 'chronic' },
              { label: 'Below 60% Attendance',  value: belowThreshold,  color: belowThreshold > 0 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]', att: 'low' },
              { label: 'Never Attended',         value: neverAttended,   color: neverAttended > 0 ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]',   att: 'never' },
              { label: 'Near Exhaustion',        value: nearExhaustion,  color: nearExhaustion > 0 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]', att: '' },
              { label: 'Unpaid + Attending',     value: unpaidAttending, color: unpaidAttending > 0 ? 'bg-orange-400' : 'bg-[#CBD5E1]', att: '' },
              { label: 'Total Monitored',        value: rows.length,     color: 'bg-[#38BDF8]', att: '' },
            ].map(k => (
              <Link
                key={k.label}
                href={attHref(k.att)}
                className={`block ds-card p-3 transition hover:border-[#CBD5E1] ${attF === k.att && k.att ? 'border-[#FF8A1F] bg-orange-50' : ''}`}
              >
                <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
                <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
                <p className="text-[11px] text-[#64748B]">{k.label}</p>
              </Link>
            ))}
          </div>

          {/* Filters */}
          <form method="get" className="flex flex-wrap gap-2">
            <input type="hidden" name="view" value="monitor" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search student, group, instructor…"
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none min-w-52"
            />
            <select
              name="risk"
              defaultValue={riskF}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
            <select
              name="att"
              defaultValue={attF}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="">All Students</option>
              <option value="low">Below 60%</option>
              <option value="chronic">Chronic Absence (3+)</option>
              <option value="never">Never Attended</option>
              <option value="exhausted">Sessions Exhausted</option>
            </select>
            <button type="submit" className="rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]">
              Filter
            </button>
            {(search || riskF || attF) && (
              <Link href="/portal/team-leader/attendance" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                Clear
              </Link>
            )}
          </form>

          {/* Table */}
          <div className="ds-card">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-[#0B1F3A]">No students match the current filters</p>
                <p className="mt-1 text-xs text-[#94A3B8]">Adjust filters or clear them to see all students.</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#E2E8F0]">
                  {filtered.slice(0, 50).map(row => (
                    <div key={row.enrollment_id ?? row.student_id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/portal/team-leader/students/${row.student_id}`} className="text-[15px] font-semibold text-[#0B1F3A]">
                            {row.student_name}
                          </Link>
                          <p className="text-[12px] text-[#64748B]">
                            {row.group_name ?? '—'}{row.instructor_name ? ` · ${row.instructor_name}` : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold
                          ${row.risk_level === 'HIGH' ? 'bg-[#FEE2E2] text-[#EF4444]' : row.risk_level === 'MEDIUM' ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#E7F8EE] text-[#15803D]'}`}>
                          {row.risk_level}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className={`font-bold text-sm ${row.attendance_pct < 60 ? 'text-[#EF4444]' : row.attendance_pct < 80 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                            {row.attendance_pct}%
                          </p>
                          <p className="text-[#94A3B8]">Attendance</p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className={`font-bold text-sm ${row.consecutive_absences >= 3 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                            {row.consecutive_absences}
                          </p>
                          <p className="text-[#94A3B8]">Consec. Absent</p>
                        </div>
                        <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                          <p className={`font-bold text-sm ${row.enrolled_sessions > 0 && row.remaining_sessions <= 2 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                            {row.enrolled_sessions > 0 ? `${row.remaining_sessions}` : '∞'}
                          </p>
                          <p className="text-[#94A3B8]">Sessions Left</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="ds-table-head">
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group / Instructor</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Attendance %</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Sessions</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Consec. Absent</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[#64748B]">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Last Session</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Risk</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 100).map(row => {
                        const trend = ATTENDANCE_TREND_CONFIG[computeAttendanceHealth({
                          enrolled_sessions:    row.enrolled_sessions,
                          consumed_sessions:    row.consumed_sessions,
                          remaining_sessions:   row.remaining_sessions,
                          total_sessions:       row.total_sessions,
                          sessions_attended:    row.sessions_attended,
                          attendance_pct:       row.attendance_pct,
                          consecutive_absences: row.consecutive_absences,
                          last_attendance_date: row.last_attendance_date,
                          remaining_balance:    row.remaining_amount,
                          days_overdue:         row.days_overdue,
                          financial_status:     row.financial_status,
                          net_amount:           row.net_amount,
                          group_id:             row.group_id,
                          has_assignment_submissions: true,
                        })]
                        return (
                          <tr key={row.enrollment_id ?? row.student_id} className="ds-table-row">
                            <td className="px-4 py-3">
                              <Link href={`/portal/team-leader/students/${row.student_id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                                {row.student_name}
                              </Link>
                              {row.student_code && <p className="font-mono text-[10px] text-[#94A3B8]">#{row.student_code}</p>}
                            </td>
                            <td className="px-4 py-3 text-[#64748B]">
                              <p>{row.group_name ?? '—'}</p>
                              {row.instructor_name && <p className="text-[11px] text-[#94A3B8]">{row.instructor_name}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`font-semibold ${row.attendance_pct < 60 ? 'text-[#EF4444]' : row.attendance_pct < 80 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                                  {row.attendance_pct}%
                                </span>
                                <div className="h-1 w-12 rounded-full bg-[#E2E8F0]">
                                  <div
                                    className={`h-1 rounded-full ${row.attendance_pct >= 80 ? 'bg-[#10B981]' : row.attendance_pct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                                    style={{ width: `${row.attendance_pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-[#64748B]">
                              {row.sessions_attended}/{row.total_sessions}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-semibold ${row.consecutive_absences >= 3 ? 'text-[#EF4444]' : row.consecutive_absences >= 1 ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`}>
                                {row.consecutive_absences > 0 ? row.consecutive_absences : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.enrolled_sessions > 0 ? (
                                <span className={`font-semibold ${row.remaining_sessions <= 0 ? 'text-[#EF4444]' : row.remaining_sessions <= 2 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                                  {row.remaining_sessions <= 0 ? 'Exhausted' : row.remaining_sessions}
                                </span>
                              ) : (
                                <span className="text-[#94A3B8]">∞</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[#94A3B8]">
                              {row.last_attendance_date
                                ? new Date(row.last_attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                                  ${row.risk_level === 'HIGH' ? 'bg-[#FEE2E2] text-[#EF4444]' : row.risk_level === 'MEDIUM' ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#E7F8EE] text-[#15803D]'}`}>
                                  {row.risk_level}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${trend.color} ${trend.text}`}>
                                  {trend.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/portal/team-leader/students/${row.student_id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                                View
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {filtered.length > 100 && (
                  <p className="border-t border-[#E2E8F0] px-4 py-3 text-center text-xs text-[#94A3B8]">
                    Showing 100 of {filtered.length} — use filters to narrow down
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
