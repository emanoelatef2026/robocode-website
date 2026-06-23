import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import { listGroups } from '@/modules/groups/queries'
import NewInstructorForm from './NewInstructorForm'
import Link from 'next/link'

export default async function NewInstructorPage() {
  const user           = await requirePermission('manage_instructors')
  const branchFilter   = user.globalRole === 'super_admin' ? undefined : user.branchIds
  const [branchesResult, groupsResult] = await Promise.all([
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 300, ...(branchFilter && { branchId: branchFilter }) }),
  ])

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/instructors" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Instructors
        </Link>
      </div>
      <NewInstructorForm
        branches={branchesResult.data}
        groups={groupsResult.data}
      />
    </div>
  )
}
