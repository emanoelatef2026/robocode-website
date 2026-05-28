import { getStudent } from '@/modules/students/queries'
import { requirePortalRole } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import PageHeader from '@/components/admin/PageHeader'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLStudentDetailPage({ params }: Props) {
  await requirePortalRole('team_leader')
  const { id } = await params
  const student = await getStudent(id)
  if (!student) notFound()

  const fullName = student.first_name
    ? `${student.first_name} ${student.last_name ?? ''}`.trim()
    : undefined

  return (
    <div>
      <PageHeader
        title={fullName ?? student.user_email ?? '—'}
        description="Student profile"
        action={
          <div className="flex gap-2">
            <Link
              href="/portal/team-leader/students"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
            >
              Back
            </Link>
            <Link
              href={`/portal/team-leader/students/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
            >
              Edit
            </Link>
          </div>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Email</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{student.user_email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Status</dt>
            <dd className="mt-1"><StatusBadge status={student.status} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Student code</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{student.student_code ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Branch</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{student.branch_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Enrolled</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">
              {new Date(student.enrollment_date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </dd>
          </div>
          {(student as any).notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-[#64748B]">Notes</dt>
              <dd className="mt-1 text-sm text-[#0B1F3A]">{(student as any).notes}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
