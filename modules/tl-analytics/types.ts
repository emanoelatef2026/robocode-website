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

// ── Academic Oversight: shared shape for "students needing attention" lists ────
// Used by evaluation and notes oversight — a student is either 'missing'
// (zero records ever) or 'overdue' (has records, but none within the recency
// window). Reused as-is rather than declaring near-identical types twice.

export interface TLStudentCoverageGap {
  student_id:       string
  student_name:     string
  group_id:         string | null
  group_name:       string | null
  status:           'missing' | 'overdue'
  last_activity_at: string | null
}

// ── Evaluation Oversight ────────────────────────────────────────────────────

export interface TLEvaluationKPIs {
  total_active_students:    number
  evaluated_recent_count:   number
  completion_pct:           number
  missing_count:            number
  overdue_count:            number
  recent_evaluations_count: number
}

export interface TLEvaluationGroupRow {
  group_id:         string
  group_name:       string
  branch_name:      string | null
  student_count:    number
  evaluated_count:  number
  completion_pct:   number
}

export interface TLEvaluationInstructorRow {
  instructor_id:    string
  instructor_name:  string
  student_count:    number
  evaluated_count:  number
  completion_pct:   number
}

export interface TLEvaluationActivityItem {
  id:            string
  student_id:    string
  student_name:  string
  criterion:     string
  author_name:   string
  evaluated_at:  string
}

export interface TLEvaluationOverview {
  kpis:             TLEvaluationKPIs
  by_group:         TLEvaluationGroupRow[]
  by_instructor:    TLEvaluationInstructorRow[]
  students_missing: TLStudentCoverageGap[]
  recent_activity:  TLEvaluationActivityItem[]
}

// ── Student Notes Oversight ─────────────────────────────────────────────────
// Note content is intentionally never surfaced by these aggregate views — only
// existence/category/severity/timing — so PRIVATE_INSTRUCTOR-authored notes
// stay content-private while still counting toward coverage signals.

export interface TLNotesKPIs {
  total_active_students: number
  noted_recent_count:    number
  completion_pct:        number
  missing_count:         number
  overdue_count:         number
  recent_notes_count:    number
}

export interface TLNotesGroupRow {
  group_id:       string
  group_name:     string
  branch_name:    string | null
  student_count:  number
  noted_count:    number
  completion_pct: number
}

export interface TLNotesInstructorRow {
  instructor_id:    string
  instructor_name:  string
  student_count:    number
  noted_count:      number
  completion_pct:   number
}

export interface TLNoteActivityItem {
  id:            string
  student_id:    string
  student_name:  string
  category:      string
  severity:      string
  author_name:   string
  created_at:    string
}

export interface TLNotesOverview {
  kpis:             TLNotesKPIs
  by_group:         TLNotesGroupRow[]
  by_instructor:    TLNotesInstructorRow[]
  students_missing: TLStudentCoverageGap[]
  recent_activity:  TLNoteActivityItem[]
}

// ── Competition Oversight (visibility only — no status/registration concept
// exists in the schema, so "participation" = ever having a recorded result) ──

export interface TLCompetitionKPIs {
  total_active_students: number
  participating_count:   number
  participation_pct:     number
  winners_count:         number
  recent_count:          number
}

export interface TLCompetitionGroupRow {
  group_id:             string
  group_name:           string
  branch_name:          string | null
  student_count:        number
  participating_count:  number
  participation_pct:    number
}

export interface TLCompetitionInstructorRow {
  instructor_id:        string
  instructor_name:      string
  student_count:        number
  participating_count:  number
  participation_pct:    number
}

export interface TLCompetitionActivityItem {
  id:                string
  student_id:        string
  student_name:      string
  competition_name:  string
  year:              number
  rank:              string | null
  award:             string | null
  created_at:        string
}

export interface TLCompetitionOverview {
  kpis:            TLCompetitionKPIs
  by_group:        TLCompetitionGroupRow[]
  by_instructor:   TLCompetitionInstructorRow[]
  winners:         TLCompetitionActivityItem[]
  recent_activity: TLCompetitionActivityItem[]
}

// ── Compact cross-domain Academic Overview (dashboard composite) ───────────

export interface TLAcademicOverviewKPIs {
  evaluation_completion_pct:       number
  notes_completion_pct:            number
  homework_completion_pct:         number
  competition_participation_pct:   number
  students_missing_evaluation:     number
  students_missing_notes:          number
  groups_requiring_attention:      number
  instructors_requiring_attention: number
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
