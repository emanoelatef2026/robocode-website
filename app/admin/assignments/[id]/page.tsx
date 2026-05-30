import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getAssignment } from '@/modules/assignments/queries'
import { listSubmissions } from '@/modules/assignments/submissions/queries'
import PageHeader from '@/components/admin/PageHeader'
import AssignmentDetailView from './AssignmentDetailView'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AssignmentDetailPage({ params }: Props) {
  await requirePermission('manage_assignments')
  const { id } = await params

  const [assignment, submissions] = await Promise.all([
    getAssignment(id),
    listSubmissions(id),
  ])

  if (!assignment) notFound()

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={assignment.title}
        description={`${assignment.course_title ?? '—'} › ${assignment.module_title ? `Semester: ${assignment.module_title}` : (assignment.lesson_title ?? '—')}`}
        action={
          <Link
            href="/admin/assignments"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <AssignmentDetailView assignment={assignment} submissions={submissions} />
    </div>
  )
}
