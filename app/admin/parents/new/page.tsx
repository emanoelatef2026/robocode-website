import { requirePermission } from '@/modules/rbac/guards'
import { listStudents } from '@/modules/students/queries'
import NewParentForm from './NewParentForm'
import Link from 'next/link'

export default async function NewParentPage() {
  await requirePermission('manage_parents')
  const studentsResult = await listStudents({ perPage: 200 })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/parents" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Parents
        </Link>
      </div>
      <NewParentForm students={studentsResult.data} />
    </div>
  )
}
