import { getGroup, listGroupEnrollments } from '@/modules/groups/queries'
import { listStudents } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import GroupDetailView from './GroupDetailView'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function GroupDetailPage({ params }: Props) {
  await requirePermission('manage_groups')
  const { id } = await params

  const [group, enrollments, studentsResult] = await Promise.all([
    getGroup(id),
    listGroupEnrollments(id),
    listStudents({ perPage: 200 }),
  ])

  if (!group) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Groups
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{group.name}</h1>
        <p className="text-sm text-[#64748B]">{group.branch_name} · {group.type}</p>
      </div>
      <GroupDetailView group={group} enrollments={enrollments} students={studentsResult.data} />
    </div>
  )
}
