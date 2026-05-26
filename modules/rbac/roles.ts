import type { RoleName } from '@/types/enums'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  TEAM_LEADER: 'team_leader',
  INSTRUCTOR:  'instructor',
  STUDENT:     'student',
  PARENT:      'parent',
} as const satisfies Record<string, RoleName>

// Priority order: higher index = higher privilege
export const ROLE_PRIORITY: RoleName[] = [
  'parent',
  'student',
  'instructor',
  'team_leader',
  'super_admin',
]

export function isHigherRole(a: RoleName, b: RoleName): boolean {
  return ROLE_PRIORITY.indexOf(a) > ROLE_PRIORITY.indexOf(b)
}

// Human-readable labels for UI (kept here for reference, actual display uses i18n)
export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin:  'Super Admin',
  team_leader:  'Team Leader',
  instructor:   'Instructor',
  student:      'Student',
  parent:       'Parent',
}
