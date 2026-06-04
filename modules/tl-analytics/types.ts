// Types for the Team Leader operational analytics dashboard

export interface TLStudentsOverview {
  total_active:    number
  new_this_month:  number
  inactive:        number
  attendance_avg:  number
  at_risk_count:   number
}

export interface TLGroupHealth {
  group_id:           string
  group_name:         string
  branch_name:        string | null
  student_count:      number
  has_instructor:     boolean
  has_active_course:  boolean
  attendance_avg:     number
  status:             string
}

export interface TLGroupsOverview {
  total_active:      number
  without_instructor: number
  without_course:    number
  low_attendance:    number
  groups:            TLGroupHealth[]
}

export interface TLBranchStat {
  branch_id:       string
  branch_name:     string
  active_students: number
  active_groups:   number
  collection_rate: number
  attendance_avg:  number
  at_risk_count:   number
  leads_new:       number
}

export interface TLLeadsOverview {
  total:               number
  new_this_month:      number
  converted_this_month: number
  conversion_rate_pct: number
  overdue_followups:   number
  avg_days_to_convert: number | null
  by_source:           { source: string; count: number }[]
  by_status:           { status: string; count: number }[]
}

export interface TLAssignmentKPIs {
  total_published:      number
  overdue_count:        number
  avg_completion_pct:   number
  pending_review_count: number
  grading_delay_count:  number
}

export interface TLAssignmentGroupRow {
  group_id:         string
  group_name:       string
  branch_name:      string | null
  assignment_count: number
  submission_count: number
  graded_count:     number
  completion_pct:   number
  overdue_count:    number
}

export interface TLAssignmentInstructorRow {
  instructor_id:     string
  instructor_name:   string
  pending_review:    number
  grading_delay:     number
  assignment_count:  number
  avg_completion_pct: number
}

export interface TLAssignmentOverview {
  kpis:         TLAssignmentKPIs
  by_group:     TLAssignmentGroupRow[]
  by_instructor: TLAssignmentInstructorRow[]
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface OperationalAlert {
  id:          string
  severity:    AlertSeverity
  category:    'finance' | 'attendance' | 'assignments' | 'instructors' | 'leads' | 'groups'
  title:       string
  detail:      string
  count:       number
  action_href: string | null
}
