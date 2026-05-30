import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentDashboardData } from '@/modules/student-portal/queries'
import Link from 'next/link'
import type { UpcomingHomework, RecentFeedbackItem } from '@/modules/student-portal/types'

// ── Shared primitives ─────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-[#FF8A1F]' }: { value: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatCard({
  label, value, sub, color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? 'text-[#0B1F3A]'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#64748B]">{sub}</p>}
    </div>
  )
}

// ── Upcoming homework card ────────────────────────────────────────────────────

function UpcomingCard({ items }: { items: UpcomingHomework[] }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Upcoming Homework</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No pending homework.</p>
      ) : (
        <div className="space-y-2">
          {items.map((hw) => (
            <Link
              key={hw.id}
              href={`/portal/student/assignments/${hw.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5 transition hover:border-[#FF8A1F]/40"
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
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-[#0B1F3A]">Recent Feedback</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No feedback yet. Submit assignments to receive grades.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.submission_id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[#0B1F3A]">{item.assignment_title}</p>
                {item.score != null && item.max_score != null && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {item.score}/{item.max_score}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[#64748B]">{item.public_feedback}</p>
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
  const data = await getStudentDashboardData(user.id)

  // No student record at all
  if (!data) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">Account not fully set up yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const sessionPct = data.total_sessions > 0
    ? Math.round((data.completed_sessions / data.total_sessions) * 100)
    : 0

  const notEnrolled = !data.group_id

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* ── Identity header ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-5">
        <h1 className="text-xl font-bold text-[#0B1F3A]">{data.student_name}</h1>
        {notEnrolled ? (
          <p className="mt-1 text-sm text-[#94A3B8]">Not enrolled in any active group yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Group</p>
              <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{data.group_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Course</p>
              <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{data.course_title ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Instructor</p>
              <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{data.instructor_name ?? '—'}</p>
            </div>
          </div>
        )}
      </div>

      {notEnrolled ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] px-6 py-12 text-center">
          <p className="text-sm text-[#94A3B8]">Your dashboard will appear once you are enrolled in a group.</p>
          <Link href="/portal/student/assignments" className="mt-4 inline-block text-sm text-[#FF8A1F] hover:underline">
            View assignments →
          </Link>
        </div>
      ) : (
        <>
          {/* ── Session progress — PRIMARY KPI ───────────────────────────── */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0B1F3A]">Session Progress</p>
              <span className="rounded-full bg-[#FF8A1F]/10 px-3 py-0.5 text-sm font-bold text-[#FF8A1F]">
                {sessionPct}%
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-[#0B1F3A]">
              {data.completed_sessions}
              <span className="ml-1 text-base font-normal text-[#64748B]">/ {data.total_sessions} sessions completed</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={sessionPct} />
            </div>
          </div>

          {/* ── Stat cards row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Attendance"
              value={`${data.att_pct}%`}
              sub={data.att_total > 0
                ? `${data.att_present}P · ${data.att_absent}A · ${data.att_late}L`
                : 'No records yet'}
              color={data.att_pct >= 75 ? 'text-green-600' : data.att_pct >= 50 ? 'text-yellow-600' : 'text-[#0B1F3A]'}
            />
            <StatCard
              label="Assignments"
              value={data.assignments_total === 0 ? '0' : `${data.assignments_submitted}/${data.assignments_total}`}
              sub={data.assignments_total === 0
                ? 'None assigned yet'
                : data.assignments_graded > 0
                  ? `${data.assignments_graded} graded · avg ${data.assignments_avg_score ?? 0} pts`
                  : `${data.assignments_graded} graded`}
            />
            <StatCard
              label="Portfolio"
              value={`${data.portfolio_projects}`}
              sub={data.portfolio_projects === 0 ? 'No projects yet' : `project${data.portfolio_projects !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Overall"
              value={data.overall_pct != null ? `${Math.round(data.overall_pct)}%` : 'N/A'}
              sub={data.overall_pct != null ? 'composite score' : 'No grades yet'}
              color={data.overall_pct != null && data.overall_pct >= 75 ? 'text-green-600' : 'text-[#0B1F3A]'}
            />
          </div>

          {/* ── Quick nav ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Assignments',  href: '/portal/student/assignments',  cls: 'text-blue-600   bg-blue-50   border-blue-100'   },
              { label: 'Portfolio',    href: '/portal/student/portfolio',    cls: 'text-purple-600 bg-purple-50 border-purple-100' },
              { label: 'Certificates', href: '/portal/student/certificates', cls: 'text-[#FF8A1F]  bg-[#FFF7ED] border-orange-100' },
              { label: 'History',      href: '/portal/student/history',      cls: 'text-teal-600   bg-teal-50   border-teal-100'   },
            ].map(({ label, href, cls }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-center rounded-xl border px-3 py-4 text-sm font-semibold transition hover:opacity-80 ${cls}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Two-column content area ────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <UpcomingCard items={data.upcoming_homework} />
            <FeedbackCard items={data.recent_feedback} />
          </div>
        </>
      )}
    </div>
  )
}
