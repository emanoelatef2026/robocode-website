import { getParent }                            from '@/modules/parents/queries'
import { listStudents }                         from '@/modules/students/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { notFound }                             from 'next/navigation'
import ParentDetailView                         from '@/app/admin/parents/[id]/ParentDetailView'
import Link                                     from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLParentDetailPage({ params }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_parents')

  const { id } = await params
  const [parent, studentsResult] = await Promise.all([
    getParent(id),
    // Only branch students available for linking
    listStudents({ perPage: 200, branchId: user.branchIds }),
  ])
  if (!parent) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/portal/team-leader/parents" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Parents
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">
          {parent.first_name && parent.last_name
            ? `${parent.first_name} ${parent.last_name}`
            : parent.user_email}
        </h1>
        <p className="text-sm text-[#64748B]">{parent.user_email}</p>
      </div>
      <ParentDetailView parent={parent} students={studentsResult.data} />
    </div>
  )
}
