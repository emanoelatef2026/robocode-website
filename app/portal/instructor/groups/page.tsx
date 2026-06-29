import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, listInstructorGroups } from '@/modules/instructor-portal/queries'
import EmptyState from '@/components/admin/EmptyState'
import InstructorGroupCard from '@/components/portal/instructor/InstructorGroupCard'

export default async function InstructorGroupsPage() {
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

  const groups = await listInstructorGroups(instructor.id)

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No groups assigned yet"
        description="Contact your Team Leader to receive group assignments."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-[#94A3B8]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
      {groups.map((g) => (
        <InstructorGroupCard key={g.group_id} g={g} />
      ))}
    </div>
  )
}
