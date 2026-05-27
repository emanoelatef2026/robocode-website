import type { RoleName } from '@/types/enums'

// Every permission name in the system — add here when adding to DB seed
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
  // Financials
  | 'manage_financials'
  | 'read_financials'
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
