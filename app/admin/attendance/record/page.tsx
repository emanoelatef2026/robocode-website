import { requirePermission } from '@/modules/rbac/guards'
import { listGroups } from '@/modules/groups/queries'
import { getGroupStudentsForSession } from '@/modules/attendance/queries'
import AttendanceRecordForm from './AttendanceRecordForm'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ group?: string }>
}

export default async function RecordAttendancePage({ searchParams }: Props) {
  await requirePermission('manage_attendance')
  const params  = await searchParams
  const groupId = params.group

  const groupsResult = await listGroups({ perPage: 100, status: 'active' })

  let students: Awaited<ReturnType<typeof getGroupStudentsForSession>> = []
  const selectedGroup = groupsResult.data.find((g) => g.id === groupId)

  if (groupId && selectedGroup) {
    students = await getGroupStudentsForSession(groupId)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/attendance" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
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
