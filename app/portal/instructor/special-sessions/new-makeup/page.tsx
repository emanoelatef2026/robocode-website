import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import EmptyState from '@/components/admin/EmptyState'
import NewMakeupForm from './_components/NewMakeupForm'

export default async function NewMakeupSessionPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return <EmptyState title="No instructor record found" description="Contact your team leader." />
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-[18px] font-bold text-[#0B1F3A]">New Makeup Session</h1>
      <NewMakeupForm branchId={instructor.branch_id} instructorId={instructor.id} />
    </div>
  )
}
