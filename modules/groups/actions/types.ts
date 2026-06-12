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
  account_id:          string | null
  enrollment_id:       string | null
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
