import { getInstructor } from '@/modules/instructors/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import TLInstructorEditForm from './TLInstructorEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLInstructorEditPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_instructors')
  const { id } = await params
  const instructor = await getInstructor(id)
  if (!instructor) notFound()

  const fullName = instructor.first_name
    ? `${instructor.first_name} ${instructor.last_name ?? ''}`.trim()
    : instructor.user_email ?? '—'

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Link
          href={`/portal/team-leader/instructors/${id}`}
          className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
        >
          Back
        </Link>
      </div>
      <TLInstructorEditForm instructor={instructor} />
    </div>
  )
}
