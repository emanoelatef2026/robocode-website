import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import PageHeader                               from '@/components/admin/PageHeader'
import NewCourseForm                            from '@/app/admin/courses/new/NewCourseForm'
import Link                                     from 'next/link'

export default async function TLNewCoursePage() {
  await requirePortalRole('team_leader')
  await requirePermission('manage_courses')

  return (
    <div>
      <PageHeader
        title="New Course"
        description="Courses are global academy assets available to all branches."
        action={
          <Link
            href="/portal/team-leader/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            ← Courses
          </Link>
        }
      />
      <NewCourseForm />
    </div>
  )
}
