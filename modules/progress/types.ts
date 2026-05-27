// Progress calculation tuple — the four-key identity for one progress row
export interface ProgressTuple {
  studentId:  string
  courseId:   string
  semesterId: string
  groupId:    string
}

// Group context without studentId — used for batch builds
export interface GroupProgressContext {
  courseId:   string
  semesterId: string
  groupId:    string
}

export interface StudentCourseProgress {
  id: string
  student_id: string
  course_id: string
  semester_id: string
  group_id: string
  attendance_score: number
  assignment_score: number
  portfolio_score: number
  completion_percentage: number
  status: 'active' | 'completed' | 'failed'
  last_calculated_at: string
  created_at: string
  updated_at: string
  // joined fields
  course_title?: string
  semester_name?: string
  group_name?: string
}

export interface ProgressSummary {
  student_id: string
  student_name: string
  student_email: string
  courses: StudentCourseProgress[]
  overall_percentage: number
}

export interface CertificateThresholds {
  min_attendance: number
  min_assignment: number
  min_overall: number
}

export interface CertificateEligibilityResult {
  student_id: string
  semester_id: string
  is_eligible: boolean
  overall_percentage: number
  attendance_score: number
  assignment_score: number
  portfolio_score: number
  courses_evaluated: number
  failed_thresholds: string[]
  thresholds: CertificateThresholds
}
