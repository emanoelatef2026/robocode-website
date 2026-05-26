import type { StudentStatus } from '@/types/enums'

export interface Student {
  id: string
  user_id: string
  branch_id: string
  student_code: string | null
  enrollment_date: string
  status: StudentStatus
  notes: string | null
  emergency_contact: Record<string, string>
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  user_email?: string
  first_name?: string
  last_name?: string
  branch_name?: string
}

export interface StudentListItem {
  id: string
  user_id: string
  branch_id: string
  student_code: string | null
  enrollment_date: string
  status: StudentStatus
  user_email: string
  first_name: string | null
  last_name: string | null
  branch_name: string
}

export interface CreateStudentInput {
  email: string
  first_name: string
  last_name: string
  branch_id: string
  student_code?: string
  enrollment_date?: string
  notes?: string
}

export interface UpdateStudentInput {
  id: string
  status?: StudentStatus
  notes?: string
  student_code?: string
}
