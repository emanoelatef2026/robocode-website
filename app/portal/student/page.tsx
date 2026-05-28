import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getStudentEnrollment,
  getStudentProgressStats,
  getRecentFeedback,
  getStudentTimeline,
} from '@/modules/student-portal/queries'
import Link from 'next/link'
import type { StudentEnrollment, StudentProgressStats, RecentFeedbackItem, TimelineEvent } from '@/modules/student-portal/types'

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      {message}
    </div>
  )
}

function ProgressBar({ value, color = 'bg-[#FF8A1F]' }: { value: number; color?: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">{label}</p>
      {value == null ? (
        <p className="mt-1 text-sm text-[#94A3B8]">—</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold text-[#0B1F3A]">{Math.round(value)}%</p>
          <ProgressBar
            value={value}
            color={value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
          />
        </>
      )}
    </div>
  )
}

const TIMELINE_ICONS: Record<TimelineEvent['event_type'], React.ReactNode> = {
  submitted: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-500">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  ),
  graded: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-green-500">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-purple-500">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  certificate: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#FF8A1F]">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
}

export default async function StudentDashboardPage() {
  const user = await requirePortalRole('student')

  let enrollment: StudentEnrollment | null = null
  let enrollmentError = false
  try { enrollment = await getStudentEnrollment(user.id) } catch { enrollmentError = true }

  let progress: StudentProgressStats | null = null
  let progressError = false
  try { progress = await getStudentProgressStats(user.id) } catch { progressError = true }

  let feedback: RecentFeedbackItem[] = []
  let feedbackError = false
  try { feedback = await getRecentFeedback(user.id) } catch { feedbackError = true }

  let timeline: TimelineEvent[] = []
  let timelineError = false
  try { timeline = await getStudentTimeline(user.id) } catch { timelineError = true }

  const hasEnrollment = enrollment && (enrollment.group_name || enrollment.course_title)

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">My Dashboard</h1>
        {hasEnrollment && (
          <p className="mt-0.5 text-sm text-[#64748B]">
            {[enrollment!.course_title, enrollment!.semester_name].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Enrollment card */}
      {enrollmentError ? (
        <WarningBanner message="Could not load enrollment info. Please try again later." />
      ) : !enrollment || !hasEnrollment ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-sm text-[#94A3B8]">You are not enrolled in any active group yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Group',      value: enrollment.group_name },
              { label: 'Course',     value: enrollment.course_title },
              { label: 'Semester',   value: enrollment.semester_name },
              { label: 'Instructor', value: enrollment.instructor_name },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress stats */}
      {progressError ? (
        <WarningBanner message="Could not load progress stats. Please try again later." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Attendance"   value={progress?.attendance_pct ?? null} color="#FF8A1F" />
          <StatCard label="Assignments"  value={progress?.assignment_pct ?? null} color="#FF8A1F" />
          <StatCard label="Portfolio"    value={progress?.portfolio_pct  ?? null} color="#FF8A1F" />
          <StatCard label="Overall"      value={progress?.progress_pct   ?? null} color="#FF8A1F" />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Assignments',  href: '/portal/student/assignments',  color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
          { label: 'Portfolio',    href: '/portal/student/portfolio',    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          { label: 'Certificates', href: '/portal/student/certificates', color: 'text-[#FF8A1F]',  bg: 'bg-[#FFF7ED]', border: 'border-orange-100' },
          { label: 'History',      href: '/portal/student/semesters',    color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-100' },
        ].map(({ label, href, color, bg, border }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center rounded-xl border ${border} ${bg} px-3 py-4 text-sm font-semibold ${color} transition hover:opacity-80`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Feedback */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
          <p className="text-sm font-semibold text-[#0B1F3A]">Recent Feedback</p>

          {feedbackError ? (
            <WarningBanner message="Could not load feedback." />
          ) : feedback.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No feedback yet. Submit assignments to receive grades.</p>
          ) : (
            <div className="space-y-3">
              {feedback.map((item) => (
                <div key={item.submission_id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#0B1F3A]">{item.assignment_title}</p>
                    {item.score != null && item.max_score != null && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        {item.score}/{item.max_score}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[#64748B] whitespace-pre-wrap">{item.public_feedback}</p>
                  <p className="mt-1.5 text-[10px] text-[#94A3B8]">
                    {new Date(item.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4">
          <p className="text-sm font-semibold text-[#0B1F3A]">Activity</p>

          {timelineError ? (
            <WarningBanner message="Could not load activity." />
          ) : timeline.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9]">
                    {TIMELINE_ICONS[event.event_type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#0B1F3A]">{event.title}</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {event.subtitle} · {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
