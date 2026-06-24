import { requirePortalRole }                    from '@/modules/rbac/guards'
import { getParentChildren, getChildDashboardData, getChildEnrollmentContracts } from '@/modules/parents/parent-portal-queries'
import { getChildSessionsProgress }             from '@/modules/parents/parent-portal-queries'
import { getPendingFeedbackMilestone }           from '@/modules/parent-feedback/queries'
import Link                                      from 'next/link'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  searchParams: Promise<{ child?: string }>
}

// ── Icon helpers ───────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full'
  if (type === 'attendance_marked')
    return <span className={`${base} bg-[#E7F8EE] text-[#10B981]`}>✓</span>
  if (type === 'homework_submitted')
    return <span className={`${base} bg-[#EFF6FF] text-[#2563EB]`}>📄</span>
  if (type === 'homework_graded')
    return <span className={`${base} bg-indigo-100 text-indigo-600`}>✦</span>
  if (type === 'portfolio_uploaded')
    return <span className={`${base} bg-purple-100 text-purple-600`}>🖼</span>
  if (type === 'portfolio_approved')
    return <span className={`${base} bg-[#E7F8EE] text-[#10B981]`}>★</span>
  if (type === 'certificate_earned')
    return <span className={`${base} bg-[#FF8A1F]/15 text-[#FF8A1F]`}>🏆</span>
  return <span className={`${base} bg-[#F3F4F6] text-[#6B7280]`}>•</span>
}

function ProgressBar({ value, color = 'bg-[#FF8A1F]' }: { value: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

export default async function ParentDashboardPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#0B1F3A]">No children linked</p>
          <p className="mt-1 text-sm text-[#64748B]">
            Contact your administrator to link your children to this account.
          </p>
        </div>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const [dashboard, sessions, contracts] = await Promise.all([
    getChildDashboardData(user.id, selected.student_id),
    getChildSessionsProgress(user.id, selected.student_id),
    getChildEnrollmentContracts(user.id, selected.student_id),
  ])

  const pendingMilestone = dashboard
    ? await getPendingFeedbackMilestone(user.id, selected.student_id, sessions?.completed_sessions ?? 0)
    : null

  const childHref  = (path: string) => `${path}?child=${selected.student_id}`
  const completedS = sessions?.completed_sessions ?? 0
  const totalS     = sessions?.total_sessions     ?? 0
  const courseProgress = totalS > 0 ? Math.round((completedS / totalS) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Multi-child switcher */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <Link
              key={c.student_id}
              href={`/portal/parent?child=${c.student_id}`}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
                c.student_id === selected.student_id
                  ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]',
              ].join(' ')}
            >
              <span className={[
                'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                c.student_id === selected.student_id ? 'bg-[#FF8A1F] text-white' : 'bg-[#E2E8F0] text-[#64748B]',
              ].join(' ')}>
                {c.student_name.charAt(0).toUpperCase()}
              </span>
              {c.student_name}
            </Link>
          ))}
        </div>
      )}

      {/* Feedback prompt */}
      {pendingMilestone && (
        <div className="rounded-xl border border-[#FF8A1F]/30 bg-[#FFF7ED] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#0B1F3A]">Share Your Feedback</p>
              <p className="mt-0.5 text-sm text-[#64748B]">
                {selected.student_name} has completed {pendingMilestone} sessions.
                We would love to hear from you!
              </p>
            </div>
            <Link
              href={childHref('/portal/parent/feedback')}
              className="shrink-0 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#e87c18]"
            >
              Give Feedback
            </Link>
          </div>
        </div>
      )}

      {/* Hero: student info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-linear-to-br from-[#0B1F3A] to-[#1a3460] p-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Student</p>
        <h1 className="mt-1 text-2xl font-bold">{selected.student_name}</h1>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: 'Group',      value: dashboard?.group_name      ?? '—' },
            { label: 'Course',     value: dashboard?.course_title    ?? '—' },
            { label: 'Instructor', value: dashboard?.instructor_name ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
              <p className="mt-0.5 text-sm font-medium text-white/90 leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Attendance',   value: dashboard?.attendance_pct   ?? null, suffix: '%',  href: childHref('/portal/parent/attendance'),   color: 'text-[#10B981]'  },
          { label: 'Assignments',  value: dashboard?.assignment_pct   ?? null, suffix: '%',  href: childHref('/portal/parent/assignments'),  color: 'text-[#2563EB]'   },
          { label: 'Projects',     value: dashboard?.portfolio_count  ?? 0,    suffix: '',   href: childHref('/portal/parent/portfolio'),    color: 'text-purple-600' },
          { label: 'Certificates', value: dashboard?.certificate_count ?? 0,   suffix: '',   href: childHref('/portal/parent/certificates'), color: 'text-[#FF8A1F]'  },
        ].map(({ label, value, suffix, href, color }) => (
          <Link key={label} href={href} className="ds-card p-4 transition hover:border-[#CBD5E1]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
            {value == null ? (
              <p className="mt-1 text-sm text-[#94A3B8]">—</p>
            ) : (
              <p className={`mt-1 text-2xl font-bold ${color}`}>
                {typeof value === 'number' && suffix === '%' ? `${Math.round(value)}${suffix}` : `${value}${suffix}`}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* ── Enrollment Contracts (contract-centric view) ──────────────── */}
      {contracts.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Enrollment Contracts</p>
          <div className="space-y-3">
            {contracts.filter(c => c.status === 'ACTIVE').map(c => (
              <div key={c.enrollment_id} className="ds-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{c.course_name ?? 'Course'}</p>
                    <p className="text-xs text-[#94A3B8]">{[c.group_name, c.instructor_name].filter(Boolean).join(' · ')}</p>
                    {c.contract_code && <p className="font-mono text-[10px] text-[#94A3B8]">{c.contract_code}</p>}
                  </div>
                  <span className="rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[10px] font-semibold text-[#15803D] shrink-0">Active</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className={`font-bold text-sm ${c.enrolled_sessions > 0 && c.remaining_sessions <= 2 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                      {c.enrolled_sessions > 0 ? `${c.remaining_sessions}` : '∞'}
                    </p>
                    <p className="text-[#94A3B8]">Sessions Left</p>
                    {c.enrolled_sessions > 0 && <p className="text-[10px] text-[#CBD5E1]">{c.consumed_sessions}/{c.enrolled_sessions} used</p>}
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className={`font-bold text-sm ${c.remaining_amount > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                      {c.remaining_amount > 0 ? `EGP ${fmtMoney(c.remaining_amount)}` : 'Paid ✓'}
                    </p>
                    <p className="text-[#94A3B8]">Balance</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className="font-bold text-sm text-[#0B1F3A]">EGP {fmtMoney(c.net_amount)}</p>
                    <p className="text-[#94A3B8]">Total</p>
                  </div>
                </div>

                {c.remaining_amount > 0 && c.next_due_date && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-[#94A3B8]">Next due</span>
                    <span className={`font-medium ${new Date(c.next_due_date) < new Date() ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                      {fmtDate(c.next_due_date)}
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Completed contracts summary */}
            {contracts.filter(c => c.status !== 'ACTIVE').length > 0 && (
              <details className="rounded-xl border border-[#E2E8F0]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] rounded-xl">
                  Past Contracts ({contracts.filter(c => c.status !== 'ACTIVE').length})
                </summary>
                <div className="divide-y divide-[#F1F5F9]">
                  {contracts.filter(c => c.status !== 'ACTIVE').map(c => (
                    <div key={c.enrollment_id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#0B1F3A]">{c.course_name ?? '—'}</p>
                        <p className="text-[11px] text-[#94A3B8]">{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                        ${c.status === 'COMPLETED' ? 'bg-[#F1F5F9] text-[#475569]' : 'bg-[#FFFBEB] text-[#B45309]'}`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ── Sprint 51: Recommended Actions ─────────────────────────────── */}
      {(() => {
        const alerts: { icon: string; text: string; cls: string }[] = []
        const activeContract = contracts.find(c => c.status === 'ACTIVE')
        if (activeContract) {
          if (activeContract.enrolled_sessions > 0 && activeContract.remaining_sessions <= 2) {
            alerts.push({ icon: '🔄', text: `Sessions running low — ${activeContract.remaining_sessions} sessions remaining. Please renew soon.`, cls: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]' })
          }
          if (activeContract.remaining_amount > 0 && activeContract.next_due_date && new Date(activeContract.next_due_date) < new Date()) {
            alerts.push({ icon: '💰', text: `Payment overdue — EGP ${fmtMoney(activeContract.remaining_amount)} due since ${fmtDate(activeContract.next_due_date)}.`, cls: 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]' })
          }
          if (activeContract.remaining_amount > 0 && activeContract.next_due_date && new Date(activeContract.next_due_date) >= new Date()) {
            const daysUntil = Math.ceil((new Date(activeContract.next_due_date).getTime() - Date.now()) / 86400000)
            if (daysUntil <= 7) {
              alerts.push({ icon: '📅', text: `Payment due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} — EGP ${fmtMoney(activeContract.remaining_amount)}.`, cls: 'border-blue-200 bg-[#EFF6FF] text-blue-800' })
            }
          }
        }
        if ((dashboard?.attendance_pct ?? 100) < 60 && (dashboard?.attendance_pct ?? 100) > 0) {
          alerts.push({ icon: '⚠️', text: `Attendance is below 60%. Regular attendance is essential for progress.`, cls: 'border-orange-200 bg-orange-50 text-orange-800' })
        }
        if (!alerts.length) return null
        return (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${a.cls}`}>
                <span className="text-lg">{a.icon}</span>
                <p className="text-sm font-medium leading-tight">{a.text}</p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Course progress */}
      <div className="ds-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Course Progress</p>
          <span className="text-sm font-bold text-[#0B1F3A]">{courseProgress}%</span>
        </div>
        <ProgressBar
          value={courseProgress}
          color={courseProgress >= 75 ? 'bg-[#10B981]' : courseProgress >= 50 ? 'bg-yellow-500' : 'bg-[#FF8A1F]'}
        />
        <p className="mt-2 text-[12px] text-[#94A3B8]">
          {completedS} consumed · {Math.max(0, totalS - completedS)} remaining · {totalS} enrolled sessions
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">

        {/* Upcoming class */}
        <div className="ds-card p-5">
          <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Upcoming Class</p>
          {!dashboard?.upcoming_class || (!dashboard.upcoming_class.day_of_week && !dashboard.upcoming_class.next_session_at) ? (
            <p className="text-sm text-[#94A3B8]">No upcoming sessions scheduled.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.upcoming_class.next_session_at && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#FF8A1F]/10">
                    <span className="text-[10px] font-semibold uppercase text-[#FF8A1F]">
                      {new Date(dashboard.upcoming_class.next_session_at).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold leading-none text-[#FF8A1F]">
                      {new Date(dashboard.upcoming_class.next_session_at).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0B1F3A]">
                      {new Date(dashboard.upcoming_class.next_session_at).toLocaleDateString('en-GB', { weekday: 'long' })}
                    </p>
                    <p className="text-[12px] text-[#64748B]">
                      {new Date(dashboard.upcoming_class.next_session_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {dashboard.upcoming_class.instructor_name && ` · ${dashboard.upcoming_class.instructor_name}`}
                    </p>
                  </div>
                </div>
              )}
              {!dashboard.upcoming_class.next_session_at && (
                <div className="grid grid-cols-2 gap-3">
                  {dashboard.upcoming_class.day_of_week && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Day</p>
                      <p className="mt-0.5 text-sm font-medium text-[#0B1F3A] capitalize">
                        {DAY_LABELS[dashboard.upcoming_class.day_of_week.toLowerCase()] ?? dashboard.upcoming_class.day_of_week}
                      </p>
                    </div>
                  )}
                  {dashboard.upcoming_class.time && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Time</p>
                      <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{dashboard.upcoming_class.time}</p>
                    </div>
                  )}
                  {dashboard.upcoming_class.instructor_name && (
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Instructor</p>
                      <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{dashboard.upcoming_class.instructor_name}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="ds-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">Recent Activity</p>
            <Link href={childHref('/portal/parent/semesters')} className="text-[12px] text-[#FF8A1F] hover:underline">
              Full history →
            </Link>
          </div>

          {!dashboard?.recent_activity.length ? (
            <p className="text-sm text-[#94A3B8]">No activity yet.</p>
          ) : (
            <div className="space-y-2.5">
              {dashboard.recent_activity.slice(0, 6).map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <ActivityIcon type={ev.event_type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#0B1F3A]">{ev.title}</p>
                    {ev.subtitle && (
                      <p className="truncate text-[11px] text-[#64748B]">{ev.subtitle}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-[11px] text-[#94A3B8]">
                    {new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
