import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listInstructorsOperational, getInstructorFormOptions } from '@/modules/instructors/operational'
import InstructorsWorkspaceClient from './InstructorsWorkspaceClient'

export default async function TLInstructorsPage() {
  const user      = await requirePortalRole('team_leader')
  const canManage = await requirePermission('manage_instructors').then(() => true).catch(() => false)

  const branchIds = user.branchIds ?? []

  const [instructors, options] = await Promise.all([
    listInstructorsOperational(branchIds),
    getInstructorFormOptions(branchIds),
  ])

  return (
    <InstructorsWorkspaceClient
      instructors={instructors}
      options={options}
      branchIds={branchIds}
      canManage={canManage}
    />
  )
}
