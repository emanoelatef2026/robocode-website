import { notFound } from 'next/navigation'
import { getModule } from '@/modules/courses/modules/queries'
import { listLessons } from '@/modules/courses/lessons/queries'
import { getCourse } from '@/modules/courses/queries'
import { requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import ModuleDetailView from './ModuleDetailView'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string; moduleId: string }>
}

export default async function ModuleDetailPage({ params }: Props) {
  await requirePermission('manage_courses')
  const { id, moduleId } = await params

  const [course, mod, lessons] = await Promise.all([
    getCourse(id),
    getModule(moduleId),
    listLessons(moduleId),
  ])

  if (!course || !mod || mod.course_id !== id) notFound()

  return (
    <div>
      <PageHeader
        title={mod.title}
        description={`Semester ${mod.order_index} · ${course.title}`}
        action={
          <Link
            href={`/admin/courses/${id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back to course
          </Link>
        }
      />
      <ModuleDetailView courseId={id} mod={mod} lessons={lessons} />
    </div>
  )
}
