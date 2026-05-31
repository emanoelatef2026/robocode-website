import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listModulesForSelect }                from '@/modules/assignments/queries'
import { listCourses }                         from '@/modules/courses/queries'
import PageHeader                              from '@/components/admin/PageHeader'
import NewAssignmentForm                       from '@/app/admin/assignments/new/NewAssignmentForm'
import Link                                    from 'next/link'

export default async function TLNewAssignmentPage() {
  await requirePortalRole('team_leader')
  await requirePermission('manage_assignments')

  const [modules, coursesResult] = await Promise.all([
    listModulesForSelect(),
    listCourses({ perPage: 200 }),
  ])

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Assignment"
        description="Create an assignment for your branch."
        action={
          <Link
            href="/portal/team-leader/assignments"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
        }
      />
      <NewAssignmentForm modules={modules} courses={coursesResult.data} />
    </div>
  )
}
