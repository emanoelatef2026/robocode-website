import type { GroupType, GroupStatus, GroupStudentStatus } from '@/types/enums'

export interface Group {
  id: string
  branch_id: string
  semester_id: string | null
  name: string
  code: string | null
  type: GroupType
  capacity: number | null
  waitlist_capacity: number
  status: GroupStatus
  start_date: string | null
  day_of_week: string | null
  time: string | null
  notes: string | null
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  branch_name?: string
  student_count?: number
  instructor_name?: string | null
}

export interface GroupListItem {
  id: string
  branch_id: string
  name: string
  code: string | null
  type: GroupType
  capacity: number | null
  status: GroupStatus
  start_date: string | null
  day_of_week: string | null
  time: string | null
  branch_name: string
  student_count: number
  instructor_name: string | null
}

export interface GroupEnrollment {
  id: string
  group_id: string
  student_id: string
  enrollment_type: 'primary' | 'secondary'
  status: GroupStudentStatus
  joined_at: string
  left_at: string | null
  notes: string | null
  student_email: string
  student_code: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  parent_phone_1: string | null
  parent_phone_2: string | null
}

export interface CreateGroupInput {
  branch_id: string
  name: string
  type: GroupType
  capacity?: number
  code?: string
  start_date?: string
  day_of_week?: string
  time?: string
  notes?: string
  instructor_id?: string
}

export interface UpdateGroupInput {
  id: string
  name?: string
  type?: GroupType
  status?: GroupStatus
  capacity?: number
  code?: string
  start_date?: string
  day_of_week?: string
  time?: string
  notes?: string
}

export interface EnrollStudentInput {
  group_id: string
  student_id: string
  enrollment_type?: 'primary' | 'secondary'
}

export interface GroupScheduleItem {
  id:               string
  group_course_id:  string
  scheduled_at:     string
  duration_minutes: number
  type:             string
  delivery:         string | null
  status:           string
  topic:            string | null
  meeting_url:      string | null
  room:             string | null
}

export interface GroupAcademicConfig {
  group_id:              string
  group_course_id:       string | null
  course_id:             string | null
  course_title:          string | null
  // course_module_id = the specific semester (course_modules row) this group is studying
  course_module_id:      string | null
  course_module_title:   string | null
  semester_id:           string | null
  semester_name:         string | null
  instructor_id:         string | null
  instructor_name:       string | null
}
