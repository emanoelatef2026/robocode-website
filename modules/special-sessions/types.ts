import type { ScheduleStatus } from '@/types/enums'

// ── Trial Sessions ─────────────────────────────────────────────────────────────

export interface TrialSession {
  id:               string
  branch_id:        string
  branch_name:      string
  instructor_id:    string | null
  instructor_name:  string | null
  scheduled_at:     string
  duration_minutes: number
  course_name:      string | null    // optional course context
  notes:            string | null
  status:           ScheduleStatus
  created_by:       string | null
  created_at:       string
  students:         TrialSessionStudent[]
}

export interface TrialSessionStudent {
  id:                string
  schedule_id:       string
  lead_id:           string | null
  student_name:      string
  student_phone:     string | null
  parent_phone:      string | null
  notes:             string | null
  attendance_status: 'present' | 'absent' | null
  created_at:        string
}

export interface CreateTrialSessionInput {
  branch_id:        string
  instructor_id:    string
  scheduled_at:     string
  duration_minutes: number
  course_name?:     string | null
  notes?:           string | null
}

export interface AddTrialStudentFromLeadInput {
  schedule_id: string
  lead_id:     string
}

export interface AddTrialStudentNewInput {
  schedule_id:   string
  student_name:  string
  student_phone: string | null
  parent_phone:  string
  notes:         string | null
}

// ── Standalone Makeup Sessions ────────────────────────────────────────────────

export type MakeupMode = 'EXTRA' | 'REPLACE_MISSED'

export interface MakeupSession {
  id:               string
  branch_id:        string
  branch_name:      string
  instructor_id:    string | null
  instructor_name:  string | null
  scheduled_at:     string
  duration_minutes: number
  notes:            string | null
  status:           ScheduleStatus
  created_by:       string | null
  created_at:       string
  students:         MakeupSessionStudent[]
}

export interface MakeupSessionStudent {
  id:                   string
  schedule_id:          string
  student_id:           string
  student_name:         string
  mode:                 MakeupMode
  replaced_session_id:  string | null
  replaced_session_num: number | null
  attendance_status:    'present' | 'absent' | 'late' | null
  created_at:           string
}

export interface CreateMakeupSessionInput {
  branch_id:        string
  instructor_id:    string
  scheduled_at:     string
  duration_minutes: number
  notes?:           string | null
}

export interface AddMakeupStudentInput {
  schedule_id:          string
  student_id:           string
  mode:                 MakeupMode
  replaced_session_id?: string | null
}

// ── Shared list item for dashboard / calendar ──────────────────────────────────

export interface SpecialSessionListItem {
  id:               string
  type:             'trial' | 'makeup'
  branch_id:        string
  branch_name:      string
  instructor_name:  string | null
  scheduled_at:     string
  duration_minutes: number
  status:           ScheduleStatus
  participant_count: number
}
