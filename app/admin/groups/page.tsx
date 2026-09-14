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
    const loadBranches = () => db.from('branches').select('id').eq('is_active', true)
    let { data: activeBranches, error: branchesError } = await loadBranches()
    if (branchesError?.message.toLowerCase().includes('gateway timeout')) {
      console.warn('[AdminGroupsPage] retrying after branch lookup gateway timeout')
      const retry = await loadBranches()
      activeBranches = retry.data
      branchesError = retry.error
    }
    if (branchesError) {
      throw new Error(`Failed to load branches: ${branchesError.message}`)
    }
    branchIds = (activeBranches ?? []).map(b => b.id)
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
