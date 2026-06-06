import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listGroupsOperational, getGroupFormOptions, getGroupStudentOptions } from '@/modules/groups/operational'
import GroupsWorkspaceClient from './GroupsWorkspaceClient'

export default async function TLGroupsPage() {
  const user      = await requirePortalRole('team_leader')
  const canManage = await requirePermission('manage_groups').then(() => true).catch(() => false)

  const branchIds = user.branchIds ?? []

  const [groups, options, studentOptions] = await Promise.all([
    listGroupsOperational(branchIds),
    getGroupFormOptions(branchIds),
    canManage ? getGroupStudentOptions(branchIds) : Promise.resolve([]),
  ])

  const defaultBranchId = branchIds[0] ?? ''

  return (
    <GroupsWorkspaceClient
      groups={groups}
      options={options}
      studentOptions={studentOptions}
      defaultBranchId={defaultBranchId}
      isTL={canManage}
    />
  )
}
