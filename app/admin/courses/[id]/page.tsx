import { notFound } from 'next/navigation'
import { getCourse } from '@/modules/courses/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import CourseDetailView from './CourseDetailView'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CourseDetailPage({ params }: Props) {
  await requirePermission('manage_courses')
  const { id } = await params

  const course = await getCourse(id)
  if (!course) notFound()

  return (
    <div>
      <PageHeader
        title={course.title}
        description={course.code ?? 'No code'}
        action={
          <Link
            href="/admin/courses"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <CourseDetailView course={course} />
    </div>
  )
}
