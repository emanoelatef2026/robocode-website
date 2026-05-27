import { requirePortalRole } from '@/modules/rbac/guards'
import { listStudentAssignments } from '@/modules/assignments/submissions/queries'
import Link from 'next/link'

function statusBadge(status: string | null) {
  if (!status) return null
  const map: Record<string, { label: string; cls: string }> = {
    submitted:               { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700'   },
    under_review:            { label: 'Under Review', cls: 'bg-purple-100 text-purple-700' },
    graded:                  { label: 'Graded',       cls: 'bg-green-100 text-green-700'  },
    returned:                { label: 'Returned',     cls: 'bg-yellow-100 text-yellow-700' },
    resubmission_requested:  { label: 'Resubmit',     cls: 'bg-orange-100 text-orange-700' },
    resubmitted:             { label: 'Resubmitted',  cls: 'bg-teal-100 text-teal-700'   },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

function dueBadge(dueAt: string | null, hasSubmission: boolean) {
  if (!dueAt) return null
  const due = new Date(dueAt)
  const now = new Date()
  const overdue = !hasSubmission && due < now
  return (
    <span className={`text-xs ${overdue ? 'font-semibold text-red-500' : 'text-[#94A3B8]'}`}>
      {overdue ? 'Overdue · ' : ''}Due {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
    </span>
  )
}

export default async function StudentAssignmentsPage() {
  const user        = await requirePortalRole('student')
  const assignments = await listStudentAssignments(user.id)

  const pending   = assignments.filter(a => !a.submission_id)
  const submitted = assignments.filter(a => a.submission_id)

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-[#0B132B]">My Assignments</h1>

      {assignments.length === 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-[#64748B]">No assignments yet. Check back after your instructor publishes work.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#64748B]">
            To Do ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(a => (
              <Link
                key={a.id}
                href={`/portal/student/assignments/${a.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#19C6F4] hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0B132B]">{a.title}</p>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {a.course_title && <span>{a.course_title} · </span>}
                    {a.type}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {dueBadge(a.due_at, false)}
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#64748B]">
                    {a.max_score} pts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {submitted.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#64748B]">
            Submitted ({submitted.length})
          </h2>
          <div className="space-y-3">
            {submitted.map(a => (
              <Link
                key={a.id}
                href={`/portal/student/assignments/${a.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#19C6F4] hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0B132B]">{a.title}</p>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {a.course_title && <span>{a.course_title} · </span>}
                    {a.type}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {statusBadge(a.submission_status)}
                  {a.submission_score != null && (
                    <span className="text-xs font-semibold text-[#0B132B]">
                      {a.submission_score}/{a.max_score}
                    </span>
                  )}
                  {a.is_late && (
                    <span className="text-xs text-orange-500">Late</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
