// Shared constants — no 'server-only', safe for client components

export type MessageStatus   = 'submitted' | 'under_review' | 'resolved'
export type MessageCategory =
  | 'general_comment' | 'suggestion' | 'academic_concern'
  | 'instructor_feedback' | 'schedule_request' | 'technical_issue' | 'other'

export const CATEGORY_LABELS: Record<MessageCategory, string> = {
  general_comment:     'General Comment',
  suggestion:          'Suggestion',
  academic_concern:    'Academic Concern',
  instructor_feedback: 'Instructor Feedback',
  schedule_request:    'Schedule Request',
  technical_issue:     'Technical Issue',
  other:               'Other',
}

export const STATUS_CONFIG: Record<MessageStatus, { label: string; cls: string }> = {
  submitted:    { label: 'Submitted',    cls: 'bg-yellow-100 text-yellow-700' },
  under_review: { label: 'Under Review', cls: 'bg-blue-100   text-blue-700'   },
  resolved:     { label: 'Resolved',     cls: 'bg-green-100  text-green-700'  },
}
