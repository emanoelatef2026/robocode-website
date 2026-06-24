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
  // Schedule
  day_of_week:        string | null
  group_time:         string | null
  // Sessions — enrollment-scoped (NOT group totals)
  enrollment_id:      string | null
  enrolled_sessions:  number   // sessions purchased in active enrollment
  consumed_sessions:  number   // sessions consumed from attendance_consumptions ledger
  remaining_sessions: number   // enrolled − consumed (mirrors DB GENERATED column)
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
  portfolio_projects:    number
  portfolio_reviewed:    number
  // Overall
  overall_pct: number | null
  // Lists
  upcoming_homework: UpcomingHomework[]
  recent_feedback:   RecentFeedbackItem[]
  // ── Gamification (Phase XXXIII) ───────────────────────────────────────────
  total_xp:           number
  current_level:      number
  xp_progress_pct:    number   // 0–100 within current level
  xp_to_next_level:   number   // XP needed to reach next level (0 at max)
  current_streak:     number
  best_streak:        number
  group_rank:         number | null   // 1-based rank within group (null if solo/unknown)
  group_rank_total:   number | null   // total students in group
  is_student_of_week: boolean
  achievement_count:  number
  badge_count:        number
  certificates_count: number
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
  event_type: 'submitted' | 'graded' | 'portfolio' | 'certificate' | 'attended' | 'missed'
  title:      string
  subtitle:   string | null
  date:       string
}

export interface StudentAttendanceRecord {
  session_num: number
  date:        string
  topic:       string | null
  status:      string | null
}

export interface CertificateEligibility {
  is_eligible:        boolean
  consumed_sessions:  number
  enrolled_sessions:  number
  sessions_remaining: number
  group_name:         string | null
  course_title:       string | null
}
