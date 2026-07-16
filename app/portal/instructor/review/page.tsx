import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInboxSubmissions,
  getStudentsMissingEvaluation,
} from '@/modules/instructor-portal/queries'
import { listProjectsForInstructorReview } from '@/modules/portfolio/queries'
import { PROJECT_STATUS_CONFIG } from '@/modules/portfolio/types'
import Link from 'next/link'
import EmptyState from '@/components/admin/EmptyState'
import StatusBadge from '@/components/admin/StatusBadge'

export default async function ReviewCenterPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <EmptyState
        title="No instructor record found"
        description="Contact your team leader to link your account."
      />
    )
  }

  const [homework, projects, missingEvaluations] = await Promise.all([
    listInboxSubmissions(instructor.id, 'pending', undefined, 8),
    listProjectsForInstructorReview(instructor.id, 'pending_review'),
    getStudentsMissingEvaluation(instructor.id, 8),
  ])

  const totalPending = homework.length + projects.length + missingEvaluations.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Review Center</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          Everything waiting on you, in one place — {totalPending} item{totalPending !== 1 ? 's' : ''}
        </p>
      </div>

      {totalPending === 0 ? (
        <EmptyState
          title="All caught up"
          description="No homework, portfolio projects, or evaluations are waiting on you right now."
        />
      ) : (
        <div className="space-y-6">

          {/* ── Homework ─────────────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0B1F3A]">
                Homework <span className="text-[#94A3B8] font-normal">({homework.length})</span>
              </h2>
              <Link href="/portal/instructor/homework" className="text-xs font-medium text-[#FF8A1F] hover:underline">
                Open Homework Inbox →
              </Link>
            </div>
            {homework.length === 0 ? (
              <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No pending submissions.</div>
            ) : (
              <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
                {homework.map((s) => (
                  <Link
                    key={s.submission_id}
                    href={`/portal/instructor/homework/${s.submission_id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#F8FAFC]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                      <p className="truncate text-xs text-[#64748B]">{s.assignment_title} · {s.group_name ?? '—'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={s.status} />
                      {s.is_late && <StatusBadge status="late" />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Portfolio ────────────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0B1F3A]">
                Portfolio Projects <span className="text-[#94A3B8] font-normal">({projects.length})</span>
              </h2>
              <Link href="/portal/instructor/portfolio" className="text-xs font-medium text-[#FF8A1F] hover:underline">
                Open Portfolio Review →
              </Link>
            </div>
            {projects.length === 0 ? (
              <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No pending projects.</div>
            ) : (
              <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
                {projects.slice(0, 8).map((p) => {
                  const statusCfg = p.status
                    ? (PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.pending_review)
                    : PROJECT_STATUS_CONFIG.pending_review
                  return (
                    <Link
                      key={p.id}
                      href="/portal/instructor/portfolio?tab=pending_review"
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#0B1F3A]">{p.title}</p>
                        <p className="truncate text-xs text-[#64748B]">by {p.student_name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Evaluations ──────────────────────────────────────────────── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0B1F3A]">
                Never Evaluated <span className="text-[#94A3B8] font-normal">({missingEvaluations.length})</span>
              </h2>
            </div>
            {missingEvaluations.length === 0 ? (
              <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">Every student has at least one evaluation on record.</div>
            ) : (
              <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
                {missingEvaluations.map((m) => (
                  <Link
                    key={m.student_id}
                    href={m.href}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#F8FAFC]"
                  >
                    <p className="truncate text-sm font-medium text-[#0B1F3A]">{m.student_name}</p>
                    <span className="shrink-0 text-xs text-[#94A3B8]">{m.group_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  )
}
