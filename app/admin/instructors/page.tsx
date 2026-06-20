import { requireAuth }                from '@/modules/rbac/guards'
import { redirect }                    from 'next/navigation'
import { listInstructorsOperational, getInstructorFormOptions } from '@/modules/instructors/operational'
import { createServiceClient }         from '@/lib/supabase/service'
import InstructorsWorkspaceClient      from '@/app/portal/team-leader/instructors/InstructorsWorkspaceClient'

export default async function AdminInstructorsPage() {
  const user = await requireAuth()

  if (!['super_admin', 'team_leader'].includes(user.globalRole)) {
    redirect('/admin')
  }

  const isSuperAdmin = user.globalRole === 'super_admin'
  const db = createServiceClient()

  let branchIds: string[] = user.branchIds ?? []
  if (isSuperAdmin) {
    const { data } = await db.from('branches').select('id').eq('is_active', true)
    branchIds = (data ?? []).map((b: any) => b.id as string)
  }

  const [instructors, options] = await Promise.all([
    listInstructorsOperational(branchIds),
    getInstructorFormOptions(branchIds),
  ])

  return (
    <InstructorsWorkspaceClient
      instructors={instructors}
      options={options}
      branchIds={branchIds}
      canManage
    />
  )
}
