import { requirePermission }     from '@/modules/rbac/guards'
import { listCourses }           from '@/modules/courses/queries'
import { createServiceClient }   from '@/lib/supabase/service'
import TLCoursesListClient       from '@/app/portal/team-leader/courses/TLCoursesListClient'
import type { CourseMetric }     from '@/app/portal/team-leader/courses/TLCoursesListClient'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function AdminCoursesPage({ searchParams }: Props) {
  await requirePermission('manage_courses')

  const params = await searchParams
  const page   = Number(params.page ?? 1)
  const search = params.q ?? ''

  const result = await listCourses({ page, perPage: 20, search })

  const db        = createServiceClient()
  const courseIds = result.data.map(c => c.id)
  const metrics:  CourseMetric[] = []

  if (courseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: metricsData, error: metricsErr } = await (db as any)
      .from('v_course_metrics')
      .select('course_id, active_enrollments, total_revenue, dropout_pct, retention_pct')
      .in('course_id', courseIds)

    if (!metricsErr && metricsData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (metricsData as any[])) {
        metrics.push({
          courseId:  r.course_id,
          active:    Number(r.active_enrollments ?? 0),
          revenue:   Number(r.total_revenue      ?? 0),
          dropout:   Number(r.dropout_pct        ?? 0),
          retention: Number(r.retention_pct      ?? 0),
        })
      }
    }
  }

  return (
    <TLCoursesListClient
      courses={result.data}
      metrics={metrics}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      search={search}
    />
  )
}
