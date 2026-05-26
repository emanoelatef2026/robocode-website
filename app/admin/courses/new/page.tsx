import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import PageHeader from '@/components/admin/PageHeader'
import NewCourseForm from './NewCourseForm'
import Link from 'next/link'

export default async function NewCoursePage() {
  await requirePermission('manage_courses')
  const branchesResult = await listBranches({ perPage: 100 })

  return (
    <div>
      <PageHeader
        title="New Course"
        description="Create a course and add modules to it."
        action={
          <Link
            href="/admin/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <NewCourseForm branches={branchesResult.data} />
    </div>
  )
}
