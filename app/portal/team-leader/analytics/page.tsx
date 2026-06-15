import { requirePortalRole }      from '@/modules/rbac/guards'
import {
  getTLStudentsOverview,
  getTLGroupsOverview,
  getTLLeadsOverview,
  getTLBranchComparison,
  getTLAssignmentOverview,
  getOperationalAlerts,
}                                  from '@/modules/tl-analytics/queries'
import {
  getFinanceKPIs,
  getCollectionQueue,
  getBrokenPromises,
}                                  from '@/modules/finance/queries'
import {
  getInstructorPerformance,
}                                  from '@/modules/tl-dashboard/queries'
import {
  resolveGroupFilter,
  listAtRiskStudents,
}                                  from '@/modules/analytics/queries'
import Link                        from 'next/link'
import type { AlertSeverity }      from '@/modules/tl-analytics/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function pct(n: number, color = true) {
  const cls = !color ? 'text-[#0B1F3A]' :
    n >= 80 ? 'text-emerald-600' :
    n >= 60 ? 'text-amber-600'   :
              'text-red-600'
  return <span className={`font-semibold ${cls}`}>{n}%</span>
}

type TabKey = 'overview' | 'students' | 'finance' | 'groups' | 'instructors' | 'leads' | 'assignments'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'students',     label: 'Students' },
  { key: 'finance',      label: 'Finance' },
  { key: 'groups',       label: 'Groups' },
  { key: 'instructors',  label: 'Instructors' },
  { key: 'assignments',  label: 'Assignments' },
  { key: 'leads',        label: 'Leads' },
]

const ALERT_SEVERITY_STYLES: Record<AlertSeverity, { border: string; bg: string; text: string; dot: string }> = {
  critical: { border: 'border-red-200',    bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  warning:  { border: 'border-amber-200',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  info:     { border: 'border-blue-200',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ tab?: string; page?: string; semester?: string; sort?: string }>
}

export default async function TLAnalyticsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

  const tab = (params.tab ?? 'overview') as TabKey
  const branchIds = user.branchIds

  if (!branchIds.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator to assign a branch to your account.</p>
      </div>
    )
  }

  function tabHref(key: TabKey) {
    return `/portal/team-leader/analytics?tab=${key}`
  }

  // Load data based on active tab (avoid loading everything on every tab)
  const [
    studentsData,
    financeKPIs,
    groupsData,
    instructorData,
    leadsData,
    branchComparison,
    collectionQueue,
    groupFilter,
    operationalAlerts,
    assignmentData,
    brokenPromises,
  ] = await Promise.all([
    tab === 'overview' || tab === 'students'
      ? getTLStudentsOverview(branchIds)
      : null,
    tab === 'overview' || tab === 'finance'
      ? getFinanceKPIs(branchIds)
      : null,
    tab === 'overview' || tab === 'groups'
      ? getTLGroupsOverview(branchIds)
      : null,
    tab === 'overview' || tab === 'instructors'
      ? getInstructorPerformance(branchIds)
      : null,
    tab === 'overview' || tab === 'leads'
      ? getTLLeadsOverview(branchIds)
      : null,
    branchIds.length > 1
      ? getTLBranchComparison(branchIds)
      : Promise.resolve([]),
    tab === 'finance'
      ? getCollectionQueue(branchIds)
      : null,
    tab === 'students'
      ? resolveGroupFilter(user)
      : null,
    tab === 'overview'
      ? getOperationalAlerts(branchIds)
      : null,
    tab === 'assignments'
      ? getTLAssignmentOverview(branchIds)
      : null,
    tab === 'finance'
      ? getBrokenPromises(branchIds)
      : null,
  ])

  // For at-risk students in students tab
  const atRiskResult = tab === 'students' && groupFilter !== undefined
    ? await listAtRiskStudents(groupFilter, { page: Number(params.page ?? 1), perPage: 10 })
    : null

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">Branch Analytics</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Operational intelligence for your branch{branchIds.length > 1 ? 'es' : ''}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 overflow-x-auto">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && studentsData && financeKPIs && groupsData && instructorData && leadsData && (
        <div className="space-y-6">

          {/* Operational Alerts */}
          {operationalAlerts && operationalAlerts.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">
                Action Required
                <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">{operationalAlerts.length}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {operationalAlerts.map(alert => {
                  const s = ALERT_SEVERITY_STYLES[alert.severity]
                  return (
                    <div key={alert.id} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-start gap-3`}>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${s.text}`}>{alert.title}</p>
                        <p className={`text-xs mt-0.5 ${s.text} opacity-80`}>{alert.detail}</p>
                      </div>
                      {alert.action_href && (
                        <Link href={alert.action_href} className={`shrink-0 text-xs font-medium ${s.text} underline`}>View →</Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Students KPIs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0B1F3A]">Students</h2>
              <Link href={tabHref('students')} className="text-xs text-[#FF8A1F] hover:underline">View details →</Link>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:gap-3 sm:grid-cols-5">
              {[
                { label: 'Active',          value: studentsData.total_active,   color: 'bg-blue-400' },
                { label: 'New This Month',  value: studentsData.new_this_month, color: 'bg-emerald-400' },
                { label: 'Inactive',        value: studentsData.inactive,        color: 'bg-slate-300' },
                { label: 'Attendance Avg',  value: `${studentsData.attendance_avg}%`, color: studentsData.attendance_avg >= 75 ? 'bg-emerald-400' : 'bg-amber-400' },
                { label: 'At Risk',         value: studentsData.at_risk_count,  color: studentsData.at_risk_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
              ].map(k => (
                <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                  <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                  <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                  <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Finance KPIs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0B1F3A]">Finance</h2>
              <Link href={tabHref('finance')} className="text-xs text-[#FF8A1F] hover:underline">View details →</Link>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:gap-3 sm:grid-cols-4">
              {[
                { label: 'Collected This Month', value: `EGP ${fmt(financeKPIs.collected_this_month)}`, color: 'bg-emerald-400' },
                { label: 'Outstanding',          value: `EGP ${fmt(financeKPIs.outstanding_total)}`,    color: 'bg-amber-400' },
                { label: 'Collection Rate',      value: `${financeKPIs.collection_rate_pct}%`,          color: financeKPIs.collection_rate_pct >= 80 ? 'bg-emerald-400' : 'bg-red-400' },
                { label: 'Overdue Accounts',     value: financeKPIs.overdue_count,                      color: financeKPIs.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
              ].map(k => (
                <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                  <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                  <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                  <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Groups KPIs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0B1F3A]">Groups</h2>
              <Link href={tabHref('groups')} className="text-xs text-[#FF8A1F] hover:underline">View details →</Link>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:gap-3 sm:grid-cols-4">
              {[
                { label: 'Active Groups',      value: groupsData.total_active,       color: 'bg-blue-400' },
                { label: 'No Instructor',      value: groupsData.without_instructor, color: groupsData.without_instructor > 0 ? 'bg-amber-400' : 'bg-slate-300' },
                { label: 'No Course',          value: groupsData.without_course,     color: groupsData.without_course > 0 ? 'bg-amber-400' : 'bg-slate-300' },
                { label: 'Low Attendance',     value: groupsData.low_attendance,     color: groupsData.low_attendance > 0 ? 'bg-red-400' : 'bg-slate-300' },
              ].map(k => (
                <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                  <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                  <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                  <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Leads KPIs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0B1F3A]">Leads</h2>
              <Link href={tabHref('leads')} className="text-xs text-[#FF8A1F] hover:underline">View details →</Link>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:gap-3 sm:grid-cols-4">
              {[
                { label: 'New This Month',    value: leadsData.new_this_month,      color: 'bg-blue-400' },
                { label: 'Converted',         value: leadsData.converted_this_month,color: 'bg-emerald-400' },
                { label: 'Conversion Rate',   value: `${leadsData.conversion_rate_pct}%`, color: leadsData.conversion_rate_pct >= 20 ? 'bg-emerald-400' : 'bg-amber-400' },
                { label: 'Overdue Follow-ups',value: leadsData.overdue_followups,   color: leadsData.overdue_followups > 0 ? 'bg-red-400' : 'bg-slate-300' },
              ].map(k => (
                <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                  <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                  <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                  <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Branch comparison (multi-branch only) */}
          {branchComparison.length > 1 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Branch Comparison</h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['Branch', 'Students', 'Groups', 'Collection', 'Attendance', 'At Risk', 'New Leads'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branchComparison.map(b => (
                      <tr key={b.branch_id} className="border-b border-[#E2E8F0] last:border-0">
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{b.branch_name}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{b.active_students}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{b.active_groups}</td>
                        <td className="px-4 py-2.5">{pct(b.collection_rate)}</td>
                        <td className="px-4 py-2.5">{pct(b.attendance_avg)}</td>
                        <td className="px-4 py-2.5">
                          {b.at_risk_count > 0
                            ? <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{b.at_risk_count}</span>
                            : <span className="text-xs text-[#94A3B8]">0</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B]">{b.leads_new}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── STUDENTS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'students' && studentsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Active Students',   value: studentsData.total_active,   color: 'bg-blue-400' },
              { label: 'New This Month',    value: studentsData.new_this_month, color: 'bg-emerald-400' },
              { label: 'Inactive',          value: studentsData.inactive,        color: 'bg-slate-300' },
              { label: 'Monthly Attendance',value: `${studentsData.attendance_avg}%`, color: studentsData.attendance_avg >= 75 ? 'bg-emerald-400' : 'bg-amber-400' },
              { label: 'At Risk',           value: studentsData.at_risk_count,  color: studentsData.at_risk_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
              </div>
            ))}
          </div>

          {atRiskResult && atRiskResult.data.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">
                At-Risk Students
                <span className="ml-2 text-sm font-normal text-[#64748B]">({atRiskResult.total} total)</span>
              </h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['Student', 'Group', 'Attendance', 'Completion', 'Assignment', 'Risk Flags'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskResult.data.map(s => (
                      <tr key={`${s.student_id}-${s.course_id}`} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-2.5">
                          <Link href={`/portal/team-leader/students/${s.student_id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{s.student_name}</Link>
                          <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B]">{s.group_name}</td>
                        <td className="px-4 py-2.5">{pct(s.attendance_score)}</td>
                        <td className="px-4 py-2.5">{pct(s.completion_percentage)}</td>
                        <td className="px-4 py-2.5">{pct(s.assignment_score)}</td>
                        <td className="px-4 py-2.5">
                          {s.risk_reasons.map(r => (
                            <span key={r} className="mr-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                              {r === 'low_completion' ? 'Low Overall' : 'Low Attendance'}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {atRiskResult && atRiskResult.data.length === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-emerald-600 font-medium">No at-risk students.</p>
              <p className="mt-1 text-xs text-[#94A3B8]">All students are on track.</p>
            </div>
          )}
        </div>
      )}

      {/* ── FINANCE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'finance' && financeKPIs && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Collected This Month', value: `EGP ${fmt(financeKPIs.collected_this_month)}`,  color: 'bg-emerald-400' },
              { label: 'Outstanding',          value: `EGP ${fmt(financeKPIs.outstanding_total)}`,     color: 'bg-amber-400' },
              { label: 'Due This Week',        value: financeKPIs.due_this_week,                       color: financeKPIs.due_this_week > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'Overdue Accounts',     value: financeKPIs.overdue_count,                       color: financeKPIs.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Collection Rate card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#64748B]">Collection Rate</span>
              <span className={`text-2xl font-bold ${financeKPIs.collection_rate_pct >= 80 ? 'text-emerald-600' : financeKPIs.collection_rate_pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {financeKPIs.collection_rate_pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${financeKPIs.collection_rate_pct >= 80 ? 'bg-emerald-500' : financeKPIs.collection_rate_pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, financeKPIs.collection_rate_pct)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#94A3B8]">
              <span>{financeKPIs.paid_students} paid</span>
              <span>{financeKPIs.total_students} total accounts</span>
            </div>
          </div>

          {/* Collection queue preview */}
          {collectionQueue && (collectionQueue.overdue30.length > 0 || collectionQueue.overdue14.length > 0 || collectionQueue.dueThisWeek.length > 0) && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-[#0B1F3A]">Collection Queue</h2>
                <Link href="/portal/team-leader/finance" className="text-xs text-[#FF8A1F] hover:underline">View all →</Link>
              </div>

              {collectionQueue.overdue30.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-medium text-red-600">Overdue 30+ days ({collectionQueue.overdue30.length})</p>
                  <div className="rounded-xl border border-red-100 bg-red-50 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {collectionQueue.overdue30.slice(0, 5).map(item => (
                          <tr key={item.account_id} className="border-b border-red-100 last:border-0">
                            <td className="px-4 py-2 font-medium text-[#0B1F3A]">{item.student_name}</td>
                            <td className="px-4 py-2 text-[#64748B] text-xs">{item.group_name ?? '—'}</td>
                            <td className="px-4 py-2 text-right font-medium text-red-600">EGP {fmt(item.remaining_amount)}</td>
                            <td className="px-4 py-2 text-right text-xs text-[#94A3B8]">{item.days_overdue}d overdue</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {collectionQueue.dueThisWeek.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-amber-600">Due This Week ({collectionQueue.dueThisWeek.length})</p>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {collectionQueue.dueThisWeek.slice(0, 5).map(item => (
                          <tr key={item.account_id} className="border-b border-amber-100 last:border-0">
                            <td className="px-4 py-2 font-medium text-[#0B1F3A]">{item.student_name}</td>
                            <td className="px-4 py-2 text-[#64748B] text-xs">{item.group_name ?? '—'}</td>
                            <td className="px-4 py-2 text-right font-medium text-amber-700">EGP {fmt(item.remaining_amount)}</td>
                            <td className="px-4 py-2 text-right text-xs text-[#94A3B8]">{item.next_due_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
          {collectionQueue && collectionQueue.overdue30.length === 0 && collectionQueue.overdue14.length === 0 && collectionQueue.dueThisWeek.length === 0 && financeKPIs.total_students === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No financial accounts in this branch yet.</p>
              <Link href="/portal/team-leader/finance/new" className="mt-2 inline-block text-xs text-[#FF8A1F]">Create first account →</Link>
            </div>
          )}

          {/* Broken Promises */}
          {brokenPromises && brokenPromises.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">
                Broken Payment Promises
                <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">{brokenPromises.length}</span>
              </h2>
              <div className="rounded-xl border border-red-100 bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Promised</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Due Date</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokenPromises.slice(0, 8).map(p => (
                      <tr key={p.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{p.student_name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-[#64748B]">EGP {fmt(p.promised_amount)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-red-600">{p.promised_date}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-red-600">EGP {fmt(p.remaining_amount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── GROUPS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'groups' && groupsData && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Active Groups',    value: groupsData.total_active,       color: 'bg-blue-400' },
              { label: 'No Instructor',    value: groupsData.without_instructor, color: groupsData.without_instructor > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'No Active Course', value: groupsData.without_course,     color: groupsData.without_course > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'Low Attendance',   value: groupsData.low_attendance,     color: groupsData.low_attendance > 0 ? 'bg-red-400' : 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
              </div>
            ))}
          </div>

          {groupsData.groups.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No active groups found.</p>
              <Link href="/portal/team-leader/groups/new" className="mt-2 inline-block text-xs text-[#FF8A1F]">Create a group →</Link>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Group', ...(branchIds.length > 1 ? ['Branch'] : []), 'Students', 'Instructor', 'Course', 'Attendance'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupsData.groups.map(g => (
                    <tr key={g.group_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5">
                        <Link href={`/portal/team-leader/groups/${g.group_id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{g.group_name}</Link>
                      </td>
                      {branchIds.length > 1 && <td className="px-4 py-2.5 text-xs text-[#64748B]">{g.branch_name ?? '—'}</td>}
                      <td className="px-4 py-2.5 text-[#64748B]">{g.student_count}</td>
                      <td className="px-4 py-2.5">
                        {g.has_instructor
                          ? <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Yes</span>
                          : <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Missing</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.has_active_course
                          ? <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Yes</span>
                          : <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Missing</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.attendance_avg > 0 ? pct(g.attendance_avg) : <span className="text-xs text-[#94A3B8]">No data</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── INSTRUCTORS TAB ───────────────────────────────────────────────────── */}
      {tab === 'instructors' && instructorData && (
        <div className="space-y-5">
          {instructorData.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No instructor data found.</p>
              <Link href="/portal/team-leader/instructors/new" className="mt-2 inline-block text-xs text-[#FF8A1F]">Add instructor →</Link>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Instructor', 'Groups', 'Students', 'Satisfaction', 'HW Review', 'Portfolio', 'Attendance'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instructorData.map(i => (
                    <tr key={i.instructor_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                        <Link href={`/portal/team-leader/instructors/${i.instructor_id}`} className="hover:text-[#FF8A1F]">{i.instructor_name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B]">{i.active_groups}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{i.active_students}</td>
                      <td className="px-4 py-2.5">
                        {i.avg_student_rating !== null
                          ? <span className={`font-semibold ${i.avg_student_rating >= 4 ? 'text-emerald-600' : i.avg_student_rating >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                              {i.avg_student_rating.toFixed(1)} / 5
                            </span>
                          : <span className="text-xs text-[#94A3B8]">No feedback</span>}
                      </td>
                      <td className="px-4 py-2.5">{pct(i.homework_review_pct)}</td>
                      <td className="px-4 py-2.5">{pct(i.portfolio_review_pct)}</td>
                      <td className="px-4 py-2.5">{pct(i.attendance_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS TAB ────────────────────────────────────────────────────────── */}
      {tab === 'leads' && leadsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Leads',        value: leadsData.total,               color: 'bg-blue-400' },
              { label: 'New This Month',     value: leadsData.new_this_month,      color: 'bg-emerald-400' },
              { label: 'Converted',          value: leadsData.converted_this_month,color: 'bg-emerald-400' },
              { label: 'Overdue Follow-ups', value: leadsData.overdue_followups,   color: leadsData.overdue_followups > 0 ? 'bg-red-400' : 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Conversion rate */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <h3 className="mb-3 text-sm font-medium text-[#64748B]">Conversion Rate</h3>
              <p className={`text-xl font-bold md:text-3xl ${leadsData.conversion_rate_pct >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {leadsData.conversion_rate_pct}%
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-[#F1F5F9]">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, leadsData.conversion_rate_pct)}%` }}
                />
              </div>
              {leadsData.avg_days_to_convert !== null && (
                <p className="mt-2 text-xs text-[#94A3B8]">Avg {leadsData.avg_days_to_convert} days to convert</p>
              )}
            </div>

            {/* Leads by status */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <h3 className="mb-3 text-sm font-medium text-[#64748B]">By Status</h3>
              {leadsData.by_status.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No leads yet.</p>
              ) : (
                <div className="space-y-2">
                  {leadsData.by_status.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-xs capitalize text-[#64748B]">
                        {s.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-[#FF8A1F]" style={{ width: `${Math.round((s.count / leadsData.total) * 80)}px` }} />
                        <span className="text-xs font-medium text-[#0B1F3A]">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Source performance */}
          {leadsData.by_source.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Lead Sources</h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Source</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Count</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsData.by_source.map(s => (
                      <tr key={s.source} className="border-b border-[#E2E8F0] last:border-0">
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A] capitalize">{s.source.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{s.count}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-[#F1F5F9]">
                              <div
                                className="h-full rounded-full bg-[#FF8A1F]"
                                style={{ width: `${leadsData.total > 0 ? Math.round((s.count / leadsData.total) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#64748B]">
                              {leadsData.total > 0 ? Math.round((s.count / leadsData.total) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {leadsData.total === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No leads in your branch yet.</p>
              <Link href="/portal/team-leader/leads/new" className="mt-2 inline-block text-xs text-[#FF8A1F]">Add a lead →</Link>
            </div>
          )}
        </div>
      )}

      {/* ── ASSIGNMENTS TAB ───────────────────────────────────────────────────── */}
      {tab === 'assignments' && assignmentData && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Published',       value: assignmentData.kpis.total_published,      color: 'bg-blue-400' },
              { label: 'Overdue',         value: assignmentData.kpis.overdue_count,         color: assignmentData.kpis.overdue_count > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'Avg Completion',  value: `${assignmentData.kpis.avg_completion_pct}%`, color: assignmentData.kpis.avg_completion_pct >= 70 ? 'bg-emerald-400' : 'bg-red-400' },
              { label: 'Pending Review',  value: assignmentData.kpis.pending_review_count, color: assignmentData.kpis.pending_review_count > 0 ? 'bg-amber-400' : 'bg-slate-300' },
              { label: 'Delayed 3d+',    value: assignmentData.kpis.grading_delay_count,  color: assignmentData.kpis.grading_delay_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
            ].map(k => (
              <div key={k.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-2 py-1.5 md:p-3">
                <div className={`mb-0.5 h-0.5 w-3 rounded-full ${k.color} opacity-80 md:mb-1.5 md:h-1 md:w-6`} />
                <p className="truncate text-[13px] font-bold leading-none text-[#0B1F3A] md:text-lg">{k.value}</p>
                <p className="mt-0.5 truncate text-[8px] leading-tight text-[#64748B] md:text-[11px]">{k.label}</p>
              </div>
            ))}
          </div>

          {/* By instructor */}
          {assignmentData.by_instructor.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Instructor Review Status</h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['Instructor', 'Assignments', 'Avg Completion', 'Pending', 'Delayed 3d+'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentData.by_instructor.map(i => (
                      <tr key={i.instructor_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                          <Link href={`/portal/team-leader/instructors/${i.instructor_id}`} className="hover:text-[#FF8A1F]">{i.instructor_name}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B]">{i.assignment_count}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-[#F1F5F9]">
                              <div className={`h-full rounded-full ${i.avg_completion_pct >= 70 ? 'bg-emerald-500' : i.avg_completion_pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${i.avg_completion_pct}%` }} />
                            </div>
                            <span className="text-xs text-[#64748B]">{i.avg_completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {i.pending_review > 0
                            ? <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{i.pending_review}</span>
                            : <span className="text-xs text-[#94A3B8]">0</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {i.grading_delay > 0
                            ? <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{i.grading_delay}</span>
                            : <span className="text-xs text-[#94A3B8]">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* By group */}
          {assignmentData.by_group.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Group Assignment Health</h2>
              <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['Group', 'Assignments', 'Submissions', 'Graded', 'Completion', 'Overdue'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentData.by_group.map(g => (
                      <tr key={g.group_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                          <Link href={`/portal/team-leader/groups/${g.group_id}`} className="hover:text-[#FF8A1F]">{g.group_name}</Link>
                          {g.branch_name && branchIds.length > 1 && <div className="text-[11px] text-[#94A3B8]">{g.branch_name}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-[#64748B]">{g.assignment_count}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{g.submission_count}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{g.graded_count}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-[#F1F5F9]">
                              <div className={`h-full rounded-full ${g.completion_pct >= 70 ? 'bg-emerald-500' : g.completion_pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${g.completion_pct}%` }} />
                            </div>
                            <span className="text-xs text-[#64748B]">{g.completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {g.overdue_count > 0
                            ? <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{g.overdue_count}</span>
                            : <span className="text-xs text-[#94A3B8]">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {assignmentData.kpis.total_published === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center">
              <p className="text-sm text-[#94A3B8]">No published assignments in your branches yet.</p>
              <Link href="/portal/team-leader/assignments/new" className="mt-2 inline-block text-xs text-[#FF8A1F]">Create first assignment →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
