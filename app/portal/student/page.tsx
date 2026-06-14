import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentDashboardData } from '@/modules/student-portal/queries'
import { getPendingFeedbackSessions } from '@/modules/feedback/queries'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import type { UpcomingHomework, RecentFeedbackItem, StudentDashboardData } from '@/modules/student-portal/types'
import SessionFeedbackWidget from './SessionFeedbackWidget'

// ── Primitives ────────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-[#FF8A1F]' }: { value: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour   = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`
  } catch {
    return t
  }
}

// ── Next Actions ─────────────────────────────────────────────────────────────

function deriveNextActions(data: StudentDashboardData): Array<{ label: string; href: string; kind: string }> {
  const actions: Array<{ label: string; href: string; kind: string }> = []

  if (!data.group_id) {
    actions.push({ label: 'Contact admin to enroll in a group', href: '#', kind: 'info' })
    return actions
  }

  for (const hw of data.upcoming_homework.slice(0, 2)) {
    actions.push({ label: `Submit: ${hw.title}`, href: `/portal/student/assignments/${hw.id}`, kind: 'homework' })
  }

  if (data.att_total === 0 && data.consumed_sessions > 0) {
    actions.push({ label: 'Attend your next session', href: '/portal/student/attendance', kind: 'session' })
  }

  if (data.portfolio_projects === 0) {
    actions.push({ label: 'Upload your first portfolio project', href: '/portal/student/portfolio', kind: 'portfolio' })
  }

  if (data.enrolled_sessions > 0 && data.consumed_sessions >= data.enrolled_sessions) {
    actions.push({ label: 'Download your certificate', href: '/portal/student/certificates', kind: 'certificate' })
  }

  return actions.slice(0, 4)
}

// ── Upcoming homework card ────────────────────────────────────────────────────

function UpcomingCard({ items }: { items: UpcomingHomework[] }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1F3A]">Upcoming Homework</p>
        <Link href="/portal/student/assignments" className="text-xs text-[#FF8A1F] hover:underline">View all →</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No pending homework.</p>
      ) : (
        <div className="space-y-2">
          {items.map((hw) => (
            <Link
              key={hw.id}
              href={`/portal/student/assignments/${hw.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 transition hover:border-[#FF8A1F]/40"
            >
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A]">{hw.title}</p>
              {hw.due_at ? (
                <p className={`shrink-0 text-xs ${new Date(hw.due_at) < new Date() ? 'font-semibold text-red-500' : 'text-[#94A3B8]'}`}>
                  Due {new Date(hw.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-[#94A3B8]">No due date</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Recent feedback card ──────────────────────────────────────────────────────

function FeedbackCard({ items }: { items: RecentFeedbackItem[] }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="mb-2.5 text-sm font-semibold text-[#0B1F3A]">Recent Feedback</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No feedback yet.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.submission_id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[#0B1F3A]">{item.assignment_title}</p>
                {item.score != null && item.max_score != null && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {item.score}/{item.max_score}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">{item.public_feedback}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                {new Date(item.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const [data, feedbackSessions] = await Promise.all([
    getStudentDashboardData(user.id),
    studentId ? getPendingFeedbackSessions(studentId) : Promise.resolve([]),
  ])

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">Account not fully set up yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const sessionPct  = data.enrolled_sessions > 0
    ? Math.round((data.consumed_sessions / data.enrolled_sessions) * 100)
    : 0
  const remaining   = data.remaining_sessions
  const notEnrolled = !data.group_id
  const nextActions = deriveNextActions(data)

  const nextClassLabel = data.day_of_week
    ? `${DAY_LABELS[data.day_of_week.toLowerCase()] ?? data.day_of_week}${data.group_time ? ` ${formatTime(data.group_time)}` : ''}`
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-3">

      {/* ── Hero + Session Progress (merged) ─────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5">
        {/* Name row */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-bold text-[#0B1F3A] leading-tight">{data.student_name}</h1>
          {!notEnrolled && (
            <span className="shrink-0 rounded-full bg-[#FF8A1F]/10 px-2.5 py-1 text-sm font-bold text-[#FF8A1F]">
              {sessionPct}%
            </span>
          )}
        </div>

        {notEnrolled ? (
          <p className="mt-1 text-xs text-[#94A3B8]">Not enrolled in any active group yet.</p>
        ) : (
          <>
            {/* Identity row */}
            <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">
              {[data.group_name, data.course_title, data.instructor_name].filter(Boolean).join(' · ')}
            </p>

            {/* Progress row */}
            <div className="mt-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-[#0B1F3A]">{data.consumed_sessions}</span>
                <span className="text-sm text-[#64748B]">/ {data.enrolled_sessions} sessions</span>
                {remaining > 0 && (
                  <span className="text-xs text-[#94A3B8]">{remaining} remaining</span>
                )}
                {data.enrolled_sessions === 0 && (
                  <span className="text-xs text-[#94A3B8]">No active package</span>
                )}
              </div>
              <div className="mt-2">
                <ProgressBar value={sessionPct} />
              </div>
              {nextClassLabel && (
                <p className="mt-1.5 text-xs text-[#64748B]">
                  Next class: <span className="font-semibold text-[#0B1F3A]">{nextClassLabel}</span>
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {notEnrolled ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] px-6 py-10 text-center">
          <p className="text-sm text-[#94A3B8]">Your dashboard will appear once you are enrolled in a group.</p>
          <Link href="/portal/student/assignments" className="mt-3 inline-block text-sm text-[#FF8A1F] hover:underline">
            View assignments →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Stat cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {/* Attendance */}
            <Link
              href="/portal/student/attendance"
              className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 transition hover:border-[#CBD5E1] hover:shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Attendance</p>
              <p className={`mt-1 text-2xl font-bold leading-none ${data.att_pct >= 75 ? 'text-green-600' : data.att_pct >= 50 ? 'text-yellow-600' : 'text-[#0B1F3A]'}`}>
                {data.att_pct}%
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {data.att_total > 0
                  ? `${data.att_present}P · ${data.att_absent}A · ${data.att_late}L`
                  : 'No records yet'}
              </p>
            </Link>

            {/* Assignments */}
            <Link
              href="/portal/student/assignments"
              className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 transition hover:border-[#CBD5E1] hover:shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Assignments</p>
              <p className="mt-1 text-2xl font-bold leading-none text-[#0B1F3A]">
                {data.assignments_total === 0 ? '0' : `${data.assignments_submitted}/${data.assignments_total}`}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {data.assignments_total === 0
                  ? 'None assigned yet'
                  : data.assignments_graded > 0
                    ? `${data.assignments_graded} graded`
                    : `${data.assignments_submitted} submitted`}
              </p>
            </Link>

            {/* Portfolio */}
            <Link
              href="/portal/student/portfolio"
              className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 transition hover:border-[#CBD5E1] hover:shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Portfolio</p>
              <p className="mt-1 text-2xl font-bold leading-none text-[#0B1F3A]">{data.portfolio_projects}</p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {data.portfolio_projects === 0 ? 'No projects yet' : `${data.portfolio_reviewed} reviewed`}
              </p>
            </Link>

            {/* Overall */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Overall</p>
              {data.overall_pct != null ? (
                <>
                  <p className={`mt-1 text-2xl font-bold leading-none ${data.overall_pct >= 75 ? 'text-green-600' : 'text-[#0B1F3A]'}`}>
                    {Math.round(data.overall_pct)}%
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B]">composite score</p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold leading-none text-[#94A3B8]">—</p>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">No grades yet</p>
                </>
              )}
            </div>
          </div>

          {/* ── Next Actions ──────────────────────────────────────────────── */}
          {nextActions.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Next Actions</h2>
              <div className="space-y-1.5">
                {nextActions.map((action, i) => {
                  const colors: Record<string, string> = {
                    homework:    'bg-amber-100 text-amber-700',
                    session:     'bg-emerald-100 text-emerald-700',
                    portfolio:   'bg-purple-100 text-purple-700',
                    certificate: 'bg-[#FFF7ED] text-[#FF8A1F]',
                    info:        'bg-[#F1F5F9] text-[#64748B]',
                  }
                  const icons: Record<string, string> = {
                    homework: '📝', session: '▶', portfolio: '🖼', certificate: '🏆', info: 'ℹ',
                  }
                  return (
                    <Link
                      key={i}
                      href={action.href}
                      className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 transition hover:border-[#FF8A1F]/50 hover:shadow-sm"
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${colors[action.kind] ?? colors.info}`}>
                        {icons[action.kind] ?? '→'}
                      </div>
                      <p className="flex-1 text-sm font-medium text-[#0B1F3A]">{action.label}</p>
                      <span className="shrink-0 text-xs text-[#FF8A1F]">→</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Session feedback ─────────────────────────────────────────── */}
          {feedbackSessions.length > 0 && (
            <SessionFeedbackWidget sessions={feedbackSessions} />
          )}

          {/* ── Two-column content ────────────────────────────────────────── */}
          <div className="grid gap-3 lg:grid-cols-2">
            <UpcomingCard items={data.upcoming_homework} />
            <FeedbackCard items={data.recent_feedback} />
          </div>
        </>
      )}
    </div>
  )
}
