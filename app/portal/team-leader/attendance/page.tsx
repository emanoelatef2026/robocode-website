import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listAttendanceRecords }                from '@/modules/attendance/queries'
import PageHeader                               from '@/components/admin/PageHeader'
import StatusBadge                              from '@/components/admin/StatusBadge'
import EmptyState                               from '@/components/admin/EmptyState'
import Pagination                               from '@/components/admin/Pagination'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function TLAttendancePage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_attendance')

  const params = await searchParams
  const page   = Number(params.page ?? 1)

  const result = await listAttendanceRecords({ page, perPage: 30, branchId: user.branchIds })

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="View and record class attendance"
        action={
          <Link
            href="/portal/team-leader/attendance/record"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Record Session
          </Link>
        }
      />

      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        {result.data.length === 0 ? (
          <EmptyState
            title="No attendance records yet"
            description="Record the first session to see attendance here."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Session Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(rec => (
                    <tr key={rec.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                        {rec.student_first_name && rec.student_last_name
                          ? `${rec.student_first_name} ${rec.student_last_name}`
                          : rec.student_email}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{rec.group_name || '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {rec.scheduled_at
                          ? new Date(rec.scheduled_at).toLocaleDateString('en-GB')
                          : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
          </>
        )}
      </div>
    </div>
  )
}
