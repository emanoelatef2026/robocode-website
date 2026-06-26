import { requireAuth }             from '@/modules/rbac/guards'
import { redirect }                 from 'next/navigation'
import {
  listStudentsOperational,
  getOperationalFilterOptions,
  getGroupPickerOptions,
} from '@/modules/students/operational'
import { createServiceClient }      from '@/lib/supabase/service'
import StudentsClient               from '@/app/portal/team-leader/students/StudentsClient'

export default async function AdminStudentsPage() {
  const user = await requireAuth()

  if (!['super_admin', 'team_leader', 'instructor'].includes(user.globalRole)) {
    redirect('/admin')
  }

  const isSuperAdmin = user.globalRole === 'super_admin'

  const db = createServiceClient()
  let branchIds: string[] = user.branchIds ?? []

  if (isSuperAdmin) {
    const { data } = await db.from('branches').select('id').eq('is_active', true)
    branchIds = (data ?? [] as { id: string }[]).map(b => b.id)
  }

  if (!branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branches found.
      </div>
    )
  }

  const [rows, filterOptions, groupOptions] = await Promise.all([
    listStudentsOperational(branchIds),
    getOperationalFilterOptions(branchIds),
    getGroupPickerOptions(branchIds),
  ])

  return (
    <StudentsClient
      rows={rows}
      branchId={branchIds[0]}
      branchIds={branchIds}
      branches={filterOptions.branches}
      groups={filterOptions.groups}
      courses={filterOptions.courses}
      instructors={filterOptions.instructors}
      groupOptions={groupOptions}
      isTL
    />
  )
}
