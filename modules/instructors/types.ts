import type { InstructorStatus } from '@/types/enums'

// ─── Original types (kept for backward compatibility) ─────────────────────────

export interface Instructor {
  id: string
  user_id: string
  branch_id: string
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  payment_link: string | null
  wallet_number: string | null
  bank_account_number: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  user_email?: string
  first_name?: string
  last_name?: string
  branch_name?: string
  phone?: string | null
}

export interface InstructorListItem {
  id: string
  user_id: string
  branch_id: string
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  user_email: string
  first_name: string | null
  last_name: string | null
  branch_name: string
  phone: string | null
  group_count: number
}

export interface CreateInstructorInput {
  email: string
  first_name: string
  last_name: string
  branch_id: string
  employee_id?: string
  hire_date?: string
  specializations?: string[]
}

export interface UpdateInstructorInput {
  id: string
  status?: InstructorStatus
  employee_id?: string
  specializations?: string[]
  phone?: string
  payment_link?: string
  wallet_number?: string
  bank_account_number?: string
}

// ─── Operational types (new — used by Instructor Operations Center) ───────────

export interface InstructorOperationalRow {
  id: string
  user_id: string
  branch_id: string
  branch_name: string
  branch_ids: string[]
  branch_names: string[]
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  user_email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  salary_per_session: number | null
  created_at: string
  // Computed
  group_count: number
  student_count: number
  health_score: number
  attendance_compliance: number
  today_sessions_count: number
}

export interface FullInstructor {
  id: string
  user_id: string
  branch_id: string
  branch_name: string
  branch_ids: string[]
  branch_names: string[]
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  user_email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  alt_phone: string | null
  bio: string | null
  instagram_url: string | null
  facebook_url: string | null
  whatsapp_number: string | null
  salary_per_session: number | null
  currency: string
  wallet_number: string | null
  instapay_number: string | null
  payment_notes: string | null
  working_days: string[]
  max_weekly_load: number | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface InstructorGroupDetail {
  id: string
  name: string
  code: string | null
  type: string
  status: string
  branch_id: string
  branch_name: string
  course_id: string | null
  course_name: string | null
  student_count: number
  capacity: number
  sessions_done: number
  total_sessions: number
  attendance_rate: number
  role: 'lead' | 'assistant'
  health: 'excellent' | 'good' | 'warning' | 'critical'
}

export interface InstructorStudentRow {
  student_id: string
  first_name: string | null
  last_name: string | null
  user_email: string
  group_id: string
  group_name: string
  attendance_rate: number
  remaining_sessions: number | null
  balance: number
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface InstructorAttendanceStats {
  total_sessions: number
  sessions_completed: number
  sessions_with_attendance: number
  compliance_rate: number
  sessions_missing_attendance: number
}

export interface InstructorPerformanceMetrics {
  health_score: number
  health_label: 'Excellent' | 'Good' | 'Warning' | 'Critical'
  attendance_compliance: number
  active_groups: number
  total_students: number
  low_attendance_groups: number
  at_risk_students: number
  group_count: number
}

export interface InstructorSessionRow {
  id: string
  group_course_id: string
  group_id: string
  group_name: string
  course_name: string | null
  scheduled_at: string
  duration_minutes: number
  status: string
  topic: string | null
  attendance_submitted: boolean
  student_count: number
}

export interface InstructorFinanceSummary {
  total_revenue: number
  students_with_balance: number
  students_overdue: number
  total_outstanding: number
  active_contracts: number
}

export interface InstructorNote {
  id: string
  content: string
  category: string
  author_id: string
  author_name: string | null
  created_at: string
  updated_at: string
}

export interface InstructorCertification {
  id: string
  instructor_id: string
  certification: string
  level: string | null
  status: string
  issued_at: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InstructorDetailData {
  instructor: FullInstructor
  groups: InstructorGroupDetail[]
  sessions: InstructorSessionRow[]
  students: InstructorStudentRow[]
  attendance_stats: InstructorAttendanceStats
  performance: InstructorPerformanceMetrics
  finance: InstructorFinanceSummary
  notes: InstructorNote[]
  certifications: InstructorCertification[]
}

export interface InstructorFormOptions {
  branches: Array<{ id: string; name: string }>
  groups: Array<{
    id: string
    name: string
    code: string | null
    branch_id: string
    branch_name: string
    status: string
    student_count: number
    has_instructor: boolean
    completed_sessions: number
    total_sessions: number
    next_from_session: number   // canonical start for the next instructor assignment (MAX to_session + 1)
  }>
}
