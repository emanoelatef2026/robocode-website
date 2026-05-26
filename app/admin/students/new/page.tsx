import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import NewStudentForm from './NewStudentForm'
import Link from 'next/link'

export default async function NewStudentPage() {
  await requirePermission('manage_students')
  const branchesResult = await listBranches({ perPage: 100 })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/students" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Students
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Add Student</h1>
      </div>
      <NewStudentForm branches={branchesResult.data} />
    </div>
  )
}
