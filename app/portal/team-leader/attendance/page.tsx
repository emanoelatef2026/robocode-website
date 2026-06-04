import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listStudentOperations }                from '@/modules/finance/queries'
import { computeAttendanceHealth, ATTENDANCE_TREND_CONFIG } from '@/modules/operational-engine'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ q?: string; risk?: string; att?: string }>
}

export default async function TLAttendancePage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_attendance')
  const params = await searchParams

  const search = params.q ?? ''
  const riskF  = params.risk ?? ''
  const attF   = params.att ?? ''   // 'low' | 'absent' | 'chronic'

  // Reuse enrollment-centric operations data — includes attendance per enrollment
  const rows = await listStudentOperations(user.branchIds)

  // ── Operational KPIs ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)

  const absentToday       = rows.filter(r => r.last_attendance_date !== today && r.total_sessions > 0 && r.consecutive_absences > 0).length
  const chronicAbsence    = rows.filter(r => r.consecutive_absences >= 3).length
  const belowThreshold    = rows.filter(r => r.total_sessions >= 3 && r.attendance_pct < 60).length
  const nearExhaustion    = rows.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions <= 2 && r.remaining_sessions > 0).length
  const unpaidAttending   = rows.filter(r => r.remaining_amount > 0 && r.sessions_attended > 0).length
  const neverAttended     = rows.filter(r => r.total_sessions >= 2 && r.sessions_attended === 0).length

  // ── Filter ────────────────────────────────────────────────────────────────
  let filtered = rows
  if (riskF)       filtered = filtered.filter(r => r.risk_level === riskF)
  if (attF === 'low')     filtered = filtered.filter(r => r.total_sessions >= 3 && r.attendance_pct < 60)
  if (attF === 'chronic') filtered = filtered.filter(r => r.consecutive_absences >= 3)
  if (attF === 'never')   filtered = filtered.filter(r => r.total_sessions >= 2 && r.sessions_attended === 0)
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
    if (a) p.set('att', a)
    if (search) p.set('q', search)
    return `/portal/team-leader/attendance?${p}`
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Attendance Monitor</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Detect risks, chronic absence, and session exhaustion</p>
        </div>
        <Link
          href="/portal/team-leader/attendance/record"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Record Session
        </Link>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Chronic Absence (3+)', value: chronicAbsence,  color: chronicAbsence > 0 ? 'bg-red-400' : 'bg-slate-300',   att: 'chronic' },
          { label: 'Below 60% Attendance', value: belowThreshold,  color: belowThreshold > 0 ? 'bg-amber-400' : 'bg-slate-300', att: 'low' },
          { label: 'Never Attended',        value: neverAttended,   color: neverAttended > 0 ? 'bg-red-400' : 'bg-slate-300',   att: 'never' },
          { label: 'Near Exhaustion',       value: nearExhaustion,  color: nearExhaustion > 0 ? 'bg-amber-400' : 'bg-slate-300', att: '' },
          { label: 'Unpaid + Attending',    value: unpaidAttending, color: unpaidAttending > 0 ? 'bg-orange-400' : 'bg-slate-300', att: '' },
          { label: 'Total Monitored',       value: rows.length,     color: 'bg-blue-400',                                         att: '' },
        ].map(k => (
          <Link
            key={k.label}
            href={attHref(k.att)}
            className={`block rounded-xl border border-[#E2E8F0] bg-white p-3 transition hover:border-[#CBD5E1] ${attF === k.att && k.att ? 'border-[#FF8A1F] bg-orange-50' : ''}`}
          >
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-2">
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No students match the current filters</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Adjust filters or clear them to see all students.</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filtered.slice(0, 50).map(row => (
                <div key={row.enrollment_id ?? row.student_id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/portal/team-leader/students/${row.student_id}`} className="text-[15px] font-semibold text-[#0B1F3A]">
                        {row.student_name}
                      </Link>
                      <p className="text-[12px] text-[#64748B]">{row.group_name ?? '—'}{row.instructor_name ? ` · ${row.instructor_name}` : ''}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold
                      ${row.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : row.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {row.risk_level}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                      <p className={`font-bold text-sm ${row.attendance_pct < 60 ? 'text-red-600' : row.attendance_pct < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{row.attendance_pct}%</p>
                      <p className="text-[#94A3B8]">Attendance</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                      <p className={`font-bold text-sm ${row.consecutive_absences >= 3 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{row.consecutive_absences}</p>
                      <p className="text-[#94A3B8]">Consec. Absent</p>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                      <p className={`font-bold text-sm ${row.enrolled_sessions > 0 && row.remaining_sessions <= 2 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                        {row.enrolled_sessions > 0 ? `${row.remaining_sessions}` : '∞'}
                      </p>
                      <p className="text-[#94A3B8]">Sessions Left</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
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
                      enrolled_sessions:   row.enrolled_sessions,
                      consumed_sessions:   row.consumed_sessions,
                      remaining_sessions:  row.remaining_sessions,
                      total_sessions:      row.total_sessions,
                      sessions_attended:   row.sessions_attended,
                      attendance_pct:      row.attendance_pct,
                      consecutive_absences: row.consecutive_absences,
                      last_attendance_date: row.last_attendance_date,
                      remaining_balance:   row.remaining_amount,
                      days_overdue:        row.days_overdue,
                      financial_status:    row.financial_status,
                      net_amount:          row.net_amount,
                      group_id:            row.group_id,
                      has_assignment_submissions: true,
                    })]
                    return (
                    <tr key={row.enrollment_id ?? row.student_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
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
                          <span className={`font-semibold ${row.attendance_pct < 60 ? 'text-red-600' : row.attendance_pct < 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {row.attendance_pct}%
                          </span>
                          <div className="h-1 w-12 rounded-full bg-[#E2E8F0]">
                            <div
                              className={`h-1 rounded-full ${row.attendance_pct >= 80 ? 'bg-emerald-400' : row.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${row.attendance_pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-[#64748B]">
                        {row.sessions_attended}/{row.total_sessions}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${row.consecutive_absences >= 3 ? 'text-red-600' : row.consecutive_absences >= 1 ? 'text-amber-600' : 'text-[#94A3B8]'}`}>
                          {row.consecutive_absences > 0 ? row.consecutive_absences : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.enrolled_sessions > 0 ? (
                          <span className={`font-semibold ${row.remaining_sessions <= 0 ? 'text-red-600' : row.remaining_sessions <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
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
                            ${row.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : row.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
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
    </div>
  )
}
