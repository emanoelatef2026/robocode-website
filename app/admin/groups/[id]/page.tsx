import { getGroup, listGroupEnrollments } from '@/modules/groups/queries'
import { listStudents } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import GroupDetailView from './GroupDetailView'
import GroupStudentsTable from './GroupStudentsTable'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function GroupDetailPage({ params }: Props) {
  const user    = await requirePermission('manage_groups')
  const { id }  = await params

  // Fetch group first so we can scope available students to its branch
  const group = await getGroup(id)
  if (!group) notFound()

  const [enrollments, studentsResult] = await Promise.all([
    listGroupEnrollments(id),
    listStudents({ perPage: 400, branchId: group.branch_id }),
  ])

  // Students in the same branch who are not already active members
  const activeIds    = new Set(enrollments.filter((e) => e.status === 'active').map((e) => e.student_id))
  const availableStudents = studentsResult.data.filter((s) => !activeIds.has(s.id))

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Groups
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{group.name}</h1>
        <p className="text-sm text-[#64748B]">{group.branch_name} · {group.type}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left — Group settings */}
        <GroupDetailView group={group} />

        {/* Right — Student management grid */}
        <GroupStudentsTable
          group={group}
          enrollments={enrollments}
          availableStudents={availableStudents}
        />
      </div>
    </div>
  )
}
