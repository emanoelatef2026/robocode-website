import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getSemesterDashboard, listSemesterEnrollments, listSemesterCourses, listSemesterGroups } from '@/modules/semesters/queries'
import { listAcademicYears } from '@/modules/academic-years/queries'
import { listStudents } from '@/modules/students/queries'
import { listCourses } from '@/modules/courses/queries'
import PageHeader from '@/components/admin/PageHeader'
import SemesterDashboard from './SemesterDashboard'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SemesterDetailPage({ params }: Props) {
  await requirePermission('manage_semesters')
  const { id } = await params

  const [dashboard, enrollments, semCourses, groups, years, allStudents, allCourses] =
    await Promise.all([
      getSemesterDashboard(id),
      listSemesterEnrollments(id),
      listSemesterCourses(id),
      listSemesterGroups(id),
      listAcademicYears(),
      listStudents({ perPage: 500 }),
      listCourses({ perPage: 200 }),
    ])

  if (!dashboard) notFound()

  return (
    <div>
      <PageHeader
        title={dashboard.semester.name}
        description={`${dashboard.semester.academic_year_name} · ${dashboard.semester.status}`}
        action={
          <Link
            href="/admin/semesters"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <SemesterDashboard
        dashboard={dashboard}
        enrollments={enrollments}
        semCourses={semCourses}
        groups={groups}
        years={years}
        allStudents={allStudents.data}
        allCourses={allCourses.data}
      />
    </div>
  )
}
