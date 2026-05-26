import { getInstructor } from '@/modules/instructors/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import InstructorEditForm from './InstructorEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function InstructorEditPage({ params }: Props) {
  await requirePermission('manage_instructors')
  const { id } = await params
  const instructor = await getInstructor(id)
  if (!instructor) notFound()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/admin/instructors" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Instructors
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">
          {instructor.first_name && instructor.last_name
            ? `${instructor.first_name} ${instructor.last_name}`
            : instructor.user_email}
        </h1>
        <p className="text-sm text-[#64748B]">{instructor.user_email} · {instructor.branch_name}</p>
      </div>
      <InstructorEditForm instructor={instructor} />
    </div>
  )
}
