import { getInstructor, getInstructorGroups } from '@/modules/instructors/queries'
import { getUserConfigurablePermissions } from '@/modules/user-permissions/queries'
import { requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import InstructorEditForm from './InstructorEditForm'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function InstructorEditPage({ params }: Props) {
  await requirePermission('manage_instructors')
  const { id } = await params

  const [instructor, groups, currentPermissions] = await Promise.all([
    getInstructor(id),
    getInstructorGroups(id),
    getUserConfigurablePermissions(id, 'instructor'),
  ])
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

      <InstructorEditForm instructor={instructor} currentPermissions={currentPermissions} />

      {/* Groups */}
      {groups.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">Groups ({groups.length})</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Students</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                    <Link href={`/admin/groups/${g.id}`} className="hover:text-[#FF8A1F]">{g.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-[#64748B]">{g.type}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={g.status} /></td>
                  <td className="px-4 py-2.5 text-right font-medium text-[#0B1F3A]">{g.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
