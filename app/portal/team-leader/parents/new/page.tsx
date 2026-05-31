import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listStudents }                         from '@/modules/students/queries'
import NewParentForm                            from '@/app/admin/parents/new/NewParentForm'
import Link                                     from 'next/link'

export default async function TLNewParentPage() {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_parents')

  // Only branch students can be linked to the new parent
  const studentsResult = await listStudents({ perPage: 200, branchId: user.branchIds })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/portal/team-leader/parents" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Parents
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Add Parent</h1>
      </div>
      <NewParentForm students={studentsResult.data} />
    </div>
  )
}
