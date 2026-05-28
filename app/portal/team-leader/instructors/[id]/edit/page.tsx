import { getInstructor } from '@/modules/instructors/queries'
import { requirePortalRole } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/admin/PageHeader'
import TLInstructorEditForm from './TLInstructorEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLInstructorEditPage({ params }: Props) {
  await requirePortalRole('team_leader')
  const { id } = await params
  const instructor = await getInstructor(id)
  if (!instructor) notFound()

  const fullName = instructor.first_name
    ? `${instructor.first_name} ${instructor.last_name ?? ''}`.trim()
    : instructor.user_email ?? '—'

  return (
    <div>
      <PageHeader
        title="Edit Instructor"
        description={fullName}
        action={
          <Link
            href={`/portal/team-leader/instructors/${id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <TLInstructorEditForm instructor={instructor} />
    </div>
  )
}
