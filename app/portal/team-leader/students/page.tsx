import { requireAuth }            from '@/modules/rbac/guards'
import { redirect }               from 'next/navigation'
import {
  listStudentsOperational,
  getOperationalFilterOptions,
  getGroupPickerOptions,
} from '@/modules/students/operational'
import StudentsClient              from './StudentsClient'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function TLStudentsPage({ searchParams: _ }: Props) {
  const user = await requireAuth()

  const allowedRoles = ['team_leader', 'instructor', 'super_admin']
  if (!allowedRoles.includes(user.globalRole)) {
    redirect('/portal/team-leader')
  }

  const isTL = user.globalRole === 'team_leader' || user.globalRole === 'super_admin'

  const branchIds = user.branchIds
  if (!branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  const [rows, filterOptions, groupOptions] = await Promise.all([
    listStudentsOperational(branchIds),
    getOperationalFilterOptions(branchIds),
    getGroupPickerOptions(branchIds),
  ])

  const primaryBranchId = branchIds[0]

  return (
    <StudentsClient
      rows={rows}
      branchId={primaryBranchId}
      branchIds={branchIds}
      branches={filterOptions.branches}
      groups={filterOptions.groups}
      courses={filterOptions.courses}
      instructors={filterOptions.instructors}
      groupOptions={groupOptions}
      isTL={isTL}
    />
  )
}
