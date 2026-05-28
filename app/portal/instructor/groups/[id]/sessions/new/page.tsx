import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getGroupForInstructor } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import NewSessionForm from './NewSessionForm'

interface Props { params: Promise<{ id: string }> }

export default async function NewSessionPage({ params }: Props) {
  const user       = await requirePortalRole('instructor')
  const { id }     = await params
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) notFound()

  const group = await getGroupForInstructor(id, instructor.id)
  if (!group) notFound()

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link href={`/portal/instructor/groups/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← {group.group_name}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">New Session</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">{group.course_title}</p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <NewSessionForm
          groupId={id}
          groupCourseId={group.group_course_id}
          branchId={group.branch_id}
        />
      </div>
    </div>
  )
}
