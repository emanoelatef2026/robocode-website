import { notFound } from 'next/navigation'
import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentAssignmentWithSubmission } from '@/modules/assignments/submissions/queries'
import SubmitForm from './SubmitForm'
import Link from 'next/link'

interface Props {
  params: Promise<{ assignmentId: string }>
}

export default async function StudentAssignmentDetailPage({ params }: Props) {
  const { assignmentId } = await params
  const user   = await requirePortalRole('student')
  const detail = await getStudentAssignmentWithSubmission(user.id, assignmentId)

  if (!detail) notFound()

  const { submission } = detail
  const dueDate = detail.due_at ? new Date(detail.due_at) : null
  const isOverdue = dueDate && new Date() > dueDate && !submission

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Back link */}
      <Link href="/portal/student/assignments" className="text-xs text-[#FF8A1F] hover:underline">← Assignments</Link>

      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-[#94A3B8]">
          {detail.course_title && <span>{detail.course_title}</span>}
          {detail.course_title && detail.module_title && <span>·</span>}
          {detail.module_title && <span>{detail.module_title}</span>}
        </div>
        <h1 className="text-lg font-bold text-[#0B132B]">{detail.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B] capitalize">
            {detail.type}
          </span>
          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B]">
            {detail.max_score} points
          </span>
          {dueDate && (
            <span className={`text-xs ${isOverdue ? 'font-semibold text-[#EF4444]' : 'text-[#94A3B8]'}`}>
              {isOverdue ? 'Overdue · ' : 'Due '}
              {dueDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {detail.description && (
        <section className="ds-card p-4">
          <h2 className="mb-1.5 text-sm font-semibold text-[#0B132B]">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-[#64748B]">{detail.description}</p>
        </section>
      )}

      {/* Instructions */}
      {detail.instructions && (
        <section className="ds-card p-4">
          <h2 className="mb-1.5 text-sm font-semibold text-[#0B132B]">Instructions</h2>
          <p className="whitespace-pre-wrap text-sm text-[#64748B]">{detail.instructions}</p>
        </section>
      )}

      {/* Rubric */}
      {detail.rubric?.length > 0 && (
        <section className="ds-card p-4">
          <h2 className="mb-2.5 text-sm font-semibold text-[#0B132B]">Grading Criteria</h2>
          <div className="space-y-2">
            {detail.rubric.map(criterion => (
              <div key={criterion.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#0B132B]">{criterion.label}</p>
                  {criterion.description && (
                    <p className="text-xs text-[#94A3B8]">{criterion.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-[#0B132B]">
                  {criterion.max_points} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Submission form or status */}
      <section className="ds-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#0B132B]">
          {submission ? 'Your Submission' : 'Submit Your Work'}
        </h2>
        <SubmitForm
          assignmentId={detail.id}
          submissionType={detail.submission_type}
          submission={submission}
          maxScore={detail.max_score}
        />
      </section>
    </div>
  )
}
