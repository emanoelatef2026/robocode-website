import { requirePortalRole } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import TLNewInstructorForm from './TLNewInstructorForm'
import Link from 'next/link'

export default async function TLNewInstructorPage() {
  const user = await requirePortalRole('team_leader')
  const branchId = user.branchIds[0]

  if (!branchId) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Add Instructor"
        description="Create a new instructor account for your branch"
        action={
          <Link
            href="/portal/team-leader/instructors"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <TLNewInstructorForm branchId={branchId} />
    </div>
  )
}
