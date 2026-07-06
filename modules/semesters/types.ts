export type SemesterStatus = 'planned' | 'active' | 'completed' | 'archived'
export type EnrollmentStatus = 'enrolled' | 'dropped' | 'completed' | 'paused'
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'waived' | 'overdue'

export const SEMESTER_STATUS_COLORS: Record<SemesterStatus, string> = {
  planned:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  active:    'bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]',
  completed: 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200',
  archived:  'bg-[#F9FAFB] text-[#6B7280] border-[#E2E8F0]',
}

export interface Semester {
  id: string
  org_id: string
  academic_year_id: string
  name: string
  slug: string
  status: SemesterStatus
  start_date: string
  end_date: string
  enrollment_open_at: string | null
  enrollment_close_at: string | null
  max_capacity: number | null
  notes: string | null
  billing_cycle: string | null
  created_at: string
  updated_at: string
  // Joined
  academic_year_name?: string
}

export interface SemesterListItem {
  id: string
  name: string
  slug: string
  status: SemesterStatus
  start_date: string
  end_date: string
  max_capacity: number | null
  academic_year_id: string
  academic_year_name: string
  enrolled_count: number
}

export interface SemesterEnrollment {
  id: string
  semester_id: string
  student_id: string
  branch_id: string
  status: EnrollmentStatus
  enrolled_at: string
  dropped_at: string | null
  completed_at: string | null
  notes: string | null
  payment_status: PaymentStatus
  // Joined
  student_email: string
  first_name: string | null
  last_name: string | null
  branch_name: string
}

export interface SemesterCourse {
  id: string
  semester_id: string
  course_id: string
  created_at: string
  // Joined
  course_title: string
  course_code: string | null
  course_level: string | null
  course_scope: string
}

export interface SemesterGroup {
  id: string
  name: string
  code: string | null
  type: string
  status: string
  capacity: number | null
  branch_id: string
  branch_name: string
}

export interface SemesterDashboard {
  semester: Semester
  enrolled_count: number
  dropped_count: number
  completed_count: number
  group_count: number
  course_count: number
  capacity_pct: number | null
}
