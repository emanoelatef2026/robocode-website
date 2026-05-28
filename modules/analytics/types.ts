export interface AtRiskStudent {
  student_id:            string
  student_name:          string
  student_email:         string
  group_id:              string
  group_name:            string
  course_id:             string
  course_title:          string
  semester_id:           string
  semester_name:         string
  completion_percentage: number
  attendance_score:      number
  assignment_score:      number
  portfolio_score:       number
  last_calculated_at:    string
  risk_reasons:          Array<'low_completion' | 'low_attendance'>
}

export type CertReadinessStatus = 'ready' | 'almost_ready' | 'not_ready'

export interface StudentCertReadiness {
  student_id:        string
  student_name:      string
  student_email:     string
  semester_id:       string
  semester_name:     string
  avg_attendance:    number
  avg_assignment:    number
  avg_portfolio:     number
  avg_completion:    number
  courses_evaluated: number
  status:            CertReadinessStatus
  failed_thresholds: string[]
}

export interface MissingAssignmentsStudent {
  student_id:     string
  student_name:   string
  student_email:  string
  missing_count:  number
  overdue_count:  number
}

export interface GroupPerformance {
  group_id:       string
  group_name:     string
  branch_name:    string | null
  student_count:  number
  avg_completion: number
  avg_attendance: number
  avg_assignment: number
}

export interface CoursePerformance {
  course_id:      string
  course_title:   string
  student_count:  number
  avg_completion: number
  avg_attendance: number
  avg_assignment: number
}

export interface SemesterOverview {
  semester_id:        string
  semester_name:      string
  total_students:     number
  active_students:    number
  completed_students: number
  failed_students:    number
  avg_attendance:     number
  avg_assignment:     number
  avg_portfolio:      number
  avg_completion:     number
}

export interface SemesterListItem {
  id:   string
  name: string
}
