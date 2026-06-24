import { requirePortalRole } from '@/modules/rbac/guards'
import { getProgressForParent } from '@/modules/progress/queries'

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  const color =
    pct >= 75 ? 'bg-[#10B981]'
    : pct >= 50 ? 'bg-yellow-400'
    : 'bg-[#EF4444]'

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-semibold text-[#0B132B]">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active:    'bg-[#EFF6FF] text-[#1D4ED8]',
    completed: 'bg-[#E7F8EE] text-[#15803D]',
    failed:    'bg-[#FEE2E2] text-[#DC2626]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? 'bg-[#F3F4F6] text-[#4B5563]'}`}>
      {status}
    </span>
  )
}

export default async function ParentProgressPage() {
  const user      = await requirePortalRole('parent')
  const summaries = await getProgressForParent(user.id)

  if (!summaries.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#0B132B]">No progress data yet</p>
          <p className="mt-1 text-sm text-[#64748B]">
            Progress will appear here once your child is enrolled and classes begin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <h1 className="text-2xl font-bold text-[#0B132B]">Academic Progress</h1>

      {summaries.map(summary => (
        <section key={summary.student_id} className="space-y-4">
          {/* Student header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B132B] text-sm font-bold text-white">
              {summary.student_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[#0B132B]">{summary.student_name}</p>
              <p className="text-xs text-[#94A3B8]">{summary.student_email}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-[#94A3B8]">Overall</p>
              <p className="text-xl font-bold text-[#0B132B]">{summary.overall_percentage.toFixed(1)}%</p>
            </div>
          </div>

          {summary.courses.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No course progress recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {summary.courses.map(course => (
                <div
                  key={course.id}
                  className="ds-card p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#0B132B]">{course.course_title}</p>
                      <p className="text-xs text-[#94A3B8]">{course.group_name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {statusBadge(course.status)}
                      <span className="text-lg font-bold text-[#0B132B]">
                        {course.completion_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <ScoreBar label="Attendance (40%)"   value={course.attendance_score} />
                    <ScoreBar label="Assignments (40%)"  value={course.assignment_score} />
                    <ScoreBar label="Portfolio (20%)"    value={course.portfolio_score}  />
                  </div>

                  <p className="mt-3 text-right text-xs text-[#94A3B8]">
                    Updated {new Date(course.last_calculated_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
