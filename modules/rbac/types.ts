import type { RoleName } from '@/types/enums'

// Every permission name in the system.
// Steps when adding a new permission:
//   1. Add the string literal to this union.
//   2. Add the constant to PERMISSIONS in permissions.ts.
//   3. Add to ROLE_DEFAULT_PERMISSIONS for relevant roles.
//   4. Write a DB migration: INSERT into permissions + role_permissions.
//      Always include super_admin in that INSERT so the role stays unrestricted.
//   5. If the permission should be per-user configurable, add it to
//      CONFIGURABLE_PERMISSIONS and follow the backfill protocol documented there.
export type PermissionName =
  // System
  | 'manage_system'
  | 'manage_permissions'
  // Organization
  | 'manage_branches'
  | 'read_branches'
  | 'manage_settings'
  // Users
  | 'manage_users'
  | 'manage_students'
  | 'manage_instructors'
  | 'manage_parents'
  // Academic
  | 'manage_groups'
  | 'archive_cohort'
  | 'view_archived_cohorts'
  | 'recover_archived_cohort'
  | 'manage_courses'
  | 'manage_modules'
  | 'manage_lessons'
  | 'manage_schedule'
  | 'manage_attendance'
  | 'read_attendance'
  | 'manage_assignments'
  | 'grade_assignments'
  | 'read_grades'
  | 'manage_quizzes'
  | 'manage_curriculum'
  | 'manage_semesters'
  // Financials (granular — not yet seeded or configurable; add to DB when features ship)
  | 'manage_financials'
  | 'read_financials'
  | 'view_financial_reports'
  | 'manage_payroll'
  | 'view_branch_revenue'
  | 'manage_payments'
  // Analytics
  | 'read_analytics'
  | 'export_analytics'
  // Communication
  | 'send_announcements'
  | 'send_notifications'
  | 'manage_feedback'
  // Content
  | 'manage_media'
  | 'read_media'
  // Audit
  | 'read_audit_logs'
  // Portfolio
  | 'manage_portfolio'
  // Certificates
  | 'manage_certificates'
  // AI (future)
  | 'manage_ai_agents'
  | 'read_ai_reports'

export interface UserRoleRecord {
  userId: string
  roleId: string
  roleName: RoleName
  branchId: string | null  // null = global scope
}

export interface ResolvedPermissions {
  userId: string
  globalRole: RoleName
  branchIds: string[]
  permissions: Set<PermissionName>
}

export interface PermissionCheckOptions {
  branchId?: string  // if provided, checks branch-scoped role too
}
