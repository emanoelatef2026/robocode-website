import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren } from '@/modules/parents/parent-portal-queries'
import { getProgressForChild } from '@/modules/progress/queries'
import Link from 'next/link'
import ChildSelector from '@/components/portal/parent/ChildSelector'
import NoChildrenLinked from '@/components/portal/parent/NoChildrenLinked'

interface Props {
  searchParams: Promise<{ child?: string }>
}

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
        <span className="font-semibold text-[#0B1F3A]">{pct.toFixed(1)}%</span>
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

export default async function ParentProgressPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return <NoChildrenLinked />
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const summary = await getProgressForChild(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Academic Progress</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{selected.student_name}</p>
        </div>
        <Link
          href={`/portal/parent?child=${selected.student_id}`}
          className="text-[13px] text-[#FF8A1F] hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Child switcher */}
      <ChildSelector
        linkedChildren={children}
        selectedId={selected.student_id}
        hrefFor={(id) => `/portal/parent/progress?child=${id}`}
      />

      {!summary || summary.courses.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No progress data yet.</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Progress will appear here once {selected.student_name} is enrolled and classes begin.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {/* Overall */}
          <div className="ds-card flex items-center justify-between p-5">
            <p className="text-sm font-medium text-[#0B1F3A]">Overall Completion</p>
            <p className="text-xl font-bold text-[#0B1F3A]">{summary.overall_percentage.toFixed(1)}%</p>
          </div>

          <div className="space-y-4">
            {summary.courses.map(course => (
              <div key={course.id} className="ds-card p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{course.course_title}</p>
                    <p className="text-xs text-[#64748B]">{course.group_name}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {statusBadge(course.status)}
                    <span className="text-lg font-bold text-[#0B1F3A]">
                      {course.completion_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <ScoreBar label="Attendance (40%)"   value={course.attendance_score} />
                  <ScoreBar label="Assignments (40%)"  value={course.assignment_score} />
                  <ScoreBar label="Portfolio (20%)"    value={course.portfolio_score}  />
                </div>

                <p className="mt-3 text-right text-xs text-[#64748B]">
                  Updated {new Date(course.last_calculated_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
