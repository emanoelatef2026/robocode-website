import { requireAuth }              from '@/modules/rbac/guards'
import { redirect }                  from 'next/navigation'
import Link                          from 'next/link'
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
    branchIds = (data ?? [] as { id: string }[]).map(b => b.id)
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
    <div>
      {isSuperAdmin && (
        <div className="px-4 pt-4 sm:px-6">
          <Link
            href="/admin/parents/duplicates"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#FF8A1F] hover:underline"
          >
            Check for duplicate parent accounts →
          </Link>
        </div>
      )}
      <ParentsClient
        rows={rows}
        branches={branches}
        groups={filterOptions.groups}
        courses={filterOptions.courses}
        instructors={filterOptions.instructors}
        studentOptions={studentOptions}
        isTL
      />
    </div>
  )
}
