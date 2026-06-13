// Domain types for group detail operations.
// Consumed by server actions, client components, and the quick-view modal.

export interface GroupDetailData {
  sessions: GroupDetailSession[]
  students: GroupDetailStudent[]
}

export interface GroupDetailSession {
  id:               string
  scheduled_at:     string
  duration_minutes: number
  type:             string
  status:           string
  topic:            string | null
  meeting_url:      string | null
  session_number:   number | null   // canonical from schedules.session_number
  present_count:    number          // present/late/makeup attendance records
  absent_count:     number          // absent attendance records
  course_name:      string | null   // which course this session belongs to
}

export interface GroupDetailStudent {
  student_id:          string
  student_name:        string
  student_code:        string | null
  age:                 number | null
  phone:               string | null
  parent_phone:        string | null
  joined_at:           string
  attendance_pct:      number
  sessions_remaining:  number | null
  risk_level:          'HIGH' | 'MEDIUM' | 'LOW'
  // Finance
  paid_amount:         number
  remaining_balance:   number
  payment_status:      string | null
  sessions_used:       number | null
  sessions_total:      number | null
  subscription_amount: number | null
  account_id:           string | null
  enrollment_id:        string | null
  enrollment_start_date: string | null   // start_date of the active enrollment (for eligibility display)
}

export interface StudentAttendanceHistoryRecord {
  id:              string
  scheduled_at:   string
  topic:           string | null
  group_name:      string | null
  instructor_name: string | null
  status:          string
  is_consumed:     boolean
}

export interface StudentAuthData {
  email:           string | null
  portal_password: string | null
}

export interface StudentAttendanceSummary {
  present_count:   number
  absent_count:    number
  late_count:      number
  excused_count:   number
  makeup_count:    number
  cancelled_count: number
  consumed_count:  number
  total_records:   number
  attendance_pct:  number
}

// ── Package Ledger (v_student_package_ledger) ─────────────────────────────────

export interface PackageLedgerRecord {
  consumption_id:       string
  student_id:           string
  attendance_record_id: string
  enrollment_id:        string
  consumed_at:          string
  attendance_status:    string
  invalidated_at:       string | null
  schedule_id:          string
  session_date:         string
  topic:                string | null
  session_status:       string
  group_id:             string
  group_name:           string
  course_id:            string | null
  course_name:          string | null
  instructor_name:      string | null
  enrolled_sessions:    number
  enrollment_start:     string
  enrollment_status:    string
}

// ── Course History (v_student_course_history) ─────────────────────────────────
// Attendance-first: derives group/course from attendance_records → schedules →
// group_courses → groups/courses. Does NOT rely on student_enrollments.group_id.

export interface StudentCourseTimelineEntry {
  student_id:         string
  group_id:           string
  group_name:         string
  course_id:          string | null
  course_name:        string | null
  instructor_name:    string | null
  enrollment_id:      string | null
  enrolled_sessions:  number | null
  consumed_sessions:  number | null
  remaining_sessions: number | null
  enrollment_status:  string | null
  enrollment_start:   string | null
  first_session_date: string | null
  last_session_date:  string | null
  total_present:      number
  total_absent:       number
  total_late:         number
  total_excused:      number
  total_makeup:       number
  attendance_rate:    number | null
}
