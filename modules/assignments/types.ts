import type { AssignmentType, AssignmentSubmissionType, AssignmentStatus, SubmissionStatus } from '@/types/enums'

export type { AssignmentType, AssignmentSubmissionType, AssignmentStatus, SubmissionStatus }

export interface RubricCriteria {
  id: string
  label: string
  description?: string
  max_points: number
}

export interface Assignment {
  id: string
  lesson_id: string | null
  module_id: string | null
  title: string
  description: string | null
  instructions: string | null
  type: AssignmentType
  submission_type: AssignmentSubmissionType
  max_score: number
  due_at: string | null
  status: AssignmentStatus
  allow_late: boolean
  rubric: RubricCriteria[]
  resubmission_allowed: boolean
  max_resubmissions: number
  portfolio_eligible: boolean
  ai_grading_enabled: boolean
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  // joined
  lesson_title: string | null
  module_title: string | null
  course_title: string | null
  submission_count: number
}

export interface AssignmentListItem {
  id: string
  title: string
  type: AssignmentType
  submission_type: AssignmentSubmissionType
  status: AssignmentStatus
  due_at: string | null
  max_score: number
  lesson_id: string | null
  module_id: string | null
  lesson_title: string | null
  module_title: string | null
  course_title: string | null
  submission_count: number
  created_at: string
}

export interface ModuleForSelect {
  id: string
  title: string
  course_id: string
  course_title: string
}
