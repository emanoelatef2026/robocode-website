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
