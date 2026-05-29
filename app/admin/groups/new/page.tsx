import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import { listInstructors } from '@/modules/instructors/queries'
import NewGroupForm from './NewGroupForm'
import Link from 'next/link'

export default async function NewGroupPage() {
  await requirePermission('manage_groups')
  const [branchesResult, instructorsResult] = await Promise.all([
    listBranches({ perPage: 100 }),
    listInstructors({ perPage: 200 }),
  ])

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Groups
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Create Group</h1>
      </div>
      <NewGroupForm branches={branchesResult.data} instructors={instructorsResult.data} />
    </div>
  )
}
