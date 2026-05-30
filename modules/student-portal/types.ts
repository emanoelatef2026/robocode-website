// ─── Comprehensive dashboard payload ─────────────────────────────────────────

export interface UpcomingHomework {
  id:      string
  title:   string
  due_at:  string | null
  type:    string
}

export interface StudentDashboardData {
  student_id:         string
  student_name:       string
  group_id:           string | null
  group_name:         string | null
  course_title:       string | null
  instructor_name:    string | null
  // Sessions
  completed_sessions: number
  total_sessions:     number
  // Attendance
  att_present:        number
  att_absent:         number
  att_late:           number
  att_total:          number
  att_pct:            number
  // Assignments
  assignments_total:     number
  assignments_submitted: number
  assignments_graded:    number
  assignments_avg_score: number | null
  // Portfolio
  portfolio_projects: number
  // Overall
  overall_pct: number | null
  // Lists
  upcoming_homework: UpcomingHomework[]
  recent_feedback:   RecentFeedbackItem[]
}

// ─── Legacy granular types (kept for sub-pages) ───────────────────────────────

export interface StudentEnrollment {
  student_id:      string
  group_id:        string | null
  group_name:      string | null
  course_title:    string | null
  instructor_name: string | null
}

export interface StudentProgressStats {
  attendance_pct: number | null
  assignment_pct: number | null
  portfolio_pct:  number | null
  progress_pct:   number | null
}

export interface RecentFeedbackItem {
  submission_id:    string
  assignment_title: string
  max_score:        number | null
  score:            number | null
  public_feedback:  string
  submitted_at:     string
}

export interface TimelineEvent {
  id:         string
  event_type: 'submitted' | 'graded' | 'portfolio' | 'certificate'
  title:      string
  subtitle:   string | null
  date:       string
}
