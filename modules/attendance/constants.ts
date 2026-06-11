import type { AttendanceStatus } from '@/types/enums'

// Every attendance status consumes a session slot.
// Rationale: the seat was reserved regardless of why the student couldn't attend.
// This is the canonical set used by:
//   - recordAttendanceSession (real-time consumption)
//   - consume_attendance_sessions_batch (DB ledger)
//   - recompute_session_consumption (repair/reconcile)
export const SLOT_CONSUMING_STATUSES: ReadonlySet<AttendanceStatus> = new Set<AttendanceStatus>([
  'present',
  'absent',
  'late',
  'makeup',
  'excused',
])
