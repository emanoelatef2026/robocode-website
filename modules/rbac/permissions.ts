import type { PermissionName } from './types'
import type { RoleName } from '@/types/enums'

// Canonical permission constants — use these, never raw strings
export const PERMISSIONS = {
  // System
  MANAGE_SYSTEM:        'manage_system',
  MANAGE_PERMISSIONS:   'manage_permissions',
  // Organization
  MANAGE_BRANCHES:      'manage_branches',
  READ_BRANCHES:        'read_branches',
  MANAGE_SETTINGS:      'manage_settings',
  // Users
  MANAGE_USERS:         'manage_users',
  MANAGE_STUDENTS:      'manage_students',
  MANAGE_INSTRUCTORS:   'manage_instructors',
  MANAGE_PARENTS:       'manage_parents',
  // Academic
  MANAGE_GROUPS:        'manage_groups',
  MANAGE_COURSES:       'manage_courses',
  MANAGE_MODULES:       'manage_modules',
  MANAGE_LESSONS:       'manage_lessons',
  MANAGE_SCHEDULE:      'manage_schedule',
  MANAGE_ATTENDANCE:    'manage_attendance',
  READ_ATTENDANCE:      'read_attendance',
  MANAGE_ASSIGNMENTS:   'manage_assignments',
  GRADE_ASSIGNMENTS:    'grade_assignments',
  READ_GRADES:          'read_grades',
  MANAGE_QUIZZES:       'manage_quizzes',
  MANAGE_CURRICULUM:    'manage_curriculum',
  // Financials
  MANAGE_FINANCIALS:    'manage_financials',
  READ_FINANCIALS:      'read_financials',
  // Analytics
  READ_ANALYTICS:       'read_analytics',
  EXPORT_ANALYTICS:     'export_analytics',
  // Communication
  SEND_ANNOUNCEMENTS:   'send_announcements',
  SEND_NOTIFICATIONS:   'send_notifications',
  MANAGE_FEEDBACK:      'manage_feedback',
  // Content
  MANAGE_MEDIA:         'manage_media',
  READ_MEDIA:           'read_media',
  // Audit
  READ_AUDIT_LOGS:      'read_audit_logs',
  // AI
  MANAGE_AI_AGENTS:     'manage_ai_agents',
  READ_AI_REPORTS:      'read_ai_reports',
} as const satisfies Record<string, PermissionName>

// Default permission set per role
// Actual permissions in production come from DB role_permissions table.
// This map is used as the fallback for JWT claims injection and seeding.
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, PermissionName[]> = {
  super_admin: Object.values(PERMISSIONS) as PermissionName[],

  team_leader: [
    PERMISSIONS.READ_BRANCHES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.MANAGE_INSTRUCTORS,
    PERMISSIONS.MANAGE_PARENTS,
    PERMISSIONS.MANAGE_GROUPS,
    PERMISSIONS.MANAGE_COURSES,
    PERMISSIONS.MANAGE_MODULES,
    PERMISSIONS.MANAGE_LESSONS,
    PERMISSIONS.MANAGE_SCHEDULE,
    PERMISSIONS.MANAGE_ATTENDANCE,
    PERMISSIONS.READ_ATTENDANCE,
    PERMISSIONS.MANAGE_ASSIGNMENTS,
    PERMISSIONS.GRADE_ASSIGNMENTS,
    PERMISSIONS.READ_GRADES,
    PERMISSIONS.MANAGE_QUIZZES,
    PERMISSIONS.MANAGE_CURRICULUM,
    PERMISSIONS.MANAGE_FINANCIALS,
    PERMISSIONS.READ_FINANCIALS,
    PERMISSIONS.READ_ANALYTICS,
    PERMISSIONS.EXPORT_ANALYTICS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.MANAGE_FEEDBACK,
    PERMISSIONS.MANAGE_MEDIA,
    PERMISSIONS.READ_MEDIA,
    PERMISSIONS.READ_AUDIT_LOGS,
    PERMISSIONS.READ_AI_REPORTS,
  ],

  instructor: [
    PERMISSIONS.READ_BRANCHES,
    PERMISSIONS.MANAGE_ATTENDANCE,    // own classes only — enforced by RLS
    PERMISSIONS.READ_ATTENDANCE,
    PERMISSIONS.MANAGE_ASSIGNMENTS,   // own courses only
    PERMISSIONS.GRADE_ASSIGNMENTS,
    PERMISSIONS.READ_GRADES,
    PERMISSIONS.MANAGE_QUIZZES,
    PERMISSIONS.MANAGE_COURSES,       // own courses only
    PERMISSIONS.MANAGE_MODULES,
    PERMISSIONS.MANAGE_LESSONS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,   // own groups only
    PERMISSIONS.MANAGE_FEEDBACK,      // own students only
    PERMISSIONS.MANAGE_MEDIA,         // own content only
    PERMISSIONS.READ_MEDIA,
    PERMISSIONS.READ_ANALYTICS,       // own students only
    PERMISSIONS.READ_AI_REPORTS,
  ],

  student: [
    PERMISSIONS.READ_ATTENDANCE,      // own only — enforced by RLS
    PERMISSIONS.READ_GRADES,          // own only
    PERMISSIONS.READ_MEDIA,
  ],

  parent: [
    PERMISSIONS.READ_ATTENDANCE,      // child only — enforced by RLS
    PERMISSIONS.READ_GRADES,          // child only
    PERMISSIONS.READ_FINANCIALS,      // own invoices only
  ],
}
