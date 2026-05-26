import type { BranchType } from '@/types/enums'

export interface Branch {
  id: string
  name: string
  slug: string
  type: BranchType
  phone: string | null
  location: string | null
  timezone: string
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BranchListItem {
  id: string
  name: string
  slug: string
  type: BranchType
  phone: string | null
  location: string | null
  is_active: boolean
  created_at: string
  student_count?: number
}

export interface CreateBranchInput {
  name: string
  type: BranchType
  phone?: string
  location?: string
  timezone?: string
}

export interface UpdateBranchInput {
  id: string
  name?: string
  type?: BranchType
  phone?: string
  location?: string
  timezone?: string
  is_active?: boolean
}
