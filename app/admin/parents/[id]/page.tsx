import { getParent } from '@/modules/parents/queries'
import { listStudents } from '@/modules/students/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import ParentDetailView from './ParentDetailView'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function ParentDetailPage({ params }: Props) {
  await requirePermission('manage_parents')
  const { id } = await params
  const [parent, studentsResult] = await Promise.all([
    getParent(id),
    listStudents({ perPage: 200 }),
  ])
  if (!parent) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/parents" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Parents
        </Link>
      </div>
      <ParentDetailView parent={parent} students={studentsResult.data} />
    </div>
  )
}
