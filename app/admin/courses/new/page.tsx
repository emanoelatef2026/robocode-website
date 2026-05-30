import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import NewCourseForm from './NewCourseForm'
import Link from 'next/link'

export default async function NewCoursePage() {
  await requirePermission('manage_courses')

  return (
    <div>
      <PageHeader
        title="New Course"
        description="Courses are global academy assets available to all branches."
        action={
          <Link
            href="/admin/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <NewCourseForm />
    </div>
  )
}
