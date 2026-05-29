import type { ParentRelationship } from '@/types/enums'

export interface Parent {
  id: string
  user_id: string
  created_at: string
  // Joined
  user_email?: string
  first_name?: string
  last_name?: string
  // Children
  children?: ParentChild[]
}

export interface ParentListItem {
  id: string
  user_id: string
  created_at: string
  user_email: string
  first_name: string | null
  last_name: string | null
  children_count: number
  phone: string | null
}

export interface ParentChild {
  student_id: string
  relationship: ParentRelationship
  is_primary: boolean
  student_first_name: string | null
  student_last_name: string | null
  student_email: string
  branch_name: string
}

export interface CreateParentInput {
  email: string
  first_name: string
  last_name: string
  student_id?: string
  relationship?: ParentRelationship
}

export interface LinkStudentInput {
  parent_id: string
  student_id: string
  relationship: ParentRelationship
  is_primary: boolean
}
