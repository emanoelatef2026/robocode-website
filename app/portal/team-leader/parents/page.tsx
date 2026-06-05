import { requireAuth }       from '@/modules/rbac/guards'
import { redirect }          from 'next/navigation'
import {
  listParentsOperational,
  getStudentPickerOptions,
  getParentBranches,
  getParentFilterOptions,
} from '@/modules/parents/operational'
import ParentsClient          from './ParentsClient'

export default async function TLParentsPage() {
  const user = await requireAuth()

  const allowedRoles = ['team_leader', 'instructor', 'super_admin']
  if (!allowedRoles.includes(user.globalRole)) redirect('/portal/team-leader')

  const isTL = user.globalRole === 'team_leader' || user.globalRole === 'super_admin'

  const { branchIds } = user
  if (!branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  const [rows, studentOptions, branches, filterOptions] = await Promise.all([
    listParentsOperational(branchIds),
    getStudentPickerOptions(branchIds),
    getParentBranches(branchIds),
    getParentFilterOptions(branchIds),
  ])

  return (
    <ParentsClient
      rows={rows}
      studentOptions={studentOptions}
      branches={branches}
      groups={filterOptions.groups}
      courses={filterOptions.courses}
      instructors={filterOptions.instructors}
      isTL={isTL}
    />
  )
}
