import { requirePortalRole }     from '@/modules/rbac/guards'
import {
  getTLKPIs,
  getTodaysClasses,
  getTodayAttendanceSummary,
  getAtRiskStudents,
  getPortfolioQueue,
  getCertReadyStudents,
}                                 from '@/modules/tl-dashboard/queries'
import { getTLMessageCounts }    from '@/modules/parent-messages/queries'
import { getOperationalAlerts }  from '@/modules/tl-analytics/queries'
import Link                       from 'next/link'

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, href, color = 'text-[#0B1F3A]', alert = false,
}: {
  label: string; value: string; sub?: string; href?: string
  color?: string; alert?: boolean
}) {
  const cls = [
    'rounded-xl border bg-white p-5 transition',
    alert ? 'border-orange-200 bg-orange-50' : 'border-[#E2E8F0] hover:border-[#CBD5E1]',
  ].join(' ')
  const inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{sub}</p>}
    </>
  )
  return href
    ? <Link href={href} className={cls}>{inner}</Link>
    : <div className={cls}>{inner}</div>
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#0B1F3A]">{title}</h2>
      {sub && <p className="mt-0.5 text-[12px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

const QUICK_ACTIONS = [
  { label: 'Add Student',         href: '/portal/team-leader/students/new',           icon: '👤' },
  { label: 'New Group',           href: '/portal/team-leader/groups/new',             icon: '📚' },
  { label: 'Review Portfolios',   href: '/portal/team-leader/portfolio',              icon: '🖼' },
  { label: 'Parent Messages',     href: '/portal/team-leader/parent-feedback?tab=messages', icon: '💬' },
  { label: 'Instructor Metrics',  href: '/portal/team-leader/instructor-performance', icon: '📊' },
  { label: 'Satisfaction Reviews',href: '/portal/team-leader/parent-feedback?tab=reviews',  icon: '⭐' },
]

// ─────────────────────────────────────────────────────────────────────────────

export default async function TLDashboardPage() {
  const user = await requirePortalRole('team_leader')

  if (!user.branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned to your account. Contact a super admin.
      </div>
    )
  }

  const branchIds = user.branchIds

  const [kpis, todaysClasses, todayAtt, atRisk, portfolioQueue, certReady, msgCounts, alerts] =
    await Promise.all([
      getTLKPIs(branchIds),
      getTodaysClasses(branchIds),
      getTodayAttendanceSummary(branchIds),
      getAtRiskStudents(branchIds),
      getPortfolioQueue(branchIds),
      getCertReadyStudents(branchIds),
      getTLMessageCounts(branchIds),
      getOperationalAlerts(branchIds),
    ])

  const satDisplay = kpis.parent_satisfaction_avg != null
    ? `${kpis.parent_satisfaction_avg}★`
    : '—'

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Team Leader Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Branch operations overview</p>
      </div>

      {/* Operational Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 4).map(alert => {
            const isCritical = alert.severity === 'critical'
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                  isCritical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`} />
                <p className={`flex-1 text-sm font-medium ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                  {alert.title}
                </p>
                {alert.action_href && (
                  <Link href={alert.action_href} className={`shrink-0 text-xs font-medium underline ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                    Act →
                  </Link>
                )}
              </div>
            )
          })}
          {alerts.length > 4 && (
            <Link href="/portal/team-leader/analytics?tab=overview" className="block text-center text-xs text-[#FF8A1F] hover:underline">
              +{alerts.length - 4} more alerts → View analytics
            </Link>
          )}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard
          label="Active Students"
          value={String(kpis.active_students)}
          href="/portal/team-leader/students"
        />
        <KPICard
          label="Monthly Attendance"
          value={`${kpis.monthly_attendance_pct}%`}
          color={kpis.monthly_attendance_pct >= 75 ? 'text-green-600' : 'text-red-600'}
          alert={kpis.monthly_attendance_pct < 75}
        />
        <KPICard
          label="Homework Completion"
          value={`${kpis.homework_completion_pct}%`}
          color={kpis.homework_completion_pct >= 60 ? 'text-[#0B1F3A]' : 'text-orange-600'}
        />
        <KPICard
          label="Parent Satisfaction"
          value={satDisplay}
          color="text-[#FF8A1F]"
          href="/portal/team-leader/parent-feedback?tab=reviews"
        />
        <KPICard
          label="Pending Reviews"
          value={String(kpis.pending_portfolio_count)}
          color={kpis.pending_portfolio_count > 0 ? 'text-amber-600' : 'text-[#0B1F3A]'}
          href="/portal/team-leader/portfolio"
          alert={kpis.pending_portfolio_count > 0}
        />
        <KPICard
          label="Cert Ready"
          value={String(kpis.cert_ready_count)}
          color={kpis.cert_ready_count > 0 ? 'text-green-600' : 'text-[#0B1F3A]'}
        />
      </div>

      {/* Today's operations */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Today's Classes */}
        <div className="space-y-3">
          <SectionHeader
            title="Today's Classes"
            sub={todaysClasses.length === 0 ? 'No classes scheduled today' : `${todaysClasses.length} scheduled`}
          />
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            {todaysClasses.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#94A3B8]">No classes scheduled for today.</p>
            ) : (
              <div className="divide-y divide-[#F8FAFC]">
                {todaysClasses.map(cls => (
                  <div key={cls.schedule_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#0B1F3A]">{cls.group_name}</p>
                      <p className="truncate text-[11px] text-[#64748B]">
                        {cls.course_title}
                        {cls.instructor_name && ` · ${cls.instructor_name}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-medium text-[#0B1F3A]">
                        {new Date(cls.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">{cls.student_count} students</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's Attendance + Open Messages */}
        <div className="space-y-4">
          {/* Attendance */}
          <div>
            <SectionHeader title="Today's Attendance" />
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: 'Present', value: todayAtt.present, cls: 'text-green-600 bg-green-50 border-green-100' },
                { label: 'Absent',  value: todayAtt.absent,  cls: 'text-red-600   bg-red-50   border-red-100'   },
                { label: 'Late',    value: todayAtt.late,    cls: 'text-amber-600 bg-amber-50 border-amber-100'  },
              ].map(({ label, value, cls }) => (
                <div key={label} className={`rounded-xl border px-3 py-4 text-center ${cls}`}>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="mt-0.5 text-[11px] font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Open messages */}
          {msgCounts.open > 0 && (
            <Link
              href="/portal/team-leader/parent-feedback?tab=messages"
              className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 transition hover:bg-orange-100"
            >
              <div>
                <p className="text-sm font-semibold text-orange-700">Open Parent Messages</p>
                <p className="text-[12px] text-orange-600">Requires your attention</p>
              </div>
              <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">
                {msgCounts.open}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Action Required */}
      {(atRisk.length > 0 || portfolioQueue.length > 0 || certReady.length > 0) && (
        <div className="space-y-4">
          <SectionHeader title="Action Required" />
          <div className="grid gap-4 lg:grid-cols-3">

            {/* At-Risk Students */}
            {atRisk.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-white overflow-hidden">
                <div className="border-b border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-red-700">⚠ At Risk Students</p>
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{atRisk.length}</span>
                </div>
                <div className="divide-y divide-[#F8FAFC]">
                  {atRisk.slice(0, 5).map(s => (
                    <Link
                      key={s.student_id}
                      href={`/portal/team-leader/students/${s.student_id}`}
                      className="block px-4 py-3 hover:bg-[#F8FAFC]"
                    >
                      <p className="text-[13px] font-medium text-[#0B1F3A]">{s.student_name}</p>
                      <p className="text-[11px] text-[#94A3B8]">{s.group_name ?? '—'}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.risk_reasons.map(r => (
                          <span key={r} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">{r}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Queue */}
            {portfolioQueue.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-white overflow-hidden">
                <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-amber-700">🖼 Portfolio Queue</p>
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{portfolioQueue.length}</span>
                </div>
                <div className="divide-y divide-[#F8FAFC]">
                  {portfolioQueue.slice(0, 5).map(p => (
                    <Link
                      key={p.project_id}
                      href="/portal/team-leader/portfolio"
                      className="block px-4 py-3 hover:bg-[#F8FAFC]"
                    >
                      <p className="text-[13px] font-medium text-[#0B1F3A]">{p.project_title}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {p.student_name}
                        {p.category && ` · ${p.category}`}
                        {' · '}
                        {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    </Link>
                  ))}
                </div>
                <div className="border-t border-amber-100 px-4 py-2">
                  <Link href="/portal/team-leader/portfolio" className="text-[12px] font-medium text-amber-600 hover:underline">
                    Review all →
                  </Link>
                </div>
              </div>
            )}

            {/* Cert Ready */}
            {certReady.length > 0 && (
              <div className="rounded-xl border border-green-100 bg-white overflow-hidden">
                <div className="border-b border-green-100 bg-green-50 px-4 py-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-green-700">🏆 Certificate Ready</p>
                  <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-bold text-white">{certReady.length}</span>
                </div>
                <div className="divide-y divide-[#F8FAFC]">
                  {certReady.slice(0, 5).map(s => (
                    <div key={s.student_id} className="px-4 py-3">
                      <p className="text-[13px] font-medium text-[#0B1F3A]">{s.student_name}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {s.course_title ?? s.group_name ?? '—'}
                        {` · ${Math.round(s.completion_pct)}%`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACTIONS.map(({ label, href, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-4 text-center text-[13px] font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
            >
              <span className="text-2xl">{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
