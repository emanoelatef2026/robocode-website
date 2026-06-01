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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/branches" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← Branches
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">{branch.name}</h1>
        </div>
        <Link
          href={`/admin/branches/${id}/performance`}
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e87c18]"
        >
          View Performance
        </Link>
      </div>
      <BranchEditForm branch={branch} />
    </div>
  )
}
