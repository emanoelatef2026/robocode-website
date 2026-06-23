import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import { listGroups } from '@/modules/groups/queries'
import NewStudentForm from './NewStudentForm'
import Link from 'next/link'

export default async function NewStudentPage() {
  await requirePermission('manage_students')
  const [branchesResult, groupsResult] = await Promise.all([
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 200, status: 'active' }),
  ])

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/students" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Students
        </Link>
      </div>
      <NewStudentForm branches={branchesResult.data} groups={groupsResult.data} />
    </div>
  )
}
