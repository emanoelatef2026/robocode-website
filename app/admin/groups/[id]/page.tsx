import {
  getGroup,
  listGroupEnrollments,
  getGroupAcademicConfig,
} from '@/modules/groups/queries'
import { listStudents } from '@/modules/students/queries'
import { listCourses } from '@/modules/courses/queries'
import { listInstructors } from '@/modules/instructors/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import GroupDetailView from './GroupDetailView'
import GroupStudentsTable from './GroupStudentsTable'
import AcademicConfigCard from './AcademicConfigCard'
import GroupHealthCard from './GroupHealthCard'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function GroupDetailPage({ params }: Props) {
  await requirePermission('manage_groups')
  const { id } = await params

  const group = await getGroup(id)
  if (!group) notFound()

  const [
    enrollments,
    studentsResult,
    academicConfig,
    coursesResult,
    instructorsResult,
  ] = await Promise.all([
    listGroupEnrollments(id),
    listStudents({ perPage: 400, branchId: group.branch_id }),
    getGroupAcademicConfig(id),
    listCourses({ perPage: 200 }),
    listInstructors({ perPage: 200, branchId: group.branch_id }),
  ])

  const activeIds         = new Set(enrollments.filter((e) => e.status === 'active').map((e) => e.student_id))
  const availableStudents = studentsResult.data.filter((s) => !activeIds.has(s.id))

  const courseOptions = coursesResult.data.map((c) => ({
    id:    c.id,
    title: c.title,
    code:  c.code,
  }))

  const instructorOptions = instructorsResult.data.map((i) => ({
    id:          i.id,
    name:        [i.first_name, i.last_name].filter(Boolean).join(' ') || i.user_email,
    branch_name: i.branch_name,
  }))

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Groups
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{group.name}</h1>
        <p className="text-sm text-[#64748B]">{group.branch_name} · {group.type}</p>
      </div>

      <div className="mb-6">
        <AcademicConfigCard
          groupId={id}
          config={academicConfig}
          courses={courseOptions}
          instructors={instructorOptions}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <GroupDetailView group={group} />
          <GroupHealthCard groupId={id} capacity={group.capacity ?? null} />
        </div>
        <GroupStudentsTable
          group={group}
          enrollments={enrollments}
          availableStudents={availableStudents}
        />
      </div>
    </div>
  )
}
