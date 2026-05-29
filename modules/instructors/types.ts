import type { InstructorStatus } from '@/types/enums'

export interface Instructor {
  id: string
  user_id: string
  branch_id: string
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  payment_link: string | null
  wallet_number: string | null
  bank_account_number: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // Joined
  user_email?: string
  first_name?: string
  last_name?: string
  branch_name?: string
  phone?: string | null
}

export interface InstructorListItem {
  id: string
  user_id: string
  branch_id: string
  employee_id: string | null
  hire_date: string | null
  instructor_code: string | null
  status: InstructorStatus
  specializations: string[]
  user_email: string
  first_name: string | null
  last_name: string | null
  branch_name: string
  phone: string | null
  group_count: number
}

export interface CreateInstructorInput {
  email: string
  first_name: string
  last_name: string
  branch_id: string
  employee_id?: string
  hire_date?: string
  specializations?: string[]
}

export interface UpdateInstructorInput {
  id: string
  status?: InstructorStatus
  employee_id?: string
  specializations?: string[]
  phone?: string
  payment_link?: string
  wallet_number?: string
  bank_account_number?: string
}
