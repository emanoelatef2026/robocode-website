import { requirePermission } from '@/modules/rbac/guards'
import { listBranches } from '@/modules/branches/queries'
import NewInstructorForm from './NewInstructorForm'
import Link from 'next/link'

export default async function NewInstructorPage() {
  await requirePermission('manage_instructors')
  const branchesResult = await listBranches({ perPage: 100 })

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/instructors" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Instructors
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Add Instructor</h1>
      </div>
      <NewInstructorForm branches={branchesResult.data} />
    </div>
  )
}
