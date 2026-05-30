export interface InstructorRecord {
  id:         string
  user_id:    string
  branch_id:  string
  email:      string
  first_name: string | null
  last_name:  string | null
}

export interface InstructorGroup {
  group_id:           string
  group_name:         string
  group_code:         string | null
  group_course_id:    string
  course_id:          string
  course_title:       string
  branch_name:        string
  student_count:      number
  next_session_at:    string | null
  semester_id:        string | null
  semester_name:      string | null
  completed_sessions: number
  total_sessions:     number
}

export interface InstructorSession {
  id:               string
  group_course_id:  string
  group_id?:        string
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

export interface TodayAction {
  type:   'start_session' | 'complete_attendance' | 'add_notes' | 'review_homework'
  label:  string
  detail: string
  href:   string
}

export interface StudentAttentionItem {
  student_id:    string
  student_name:  string
  group_id:      string
  group_name:    string
  absence_count: number
  reason:        string
  href:          string
}

export interface SessionAttendanceRow {
  record_id:    string | null
  student_id:   string
  student_name: string
  status:       string | null
  late_minutes: number | null
  notes:        string | null
}

export interface SessionRecording {
  id:                  string
  title:               string | null
  provider:            string
  external_url:        string
  visible_to_students: boolean
  visible_to_parents:  boolean
  created_at:          string
}

export interface ResourceLink {
  title: string
  url:   string
}

export interface SessionProgressItem {
  id:          string
  scheduled_at: string
  status:      string
  topic:       string | null
  session_num: number
}

export interface CourseModuleItem {
  id:    string
  title: string
}

export interface SessionDetail {
  id:               string
  group_course_id:  string
  group_id:         string
  branch_id:        string
  scheduled_at:     string
  started_at:       string | null
  ended_at:         string | null
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
  course_id:        string
  attendance:       SessionAttendanceRow[]
  student_count:    number
  recordings:       SessionRecording[]
  resources_links:  ResourceLink[]
  course_modules:   CourseModuleItem[]
  progress:         SessionProgressItem[]
  current_session_num: number
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
  branch_name:     string
  semester_id:     string | null
  day_of_week:     string | null
  time:            string | null
  completed_sessions: number
  total_sessions:     number
  students: Array<{
    student_id:      string
    first_name:      string | null
    last_name:       string | null
    email:           string
    enrollment_type: 'primary' | 'secondary'
  }>
  sessions: InstructorSession[]
}
