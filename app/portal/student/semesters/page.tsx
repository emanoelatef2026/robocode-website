import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentProgressByUserId, getStudentSessionCounts } from '@/modules/progress/queries'
import { createServiceClient } from '@/lib/supabase/service'

function ScorePill({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? 'text-green-700 bg-green-100' : value >= 50 ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'
  return (
    <div className="text-center">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
        {Math.round(value)}%
      </span>
      <p className="mt-0.5 text-[10px] text-[#94A3B8]">{label}</p>
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
}

export default async function StudentSemestersPage() {
  const user    = await requirePortalRole('student')

  // Resolve student record for session counts
  const db = createServiceClient()
  const { data: studentRow } = await db.from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id as string | undefined

  const [history, sessionCounts] = await Promise.all([
    getStudentProgressByUserId(user.id),
    studentId ? getStudentSessionCounts(studentId) : Promise.resolve({} as Record<string, { completed: number; total: number }>),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Semester History</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Your progress across all enrolled courses.</p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-sm text-[#94A3B8]">No history yet. Progress will appear here once you complete sessions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((row) => {
            const status = STATUS_LABELS[row.status] ?? { label: row.status, cls: 'bg-gray-100 text-gray-600' }
            return (
              <div key={row.id} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">{row.course_title || '—'}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {[row.semester_name, row.group_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>
                    {status.label}
                  </span>
                </div>

                {/* Session progress */}
                {(() => {
                  const sc = sessionCounts[row.group_id]
                  if (!sc || sc.total === 0) return null
                  const pct = Math.round((sc.completed / sc.total) * 100)
                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-[#64748B]">
                        <span className="font-medium">Session {sc.completed} / {sc.total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full bg-[#FF8A1F]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {/* Score breakdown */}
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <ScorePill value={row.attendance_score}      label="Attendance" />
                  <ScorePill value={row.assignment_score}      label="Assignments" />
                  <ScorePill value={row.portfolio_score}       label="Portfolio" />
                  <ScorePill value={row.completion_percentage} label="Overall" />
                </div>

                {/* Overall progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>Overall progress</span>
                    <span>{Math.round(row.completion_percentage)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.completion_percentage >= 75 ? 'bg-green-500' :
                        row.completion_percentage >= 50 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, row.completion_percentage)}%` }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-[#94A3B8]">
                  Last updated {new Date(row.last_calculated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
