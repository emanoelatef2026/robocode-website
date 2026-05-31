import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listGroups }                           from '@/modules/groups/queries'
import { getGroupStudentsForSession }           from '@/modules/attendance/queries'
import AttendanceRecordForm                     from '@/app/admin/attendance/record/AttendanceRecordForm'
import Link                                     from 'next/link'

interface Props {
  searchParams: Promise<{ group?: string }>
}

export default async function TLRecordAttendancePage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  await requirePermission('manage_attendance')

  const params  = await searchParams
  const groupId = params.group

  // Filter groups to TL branch only
  const groupsResult = await listGroups({ perPage: 100, status: 'active', branchId: user.branchIds })

  let students: Awaited<ReturnType<typeof getGroupStudentsForSession>> = []
  let selectedGroup = groupsResult.data.find(g => g.id === groupId)

  if (groupId && selectedGroup) {
    students = await getGroupStudentsForSession(groupId)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/portal/team-leader/attendance" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Attendance
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-[#0B1F3A]">Record Session</h1>
      </div>

      <AttendanceRecordForm
        groups={groupsResult.data}
        selectedGroupId={groupId}
        selectedGroup={selectedGroup}
        students={students}
      />
    </div>
  )
}
