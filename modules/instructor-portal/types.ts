export interface InstructorRecord {
  id:         string
  user_id:    string
  branch_id:  string
  email:      string
  first_name: string | null
  last_name:  string | null
}

export interface InstructorGroup {
  group_id:        string
  group_name:      string
  group_code:      string | null
  group_course_id: string
  course_id:       string
  course_title:    string
  student_count:   number
  next_session_at: string | null
  semester_id:     string | null
}

export interface InstructorSession {
  id:               string
  group_course_id:  string
  group_name:       string
  course_title:     string
  scheduled_at:     string
  duration_minutes: number
  type:             string
  delivery:         string | null
  status:           string
  topic:            string | null
  notes:            string | null
  attendance_count: number | null
}

export interface SessionAttendanceRow {
  record_id:   string | null
  student_id:  string
  student_name: string
  status:      string | null
  late_minutes: number | null
  notes:       string | null
}

export interface SessionDetail {
  id:               string
  group_course_id:  string
  group_id:         string
  branch_id:        string
  scheduled_at:     string
  duration_minutes: number
  type:             string
  delivery:         string | null
  meeting_url:      string | null
  room:             string | null
  status:           string
  topic:            string | null
  notes:            string | null
  group_name:       string
  course_title:     string
  attendance:       SessionAttendanceRow[]
  student_count:    number
}

export interface PendingSubmissionItem {
  submission_id:      string
  assignment_id:      string
  assignment_title:   string
  course_title:       string | null
  group_name:         string | null
  student_id:         string
  student_name:       string
  submitted_at:       string
  status:             string
  is_late:            boolean
  resubmission_count: number
}

export interface StudentNote {
  id:             string
  content:        string
  is_private:     boolean
  schedule_id:    string | null
  schedule_topic: string | null
  created_at:     string
  updated_at:     string
}

export interface StudentProfileForInstructor {
  student_id:   string
  user_id:      string
  first_name:   string | null
  last_name:    string | null
  email:        string
  group_id:     string
  group_name:   string
  attendance_total:   number
  attendance_present: number
  attendance_absent:  number
  attendance_late:    number
  notes:        StudentNote[]
}

export interface InstructorDashboardStats {
  groupCount:       number
  studentCount:     number
  upcomingSessions: number
  pendingReviews:   number
}

export interface GroupForInstructor {
  group_id:        string
  group_course_id: string
  group_name:      string
  course_title:    string
  branch_id:       string
  semester_id:     string | null
  students: Array<{
    student_id:  string
    first_name:  string | null
    last_name:   string | null
    email:       string
  }>
  sessions: InstructorSession[]
}
