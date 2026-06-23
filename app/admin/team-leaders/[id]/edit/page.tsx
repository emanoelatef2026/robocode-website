import { getTeamLeader } from '@/modules/team-leaders/queries'
import { getUserConfigurablePermissions } from '@/modules/user-permissions/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import { notFound } from 'next/navigation'
import TeamLeaderEditForm from './TeamLeaderEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TeamLeaderEditPage({ params }: Props) {
  await requirePermission('manage_system')
  const { id } = await params

  const [tl, branchesResult, currentPermissions] = await Promise.all([
    getTeamLeader(id),
    listBranches({ perPage: 100 }),
    getUserConfigurablePermissions(id, 'team_leader'),
  ])

  if (!tl) notFound()

  const fullName = tl.first_name && tl.last_name
    ? `${tl.first_name} ${tl.last_name}`
    : null

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href={`/admin/team-leaders/${id}`} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← {fullName ?? tl.email}
        </Link>
      </div>
      <TeamLeaderEditForm
        tl={tl}
        branches={branchesResult.data}
        currentPermissions={currentPermissions}
      />
    </div>
  )
}
