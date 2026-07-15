export type NotificationType =
  | 'SESSION_STARTING'
  | 'NEW_STUDENT'
  | 'HOMEWORK_NEEDS_GRADING'
  | 'TEAM_LEADER_NOTE'
  | 'STUDENT_PROJECT'
  | 'STUDENT_VIDEO'
  | 'ANNOUNCEMENT'
  | 'TRIAL_SESSION_ASSIGNED'
  | 'MAKEUP_SESSION_ASSIGNED'
  | 'TRIAL_SESSION_REMINDER'
  // Student domain (Sprint 2)
  | 'EVALUATION_PUBLISHED'
  | 'STUDENT_NOTE_SHARED'
  | 'PARENT_NOTE_SHARED'
  | 'ACHIEVEMENT_EARNED'
  | 'COMPETITION_RESULT'

export interface Notification {
  id:           string
  type:         NotificationType
  title:        string
  body:         string | null
  href:         string | null
  created_at:   string
  is_read:      boolean
}

export interface NotificationFeed {
  notifications: Notification[]
  unread_count:  number
}
