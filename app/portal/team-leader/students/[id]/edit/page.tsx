import { getStudent } from '@/modules/students/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/admin/PageHeader'
import TLStudentEditForm from './TLStudentEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLStudentEditPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_students')
  const { id } = await params
  const student = await getStudent(id)
  if (!student) notFound()

  return (
    <div>
      <PageHeader
        title="Edit Student"
        description={student.first_name ? `${student.first_name} ${student.last_name ?? ''}`.trim() : student.user_email}
        action={
          <Link
            href={`/portal/team-leader/students/${id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <TLStudentEditForm student={student} />
    </div>
  )
}
