import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { createServiceClient }                  from '@/lib/supabase/service'
import PageHeader                               from '@/components/admin/PageHeader'
import TLNewInstructorForm                      from './TLNewInstructorForm'
import Link                                     from 'next/link'

export default async function TLNewInstructorPage() {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_instructors')

  const branchIds = user.branchIds
  if (!branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  let branches: { id: string; name: string }[] = []
  if (branchIds.length > 1) {
    const db = createServiceClient()
    const { data } = await db.from('branches').select('id, name').in('id', branchIds).order('name')
    branches = (data ?? []) as { id: string; name: string }[]
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
      <TLNewInstructorForm
        branchIds={branchIds}
        branches={branches}
      />
    </div>
  )
}
