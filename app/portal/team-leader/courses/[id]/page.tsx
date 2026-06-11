import { notFound }                             from 'next/navigation'
import { getCourse }                            from '@/modules/courses/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import PageHeader                               from '@/components/admin/PageHeader'
import CourseDetailView                         from '@/app/admin/courses/[id]/CourseDetailView'
import Link                                     from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TLCourseDetailPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_courses')

  const { id } = await params
  const course = await getCourse(id)
  if (!course) notFound()

  return (
    <div>
      <PageHeader
        title={course.title}
        description={course.code ?? undefined}
        action={
          <Link
            href="/portal/team-leader/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            ← Courses
          </Link>
        }
      />
      <CourseDetailView course={course} returnPath="/portal/team-leader/courses" />
    </div>
  )
}
