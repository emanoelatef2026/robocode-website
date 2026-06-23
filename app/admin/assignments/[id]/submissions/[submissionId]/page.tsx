import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getAssignment } from '@/modules/assignments/queries'
import { getSubmission } from '@/modules/assignments/submissions/queries'
import GradingView from './GradingView'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string; submissionId: string }>
}

export default async function GradingPage({ params }: Props) {
  await requirePermission('grade_assignments')
  const { id, submissionId } = await params

  const [assignment, submission] = await Promise.all([
    getAssignment(id),
    getSubmission(submissionId),
  ])

  if (!assignment || !submission) notFound()

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex justify-end">
        <Link
          href={`/admin/assignments/${id}`}
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Back to assignment
        </Link>
      </div>
      <GradingView assignment={assignment} submission={submission} />
    </div>
  )
}
