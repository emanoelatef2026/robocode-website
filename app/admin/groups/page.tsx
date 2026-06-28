import { requireAuth }               from '@/modules/rbac/guards'
import { redirect }                   from 'next/navigation'
import { listGroupsOperational, getGroupFormOptions, getGroupStudentOptions } from '@/modules/groups/operational'
import { createServiceClient }        from '@/lib/supabase/service'
import GroupsWorkspaceClient          from '@/app/portal/team-leader/groups/GroupsWorkspaceClient'

export default async function AdminGroupsPage() {
  const user = await requireAuth()

  if (!['super_admin', 'team_leader'].includes(user.globalRole)) {
    redirect('/admin')
  }

  const isSuperAdmin = user.globalRole === 'super_admin'
  const db = createServiceClient()

  let branchIds: string[] = user.branchIds ?? []
  if (isSuperAdmin) {
    const { data } = await db.from('branches').select('id').eq('is_active', true)
    branchIds = (data ?? [] as { id: string }[]).map(b => b.id)
  }

  const defaultBranchId = branchIds[0] ?? ''

  const [groups, options, studentOptions] = await Promise.all([
    listGroupsOperational(branchIds),
    getGroupFormOptions(branchIds),
    getGroupStudentOptions(branchIds),
  ])

  return (
    <GroupsWorkspaceClient
      groups={groups}
      options={options}
      studentOptions={studentOptions}
      defaultBranchId={defaultBranchId}
      isTL
      isSuperAdmin={isSuperAdmin}
      showPageHeader
    />
  )
}
