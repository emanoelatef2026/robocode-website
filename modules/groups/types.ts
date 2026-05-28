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
  metadata: Record<string, unknown>
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  branch_name?: string
  student_count?: number
}

export interface GroupListItem {
  id: string
  branch_id: string
  name: string
  code: string | null
  type: GroupType
  capacity: number | null
  status: GroupStatus
  branch_name: string
  student_count: number
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
  first_name: string | null
  last_name: string | null
}

export interface CreateGroupInput {
  branch_id: string
  name: string
  type: GroupType
  capacity?: number
  code?: string
}

export interface UpdateGroupInput {
  id: string
  name?: string
  type?: GroupType
  status?: GroupStatus
  capacity?: number
  code?: string
}

export interface EnrollStudentInput {
  group_id: string
  student_id: string
  enrollment_type?: 'primary' | 'secondary'
}
