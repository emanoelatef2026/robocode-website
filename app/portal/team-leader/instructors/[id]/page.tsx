import { getInstructor } from '@/modules/instructors/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLInstructorDetailPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_instructors')
  const { id } = await params
  const instructor = await getInstructor(id)
  if (!instructor) notFound()

  const fullName = instructor.first_name
    ? `${instructor.first_name} ${instructor.last_name ?? ''}`.trim()
    : null

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <div className="flex gap-2">
          <Link
            href="/portal/team-leader/instructors"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
          <Link
            href={`/portal/team-leader/instructors/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Email</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{instructor.user_email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Status</dt>
            <dd className="mt-1"><StatusBadge status={instructor.status} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Employee ID</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{instructor.employee_id ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#64748B]">Branch</dt>
            <dd className="mt-1 text-sm text-[#0B1F3A]">{instructor.branch_name}</dd>
          </div>
          {instructor.hire_date && (
            <div>
              <dt className="text-xs font-medium text-[#64748B]">Hire date</dt>
              <dd className="mt-1 text-sm text-[#0B1F3A]">
                {new Date(instructor.hire_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </dd>
            </div>
          )}
          {instructor.specializations.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-[#64748B]">Specializations</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {instructor.specializations.map((s) => (
                  <span key={s} className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs text-[#0B1F3A]">
                    {s}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
