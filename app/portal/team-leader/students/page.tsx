import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { createServiceClient }                  from '@/lib/supabase/service'
import { listStudentOperations, getFilterOptions } from '@/modules/finance/queries'
import { evaluate, ATTENDANCE_TREND_CONFIG, RISK_LEVEL_CLASSES } from '@/modules/operational-engine'
import Link                                      from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

interface Props {
  searchParams: Promise<{
    page?: string; q?: string; status?: string
    branch_id?: string; course_id?: string; instructor_id?: string; risk?: string
  }>
}

export default async function TLStudentsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_students')
  const params = await searchParams

  const search = params.q ?? ''
  const riskFilter = params.risk ?? ''

  // Load enrollment-centric rows + filter options
  const [rows, filterOptions] = await Promise.all([
    listStudentOperations(user.branchIds),
    getFilterOptions(user.branchIds),
  ])

  // Apply client-side filters (search + risk)
  const filtered = rows.filter(r => {
    if (riskFilter && r.risk_level !== riskFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const nameMatch = r.student_name.toLowerCase().includes(q)
      const codeMatch = r.student_code?.toLowerCase().includes(q) ?? false
      const phoneMatch = r.student_phone?.includes(q) ?? false
      const parentMatch = r.parent_name?.toLowerCase().includes(q) ?? false
      const instrMatch = r.instructor_name?.toLowerCase().includes(q) ?? false
      const groupMatch = r.group_name?.toLowerCase().includes(q) ?? false
      if (!nameMatch && !codeMatch && !phoneMatch && !parentMatch && !instrMatch && !groupMatch) return false
    }
    return true
  })

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const totalActive    = rows.length
  const highRisk       = rows.filter(r => r.risk_level === 'HIGH').length
  const overdue        = rows.filter(r => (r.days_overdue ?? 0) > 0 && r.remaining_amount > 0).length
  const lowAttendance  = rows.filter(r => r.total_sessions >= 3 && r.attendance_pct < 60).length
  const nearExhaustion = rows.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions <= 2 && r.remaining_sessions > 0).length
  const unpaidStudents = rows.filter(r => r.remaining_amount > 0).length
  const totalRemaining = rows.reduce((s, r) => s + r.remaining_amount, 0)

  const kpis = [
    { label: 'Active Students',    value: totalActive,                    color: 'bg-blue-400',    link: '' },
    { label: 'High Risk',          value: highRisk,                       color: highRisk > 0 ? 'bg-red-400' : 'bg-slate-300',     link: '?risk=HIGH' },
    { label: 'Overdue Payment',    value: overdue,                        color: overdue > 0 ? 'bg-red-400' : 'bg-slate-300',      link: '' },
    { label: 'Low Attendance',     value: lowAttendance,                  color: lowAttendance > 0 ? 'bg-amber-400' : 'bg-slate-300', link: '' },
    { label: 'Near Exhaustion',    value: nearExhaustion,                 color: nearExhaustion > 0 ? 'bg-amber-400' : 'bg-slate-300', link: '' },
    { label: 'Unpaid',             value: unpaidStudents,                 color: unpaidStudents > 0 ? 'bg-orange-400' : 'bg-slate-300', link: '' },
    { label: 'Outstanding',        value: `EGP ${fmt(totalRemaining)}`,   color: 'bg-amber-400',   link: '' },
  ]

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Students</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{filtered.length} enrollment contracts</p>
        </div>
        <Link
          href="/portal/team-leader/students/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Student
        </Link>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search name, code, phone…"
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none min-w-55"
        />
        <select
          name="risk"
          defaultValue={riskFilter}
          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
        >
          <option value="">All Risk Levels</option>
          <option value="HIGH">High Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="LOW">Low Risk</option>
        </select>
        <button type="submit" className="rounded-xl bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]">
          Filter
        </button>
        {(search || riskFilter) && (
          <Link href="/portal/team-leader/students" className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
            Clear
          </Link>
        )}
      </form>

      {/* ── Table / Cards ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No students found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">{search ? 'Try a different search.' : 'Add the first student to get started.'}</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filtered.map(row => {
                const eng = evaluate({
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
                })
                const actions = eng.actions
                const trend   = ATTENDANCE_TREND_CONFIG[eng.attendance_trend]
                return (
                  <div key={row.enrollment_id ?? row.student_id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/portal/team-leader/students/${row.student_id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">
                          {row.student_name}
                        </Link>
                        {row.student_code && <p className="mt-0.5 font-mono text-[11px] text-[#94A3B8]">#{row.student_code}</p>}
                        {row.group_name && <p className="text-[12px] text-[#64748B]">{row.group_name}{row.instructor_name ? ` · ${row.instructor_name}` : ''}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold
                        ${row.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : row.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {row.risk_level}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className="font-bold text-[#0B1F3A]">{row.attendance_pct}%</p>
                        <p className="text-[#94A3B8]">Attendance</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className={`font-bold ${row.remaining_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {row.remaining_amount > 0 ? `EGP ${fmt(row.remaining_amount)}` : 'Paid'}
                        </p>
                        <p className="text-[#94A3B8]">Balance</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-center">
                        <p className={`font-bold ${row.enrolled_sessions > 0 && row.remaining_sessions <= 2 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
                          {row.enrolled_sessions > 0 ? `${row.remaining_sessions}/${row.enrolled_sessions}` : '∞'}
                        </p>
                        <p className="text-[#94A3B8]">Sessions</p>
                      </div>
                    </div>
                    {actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {actions.slice(0, 2).map(a => (
                          <span key={a.code} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.color} ${a.textColor}`}>
                            {a.icon} {a.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      {row.parent_phone_1 && (
                        <a href={`tel:${row.parent_phone_1}`} className="text-[12px] text-[#64748B]">{row.parent_phone_1}</a>
                      )}
                      <Link href={`/portal/team-leader/students/${row.student_id}`} className="ml-auto rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        View →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Course / Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Sessions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Actions Needed</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const eng2 = evaluate({
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
                    })
                    const actions2 = eng2.actions
                    const trend2   = ATTENDANCE_TREND_CONFIG[eng2.attendance_trend]
                    return (
                      <tr key={row.enrollment_id ?? row.student_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <Link href={`/portal/team-leader/students/${row.student_id}`} className="block font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                            {row.student_name}
                          </Link>
                          {row.student_code && <span className="font-mono text-[10px] text-[#94A3B8]">#{row.student_code}</span>}
                          {row.student_phone && <p className="text-[11px] text-[#94A3B8]">{row.student_phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[#0B1F3A]">{row.group_name ?? '—'}</p>
                          {row.instructor_name && <p className="text-[11px] text-[#94A3B8]">{row.instructor_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {row.enrolled_sessions > 0 ? (
                            <div>
                              <p className={`font-medium ${row.remaining_sessions <= 2 ? 'text-red-600' : row.remaining_sessions <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {row.remaining_sessions} left
                              </p>
                              <p className="text-[11px] text-[#94A3B8]">{row.consumed_sessions}/{row.enrolled_sessions} used</p>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-[#E2E8F0]">
                              <div
                                className={`h-1.5 rounded-full ${row.attendance_pct >= 80 ? 'bg-emerald-400' : row.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${row.attendance_pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#64748B]">{row.attendance_pct}%</span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">{row.sessions_attended}/{row.total_sessions} sessions</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.remaining_amount > 0 ? (
                            <div>
                              <p className={`font-medium ${(row.days_overdue ?? 0) > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                                EGP {fmt(row.remaining_amount)}
                              </p>
                              {(row.days_overdue ?? 0) > 0 && (
                                <p className="text-[10px] text-red-500">{row.days_overdue}d overdue</p>
                              )}
                            </div>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Paid</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                              ${row.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : row.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {row.risk_level}
                            </span>
                            {eng2.attendance_trend !== 'STABLE' && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${trend2.color} ${trend2.text}`}>
                                {trend2.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {actions2.slice(0, 2).map((a: import('@/modules/operational-engine').RecommendedAction) => (
                              <span key={a.code} title={a.description} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.color} ${a.textColor}`}>
                                {a.icon} {a.label}
                              </span>
                            ))}
                            {actions2.length === 0 && <span className="text-[11px] text-[#94A3B8]">None</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[12px] text-[#64748B]">{row.parent_name ?? '—'}</p>
                          {row.parent_phone_1 && (
                            <a href={`tel:${row.parent_phone_1}`} className="text-[11px] text-[#94A3B8] hover:text-[#FF8A1F]">{row.parent_phone_1}</a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/students/${row.student_id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">View</Link>
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
    </div>
  )
}
