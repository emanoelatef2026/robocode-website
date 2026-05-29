import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { ROLE_DEFAULT_PERMISSIONS, CONFIGURABLE_PERMISSIONS } from './permissions'
import type { PermissionName, ResolvedPermissions } from './types'
import type { RoleName } from '@/types/enums'

// Resolve all permissions for a user from the DB.
// Called after login to populate the lms_session cookie claims.
export async function resolveUserPermissions(userId: string): Promise<ResolvedPermissions> {
  const db = createServiceClient()

  const { data: userRoles, error } = await db
    .from('user_roles')
    .select(`
      branch_id,
      roles (
        name,
        role_permissions (
          permissions ( name )
        )
      )
    `)
    .eq('user_id', userId)

  if (error) throw error

  const permissions = new Set<PermissionName>()
  const branchIds: string[] = []
  const ROLE_PRIORITY: RoleName[] = ['super_admin', 'team_leader', 'instructor', 'student', 'parent']
  let globalRole: RoleName = 'parent'

  for (const ur of userRoles ?? []) {
    if (ur.branch_id) branchIds.push(ur.branch_id)

    const role = ur.roles as unknown as {
      name: RoleName
      role_permissions: { permissions: { name: string } }[]
    }
    if (!role) continue

    if (ROLE_PRIORITY.indexOf(role.name) < ROLE_PRIORITY.indexOf(globalRole)) {
      globalRole = role.name
    }

    for (const rp of role.role_permissions) {
      permissions.add(rp.permissions.name as PermissionName)
    }
  }

  // Fallback: if no DB permissions found, apply TypeScript defaults
  if (permissions.size === 0) {
    for (const p of ROLE_DEFAULT_PERMISSIONS[globalRole]) {
      permissions.add(p)
    }
  }

  // ── Per-user permission overrides (team_leader / instructor only) ─────────
  // If the user has rows in user_permissions, those rows REPLACE the role's
  // configurable permissions. Non-configurable role permissions are unaffected.
  // super_admin always retains all permissions; no overrides applied.
  if (globalRole !== 'super_admin') {
    const { data: userPerms } = await db
      .from('user_permissions')
      .select('permissions!user_permissions_permission_id_fkey(name)')
      .eq('user_id', userId)

    if (userPerms && userPerms.length > 0) {
      const userPermNames = new Set(
        (userPerms as any[])
          .map((up) => (up.permissions as { name: string } | null)?.name as PermissionName)
          .filter(Boolean)
      )
      // Remove all configurable permissions from the role-derived set
      for (const p of CONFIGURABLE_PERMISSIONS) {
        permissions.delete(p)
      }
      // Add back only what the user was explicitly granted
      for (const p of userPermNames) {
        permissions.add(p)
      }
    }
  }

  return { userId, globalRole, branchIds, permissions }
}

// Fast-path permission check against cached claims (no DB query).
export function hasPermission(
  userPermissions: string[],
  required: PermissionName
): boolean {
  return userPermissions.includes(required)
}

// Branch-scoped access check against cached claims.
export function hasBranchAccess(
  globalRole: RoleName,
  branchIds: string[],
  targetBranchId: string
): boolean {
  if (globalRole === 'super_admin') return true
  return branchIds.includes(targetBranchId)
}

// Force-refresh a user's permissions in the session cookie.
// Call this after role changes (e.g. admin assigns a new role).
export async function refreshUserPermissions(userId: string): Promise<ResolvedPermissions> {
  return resolveUserPermissions(userId)
}
