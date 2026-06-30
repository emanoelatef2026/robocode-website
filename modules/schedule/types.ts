import type { ScheduleStatus, ScheduleDelivery } from '@/types/enums'

export type { ScheduleStatus, ScheduleDelivery }

export type ScheduleType = 'regular' | 'makeup' | 'exam' | 'event' | 'trial'

// ─── Core entity ─────────────────────────────────────────────────────────────

export interface Schedule {
  id:                  string
  group_course_id:     string | null   // null for standalone trial/makeup sessions
  branch_id:           string
  scheduled_at:        string
  duration_minutes:    number
  type:                ScheduleType
  delivery:            ScheduleDelivery | null
  meeting_url:         string | null
  room:                string | null
  status:              ScheduleStatus
  cancellation_reason: string | null
  topic:               string | null   // what was covered in this session
  notes:               string | null   // instructor post-session notes (not visible to students)
  created_by:          string | null
  created_at:          string
  updated_at:          string
}

// ─── List view (enriched with joined context) ─────────────────────────────────

export interface ScheduleListItem {
  id:               string
  group_course_id:  string | null
  branch_id:        string
  scheduled_at:     string
  duration_minutes: number
  type:             ScheduleType
  delivery:         ScheduleDelivery | null
  meeting_url:      string | null
  room:             string | null
  status:           ScheduleStatus
  topic:            string | null
  // joined
  group_name:       string
  course_title:     string
  instructor_name:  string | null
  branch_name:      string
  attendance_count: number | null  // how many attendance records exist for this session
}

// ─── Detail view ─────────────────────────────────────────────────────────────

export interface ScheduleDetail extends Schedule {
  group_name:      string
  course_title:    string
  branch_name:     string
  instructor_name: string | null
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateScheduleInput {
  group_course_id:  string | null
  branch_id:        string
  scheduled_at:     string          // ISO timestamp
  duration_minutes: number
  type:             ScheduleType
  delivery?:        ScheduleDelivery | null
  meeting_url?:     string | null
  room?:            string | null
  topic?:           string | null
}

export interface UpdateScheduleInput {
  scheduled_at?:       string
  duration_minutes?:   number
  type?:               ScheduleType
  delivery?:           ScheduleDelivery | null
  meeting_url?:        string | null
  room?:               string | null
  status?:             ScheduleStatus
  cancellation_reason?: string | null
  topic?:              string | null
  notes?:              string | null
}
