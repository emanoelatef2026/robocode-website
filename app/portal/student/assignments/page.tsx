import { requirePortalRole } from '@/modules/rbac/guards'
import { listStudentAssignments } from '@/modules/assignments/submissions/queries'
import Link from 'next/link'

function statusBadge(status: string | null) {
  if (!status) return null
  const map: Record<string, { label: string; cls: string }> = {
    submitted:               { label: 'Submitted',    cls: 'bg-[#EFF6FF] text-[#1D4ED8]'   },
    under_review:            { label: 'Under Review', cls: 'bg-purple-100 text-purple-700' },
    graded:                  { label: 'Graded',       cls: 'bg-[#E7F8EE] text-[#15803D]'  },
    returned:                { label: 'Returned',     cls: 'bg-yellow-100 text-yellow-700' },
    resubmission_requested:  { label: 'Resubmit',     cls: 'bg-orange-100 text-orange-700' },
    resubmitted:             { label: 'Resubmitted',  cls: 'bg-teal-100 text-teal-700'   },
  }
  const s = map[status] ?? { label: status, cls: 'bg-[#F3F4F6] text-[#4B5563]' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
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
    <span className={`text-[11px] ${overdue ? 'font-semibold text-[#EF4444]' : 'text-[#64748B]'}`}>
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
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-base font-bold text-[#0B1F3A]">My Assignments</h1>

      {assignments.length === 0 && (
        <div className="ds-card p-6 text-center">
          <p className="text-sm text-[#64748B]">No assignments yet. Check back after your instructor publishes work.</p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            To Do ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(a => (
              <Link
                key={a.id}
                href={`/portal/student/assignments/${a.id}`}
                className="flex items-center justify-between gap-3 ds-card px-4 py-3 transition hover:border-[#FF8A1F] hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{a.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {a.course_title && <span>{a.course_title} · </span>}
                    {a.type}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {dueBadge(a.due_at, false)}
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">
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
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
            Submitted ({submitted.length})
          </h2>
          <div className="space-y-2">
            {submitted.map(a => (
              <Link
                key={a.id}
                href={`/portal/student/assignments/${a.id}`}
                className="flex items-center justify-between gap-3 ds-card px-4 py-3 transition hover:border-[#FF8A1F] hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{a.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {a.course_title && <span>{a.course_title} · </span>}
                    {a.type}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {statusBadge(a.submission_status)}
                  {a.submission_score != null && (
                    <span className="text-xs font-semibold text-[#0B1F3A]">
                      {a.submission_score}/{a.max_score}
                    </span>
                  )}
                  {a.is_late && (
                    <span className="text-[11px] text-orange-500">Late</span>
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
