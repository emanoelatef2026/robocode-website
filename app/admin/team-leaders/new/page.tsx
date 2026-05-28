import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import NewTeamLeaderForm from './NewTeamLeaderForm'
import Link from 'next/link'

export default async function NewTeamLeaderPage() {
  await requirePermission('manage_system')
  const branchesResult = await listBranches({ perPage: 100 })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/team-leaders" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Team Leaders
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Add Team Leader</h1>
      </div>
      <NewTeamLeaderForm branches={branchesResult.data} />
    </div>
  )
}
