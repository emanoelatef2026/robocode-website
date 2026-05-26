import type { AttendanceStatus } from '@/types/enums'

export interface AttendanceRecord {
  id: string
  schedule_id: string
  student_id: string
  status: AttendanceStatus
  late_minutes: number | null
  recorded_by: string
  recorded_at: string
  notes: string | null
  // Joined
  student_email?: string
  student_first_name?: string
  student_last_name?: string
  group_name?: string
  scheduled_at?: string
  branch_name?: string
}

export interface AttendanceListItem {
  id: string
  schedule_id: string
  student_id: string
  status: AttendanceStatus
  recorded_at: string
  notes: string | null
  student_email: string
  student_first_name: string | null
  student_last_name: string | null
  group_name: string
  scheduled_at: string
  branch_name: string
}

export interface SessionStudent {
  student_id: string
  student_email: string
  first_name: string | null
  last_name: string | null
  current_status?: AttendanceStatus
  record_id?: string
}

export interface RecordSessionInput {
  group_id: string
  branch_id: string
  session_date: string
  duration_minutes: number
  delivery: string
  records: Array<{
    student_id: string
    status: AttendanceStatus
    notes?: string
  }>
}
