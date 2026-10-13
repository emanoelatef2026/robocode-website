import type { StudentAttendanceHistoryRecord } from './actions/types'

export interface AttendanceContractOption {
  id: string
  code: string | null
  course_id: string | null
  course_name: string
  group_name: string | null
  start_date: string | null
  status: string
  enrolled_sessions: number
  consumed_sessions: number
  remaining_sessions: number
}

export interface BrowsableAttendanceRecord extends StudentAttendanceHistoryRecord {
  enrollment_id: string | null
  course_id: string | null
  course_name: string
}

export interface StudentAttendanceBrowserData {
  contracts: AttendanceContractOption[]
  records: BrowsableAttendanceRecord[]
}

export function filterStudentAttendance(
  records: BrowsableAttendanceRecord[],
  courseId: string,
  contractId: string,
) {
  return records.filter(record => contractId
    ? record.enrollment_id === contractId
    : !courseId || record.course_id === courseId,
  ).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at) || a.id.localeCompare(b.id))
}

export function summarizeStudentAttendance(records: BrowsableAttendanceRecord[]) {
  return {
    present: records.filter(record => record.status === 'present').length,
    absent: records.filter(record => record.status === 'absent').length,
    late: records.filter(record => record.status === 'late').length,
    consumed: records.filter(record => record.is_consumed).length,
  }
}
