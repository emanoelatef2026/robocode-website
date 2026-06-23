import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { getGroupDetail } from '@/modules/schedule/queries'
import { notFound, redirect } from 'next/navigation'
import TLNewSessionForm from './TLNewSessionForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLNewSessionPage({ params }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_groups')
  const { id } = await params

  const group = await getGroupDetail(id)
  if (!group) notFound()

  // Can't schedule without a course assigned
  if (!group.group_course_id) {
    redirect(`/portal/team-leader/groups/${id}`)
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Link
          href={`/portal/team-leader/groups/${id}`}
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Back
        </Link>
      </div>
      <TLNewSessionForm
        groupId={id}
        groupCourseId={group.group_course_id}
        branchId={group.branch_id}
      />
    </div>
  )
}
