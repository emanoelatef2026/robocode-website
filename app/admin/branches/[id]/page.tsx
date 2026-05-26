import { getBranch } from '@/modules/branches/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import BranchEditForm from './BranchEditForm'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BranchEditPage({ params }: Props) {
  await requirePermission('manage_branches')
  const { id } = await params
  const branch = await getBranch(id)
  if (!branch) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/branches" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Branches
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Edit Branch</h1>
      </div>
      <BranchEditForm branch={branch} />
    </div>
  )
}
