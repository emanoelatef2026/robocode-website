import { listCourses }           from '@/modules/courses/queries'
import { requirePermission }     from '@/modules/rbac/guards'
import CoursesListClient         from './CoursesListClient'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function CoursesPage({ searchParams }: Props) {
  await requirePermission('manage_courses')
  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listCourses({ page, perPage: 20, search })

  return (
    <CoursesListClient
      courses={result.data}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      perPage={result.perPage}
      search={search}
    />
  )
}
