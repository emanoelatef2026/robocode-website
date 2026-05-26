import type { SubmissionStatus } from '@/types/enums'

export type { SubmissionStatus }

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  content: string | null
  file_keys: string[]
  submission_type: string | null
  drive_url: string | null
  github_url: string | null
  project_url: string | null
  video_url: string | null
  image_urls: string[]
  score: number | null
  graded_by: string | null
  graded_at: string | null
  feedback: string | null
  public_feedback: string | null
  rubric_scores: Record<string, number>
  status: SubmissionStatus
  resubmission_count: number
  is_late: boolean
  portfolio_visible: boolean
  ai_score: number | null
  ai_feedback: string | null
  created_at: string
  updated_at: string
  // joined
  student_email: string
  student_name: string
  assignment_title?: string
}

export interface SubmissionListItem {
  id: string
  assignment_id: string
  student_id: string
  submitted_at: string
  status: SubmissionStatus
  score: number | null
  is_late: boolean
  resubmission_count: number
  student_email: string
  student_name: string
}
