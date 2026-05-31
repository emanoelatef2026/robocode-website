import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getParentChildren,
  getChildSemesterHistory,
} from '@/modules/parents/parent-portal-queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct   = Math.min(Math.max(value, 0), 100)
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-semibold text-[#0B1F3A]">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-blue-100  text-blue-700'  },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100   text-red-700'   },
}

export default async function ParentSemestersPage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]
  const childParam = `?child=${selected.student_id}`

  const history = await getChildSemesterHistory(user.id, selected.student_id)

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Progress History</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {selected.student_name} · {history.length} record{history.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href={`/portal/parent${childParam}`} className="text-[13px] text-[#FF8A1F] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No history yet.</p>
          <p className="mt-1 text-xs text-[#94A3B8]">History will appear once progress is recorded.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map(course => {
            const statusCfg = STATUS_MAP[course.status] ?? { label: course.status, cls: 'bg-gray-100 text-gray-600' }

            return (
              <div key={course.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{course.course_title}</p>
                    <p className="text-[12px] text-[#94A3B8]">
                      {course.group_name || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-lg font-bold text-[#0B1F3A]">
                      {course.completion_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <ScoreBar label="Attendance (40%)"  value={course.attendance_score} />
                  <ScoreBar label="Assignments (40%)" value={course.assignment_score} />
                  <ScoreBar label="Portfolio (20%)"   value={course.portfolio_score}  />
                </div>

                <p className="mt-3 text-right text-[11px] text-[#94A3B8]">
                  Updated {new Date(course.last_calculated_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
