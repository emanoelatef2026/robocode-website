import { requireAuth }              from '@/modules/rbac/guards'
import { redirect }                  from 'next/navigation'
import {
  listParentContactsOperational,
  getParentBranches,
  getParentFilterOptions,
  getStudentPickerOptions,
} from '@/modules/parents/operational'
import { createServiceClient }       from '@/lib/supabase/service'
import ParentsClient                 from '@/app/portal/team-leader/parents/ParentsClient'

export default async function AdminParentsPage() {
  const user = await requireAuth()

  if (!['super_admin', 'team_leader', 'instructor'].includes(user.globalRole)) {
    redirect('/admin')
  }

  const isSuperAdmin = user.globalRole === 'super_admin'

  const db = createServiceClient()
  let branchIds: string[] = user.branchIds ?? []

  if (isSuperAdmin) {
    const { data } = await db.from('branches').select('id').eq('is_active', true)
    branchIds = (data ?? []).map((b: any) => b.id as string)
  }

  if (!branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branches found.
      </div>
    )
  }

  const [rows, branches, filterOptions, studentOptions] = await Promise.all([
    listParentContactsOperational(branchIds),
    getParentBranches(branchIds),
    getParentFilterOptions(branchIds),
    getStudentPickerOptions(branchIds),
  ])

  return (
    <ParentsClient
      rows={rows}
      branches={branches}
      groups={filterOptions.groups}
      courses={filterOptions.courses}
      instructors={filterOptions.instructors}
      studentOptions={studentOptions}
      isTL
    />
  )
}
