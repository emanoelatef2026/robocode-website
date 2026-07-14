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
  ARCHIVE_COHORT:          'archive_cohort',
  VIEW_ARCHIVED_COHORTS:   'view_archived_cohorts',
  RECOVER_ARCHIVED_COHORT: 'recover_archived_cohort',
  MANAGE_COURSES:       'manage_courses',
  MANAGE_MODULES:       'manage_modules',
  MANAGE_LESSONS:       'manage_lessons',
  MANAGE_SEMESTERS:     'manage_semesters',
  MANAGE_SCHEDULE:      'manage_schedule',
  MANAGE_ATTENDANCE:    'manage_attendance',
  READ_ATTENDANCE:      'read_attendance',
  MANAGE_ASSIGNMENTS:   'manage_assignments',
  GRADE_ASSIGNMENTS:    'grade_assignments',
  READ_GRADES:          'read_grades',
  MANAGE_QUIZZES:       'manage_quizzes',
  MANAGE_CURRICULUM:    'manage_curriculum',
  // Financials — broad (active)
  MANAGE_FINANCIALS:    'manage_financials',
  READ_FINANCIALS:      'read_financials',
  // Financials — granular (type-registered; NOT yet seeded to DB or added to
  // CONFIGURABLE_PERMISSIONS; expose when financial features ship)
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
  MANAGE_PAYROLL:         'manage_payroll',
  VIEW_BRANCH_REVENUE:    'view_branch_revenue',
  MANAGE_PAYMENTS:        'manage_payments',
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
  // Portfolio
  MANAGE_PORTFOLIO:     'manage_portfolio',
  // Certificates
  MANAGE_CERTIFICATES:  'manage_certificates',
  // AI
  MANAGE_AI_AGENTS:     'manage_ai_agents',
  READ_AI_REPORTS:      'read_ai_reports',
} as const satisfies Record<string, PermissionName>

// ── Configurable permissions ──────────────────────────────────────────────────
// These permissions can be customized per-user via the TL/instructor admin UI.
// When a user has rows in user_permissions, the resolver removes ALL permissions
// listed here from the role-derived set and replaces them with the explicit
// user_permissions grants. Permissions NOT listed here always flow from the role.
//
// ⚠ ROLLOUT PROTOCOL — read before adding any entry here:
//
//   Adding a permission to this list AFTER users have already been customized
//   causes those users to silently lose the new permission at their next login
//   (because it won't be present in their stored user_permissions rows).
//
//   Whenever you add a new entry to CONFIGURABLE_PERMISSIONS you MUST also
//   write a companion migration that backfills the new permission for every
//   user who already has customized user_permissions. Template:
//
//     -- Backfill <new_permission> for all users who have custom user_permissions
//     INSERT INTO public.user_permissions (user_id, permission_id)
//     SELECT DISTINCT up.user_id, p.id
//     FROM   public.user_permissions up
//     CROSS  JOIN public.permissions p
//     WHERE  p.name = '<new_permission>'
//       AND  NOT EXISTS (
//              SELECT 1 FROM public.user_permissions x
//              WHERE  x.user_id       = up.user_id
//                AND  x.permission_id = p.id
//            );
//
//   Run this in the same migration that seeds the permission and adds it to
//   role_permissions so the operation is atomic.
export const CONFIGURABLE_PERMISSIONS = [
  'manage_students',
  'manage_parents',
  'manage_instructors',
  'manage_groups',
  'manage_courses',
  'manage_semesters',
  'manage_attendance',
  'manage_assignments',
  'grade_assignments',
  'manage_portfolio',
  'manage_certificates',
  'read_analytics',
  'manage_financials',
] as const satisfies PermissionName[]

export type ConfigurablePermission = typeof CONFIGURABLE_PERMISSIONS[number]

// Permission groups for the checklist UI
export const PERMISSION_GROUPS: Array<{
  label: string
  permissions: Array<{ name: ConfigurablePermission; label: string }>
}> = [
  {
    label: 'People',
    permissions: [
      { name: 'manage_students',    label: 'Manage Students' },
      { name: 'manage_parents',     label: 'Manage Parents' },
      { name: 'manage_instructors', label: 'Manage Instructors' },
    ],
  },
  {
    label: 'Academic',
    permissions: [
      { name: 'manage_groups',      label: 'Manage Groups' },
      { name: 'manage_courses',     label: 'Manage Courses' },
      { name: 'manage_semesters',   label: 'Manage Semesters' },
      { name: 'manage_attendance',  label: 'Manage Attendance' },
      { name: 'manage_assignments', label: 'Manage Assignments' },
      { name: 'grade_assignments',  label: 'Grade Assignments' },
    ],
  },
  {
    label: 'Content',
    permissions: [
      { name: 'manage_portfolio',   label: 'Manage Portfolio' },
      { name: 'manage_certificates',label: 'Manage Certificates' },
    ],
  },
  {
    label: 'Analytics & Finance',
    permissions: [
      { name: 'read_analytics',    label: 'View Reports' },
      { name: 'manage_financials', label: 'Manage Financials' },
    ],
  },
]

// Default permission set per role.
// Production permissions come from DB role_permissions (seeded via migrations).
// This map serves two purposes:
//   1. Resolver fallback — used only when role_permissions returns 0 rows (e.g. local dev before seeding).
//   2. UI pre-check defaults — shown in the PermissionsChecklist for new TL/instructor forms.
//
// ⚠ super_admin MUST always be seeded explicitly in every permission migration.
//   The resolver's TypeScript fallback only fires when permissions.size === 0,
//   which will not occur for a properly seeded super_admin. If a new permission
//   is added to this constant but its migration is not applied, super_admin silently
//   loses access to features guarded by that permission. Always include:
//
//     INSERT INTO public.role_permissions (role_id, permission_id)
//     SELECT r.id, p.id FROM public.roles r, public.permissions p
//     WHERE r.name = 'super_admin' AND p.name = '<new_permission>'
//     ON CONFLICT DO NOTHING;
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, PermissionName[]> = {
  super_admin: Object.values(PERMISSIONS) as PermissionName[],

  team_leader: [
    PERMISSIONS.READ_BRANCHES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.MANAGE_INSTRUCTORS,
    PERMISSIONS.MANAGE_PARENTS,
    PERMISSIONS.MANAGE_GROUPS,
    PERMISSIONS.ARCHIVE_COHORT,
    PERMISSIONS.VIEW_ARCHIVED_COHORTS,
    PERMISSIONS.MANAGE_COURSES,
    PERMISSIONS.MANAGE_MODULES,
    PERMISSIONS.MANAGE_LESSONS,
    PERMISSIONS.MANAGE_SEMESTERS,
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
    PERMISSIONS.MANAGE_PAYROLL,
    PERMISSIONS.READ_ANALYTICS,
    PERMISSIONS.EXPORT_ANALYTICS,
    PERMISSIONS.SEND_ANNOUNCEMENTS,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.MANAGE_FEEDBACK,
    PERMISSIONS.MANAGE_MEDIA,
    PERMISSIONS.READ_MEDIA,
    PERMISSIONS.READ_AUDIT_LOGS,
    PERMISSIONS.MANAGE_PORTFOLIO,
    PERMISSIONS.MANAGE_CERTIFICATES,
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

// Default configurable permissions per role (shown pre-checked in create forms)
export const DEFAULT_CONFIGURABLE_PERMISSIONS: Record<'team_leader' | 'instructor', ConfigurablePermission[]> = {
  team_leader: [
    'manage_students',
    'manage_parents',
    'manage_instructors',
    'manage_groups',
    'manage_courses',
    'manage_semesters',
    'manage_attendance',
    'manage_assignments',
    'grade_assignments',
    'manage_portfolio',
    'manage_certificates',
    'read_analytics',
    'manage_financials',
  ],
  instructor: [
    'manage_attendance',
    'manage_assignments',
    'grade_assignments',
    'manage_courses',
  ],
}
