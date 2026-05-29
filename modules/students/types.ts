import type { StudentStatus } from '@/types/enums'

export interface Student {
  id: string
  user_id: string
  branch_id: string
  student_code: string | null
  enrollment_date: string
  status: StudentStatus
  notes: string | null
  school_grade: string | null
  address: string | null
  emergency_contact: Record<string, string>
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  user_email?: string
  first_name?: string
  last_name?: string
  branch_name?: string
  phone?: string | null
  date_of_birth?: string | null
  parent_phone_1?: string | null
  parent_phone_2?: string | null
  group_name?: string | null
}

export interface StudentListItem {
  id: string
  user_id: string
  branch_id: string
  student_code: string | null
  enrollment_date: string
  status: StudentStatus
  school_grade: string | null
  user_email: string
  first_name: string | null
  last_name: string | null
  branch_name: string
  group_name: string | null
  phone: string | null
  parent_phone_1: string | null
  parent_phone_2: string | null
}

export interface CreateStudentInput {
  email: string
  first_name: string
  last_name: string
  branch_id: string
  student_code?: string
  enrollment_date?: string
  notes?: string
  school_grade?: string
  address?: string
  phone?: string
  date_of_birth?: string
  parent_phone_1?: string
  parent_phone_2?: string
  group_id?: string
}

export interface UpdateStudentInput {
  id: string
  status?: StudentStatus
  notes?: string
  student_code?: string
  school_grade?: string
  address?: string
  phone?: string
  date_of_birth?: string
  parent_phone_1?: string
  parent_phone_2?: string
}
