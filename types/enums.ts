// Shared enums — mirror database CHECK constraints exactly

export type BranchType = 'online' | 'offline' | 'hybrid'

export type UserStatus = 'active' | 'inactive'

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'paused' | 'banned'

export type InstructorStatus = 'active' | 'inactive' | 'on_leave'

export type GroupType = 'class' | 'workshop' | 'bootcamp' | 'trial' | 'makeup'

export type GroupStatus = 'forming' | 'active' | 'completed' | 'cancelled'

export type GroupStudentStatus = 'active' | 'dropped' | 'graduated' | 'paused' | 'waitlisted'

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'

export type CourseScope = 'branch' | 'template' | 'global'

export type LessonType = 'video' | 'text' | 'live' | 'quiz' | 'mixed'

export type ScheduleStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

export type ScheduleDelivery = 'online' | 'offline' | 'hybrid'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

export type AssignmentType =
  | 'homework'
  | 'classwork'
  | 'project'
  | 'quiz'
  | 'exam'
  | 'presentation'
  | 'challenge'
  | 'competition'

export type AssignmentSubmissionType =
  | 'text'
  | 'file'
  | 'image'
  | 'video_link'
  | 'drive_link'
  | 'github_link'
  | 'url'
  | 'multiple'

export type AssignmentStatus = 'draft' | 'published' | 'closed'

export type SubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'graded'
  | 'returned'
  | 'resubmission_requested'
  | 'resubmitted'

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled' | 'overdue'

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online' | 'other'

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push'

export type ParentRelationship = 'father' | 'mother' | 'guardian' | 'other'

export type MediaBucket =
  | 'avatars'
  | 'course-resources'
  | 'lesson-videos'
  | 'submissions'
  | 'thumbnails'
  | 'session-recordings'
  | 'branch-assets'

export type AnalyticsSnapshotType = 'daily' | 'weekly' | 'monthly'

export type AnalyticsEntityType = 'branch' | 'group' | 'instructor' | 'student' | 'course'

// Role names — must match the roles.name column in DB
export type RoleName =
  | 'super_admin'
  | 'team_leader'
  | 'instructor'
  | 'student'
  | 'parent'

// The portal URL prefix each role maps to
export const ROLE_PORTAL_MAP: Record<RoleName, string> = {
  super_admin:  '/admin',
  team_leader:  '/portal/team-leader',
  instructor:   '/portal/instructor',
  student:      '/portal/student',
  parent:       '/portal/parent',
}
