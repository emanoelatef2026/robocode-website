import { requirePortalRole }                    from '@/modules/rbac/guards'
import { getParentChildren, getChildDashboardData } from '@/modules/parents/parent-portal-queries'
import { getChildSessionsProgress }             from '@/modules/parents/parent-portal-queries'
import { getPendingFeedbackMilestone }           from '@/modules/parent-feedback/queries'
import Link                                      from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

// ── Icon helpers ───────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full'
  if (type === 'attendance_marked')
    return <span className={`${base} bg-green-100 text-green-600`}>✓</span>
  if (type === 'homework_submitted')
    return <span className={`${base} bg-blue-100 text-blue-600`}>📄</span>
  if (type === 'homework_graded')
    return <span className={`${base} bg-indigo-100 text-indigo-600`}>✦</span>
  if (type === 'portfolio_uploaded')
    return <span className={`${base} bg-purple-100 text-purple-600`}>🖼</span>
  if (type === 'portfolio_approved')
    return <span className={`${base} bg-emerald-100 text-emerald-600`}>★</span>
  if (type === 'certificate_earned')
    return <span className={`${base} bg-[#FF8A1F]/15 text-[#FF8A1F]`}>🏆</span>
  return <span className={`${base} bg-gray-100 text-gray-500`}>•</span>
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

  const [dashboard, sessions] = await Promise.all([
    getChildDashboardData(user.id, selected.student_id),
    getChildSessionsProgress(user.id, selected.student_id),
  ])

  const pendingMilestone = dashboard
    ? await getPendingFeedbackMilestone(user.id, selected.student_id, sessions?.completed_sessions ?? 0)
    : null

  const childHref  = (path: string) => `${path}?child=${selected.student_id}`
  const completedS = sessions?.completed_sessions ?? 0
  const totalS     = sessions?.total_sessions     ?? 24
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
          { label: 'Attendance',   value: dashboard?.attendance_pct   ?? null, suffix: '%',  href: childHref('/portal/parent/attendance'),   color: 'text-green-600'  },
          { label: 'Assignments',  value: dashboard?.assignment_pct   ?? null, suffix: '%',  href: childHref('/portal/parent/assignments'),  color: 'text-blue-600'   },
          { label: 'Projects',     value: dashboard?.portfolio_count  ?? 0,    suffix: '',   href: childHref('/portal/parent/portfolio'),    color: 'text-purple-600' },
          { label: 'Certificates', value: dashboard?.certificate_count ?? 0,   suffix: '',   href: childHref('/portal/parent/certificates'), color: 'text-[#FF8A1F]'  },
        ].map(({ label, value, suffix, href, color }) => (
          <Link key={label} href={href} className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1]">
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

      {/* Course progress */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Course Progress</p>
          <span className="text-sm font-bold text-[#0B1F3A]">{courseProgress}%</span>
        </div>
        <ProgressBar
          value={courseProgress}
          color={courseProgress >= 75 ? 'bg-green-500' : courseProgress >= 50 ? 'bg-yellow-500' : 'bg-[#FF8A1F]'}
        />
        <p className="mt-2 text-[12px] text-[#94A3B8]">
          {completedS} completed · {Math.max(0, totalS - completedS)} remaining · {totalS} total sessions
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">

        {/* Upcoming class */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
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
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
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
