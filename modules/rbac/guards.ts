import 'server-only'
import { redirect } from 'next/navigation'
import { getSessionCookie } from '@/lib/lms-session'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import type { PermissionName, PermissionCheckOptions } from './types'
import type { AppUser } from '@/types/app'
import type { RoleName } from '@/types/enums'

// ── Core: read verified session ───────────────────────────────────────────────

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSessionCookie()
  if (!session) return null

  return {
    id:          session.sub,
    email:       session.email,
    globalRole:  session.role,
    branchIds:   session.branchIds,
    permissions: session.permissions,
  }
}

// ── Guards — use at the top of every Server Action ────────────────────────────

// Throws redirect to /login if not authenticated.
export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

// Throws redirect if authenticated but missing a specific permission.
export async function requirePermission(
  permission: PermissionName,
  options?: PermissionCheckOptions
): Promise<AppUser> {
  const user = await requireAuth()

  if (!user.permissions.includes(permission)) {
    // Redirect to their portal with a forbidden flag rather than exposing what was needed
    redirect(`${ROLE_PORTAL_MAP[user.globalRole]}?error=forbidden`)
  }

  if (options?.branchId && user.globalRole !== 'super_admin') {
    if (!user.branchIds.includes(options.branchId)) {
      redirect(`${ROLE_PORTAL_MAP[user.globalRole]}?error=forbidden`)
    }
  }

  return user
}

// Non-throwing version — for conditional rendering in Server Components.
export async function checkPermission(
  permission: PermissionName,
  options?: PermissionCheckOptions
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  if (!user.permissions.includes(permission)) return false
  if (options?.branchId && user.globalRole !== 'super_admin') {
    return user.branchIds.includes(options.branchId)
  }
  return true
}

// Portal layout guard — ensures the user's role matches the portal they're visiting.
// Super admins may access any portal.
export async function requirePortalRole(expectedRole: RoleName): Promise<AppUser> {
  const user = await requireAuth()

  if (user.globalRole === 'super_admin') return user

  if (user.globalRole !== expectedRole) {
    redirect(ROLE_PORTAL_MAP[user.globalRole])
  }

  return user
}

// Synchronous branch access check — use inside server actions after fetching the entity.
// Returns true for super_admin unconditionally; false when entityBranchId is null.
export function isBranchAccessible(user: AppUser, entityBranchId: string | null): boolean {
  if (user.globalRole === 'super_admin') return true
  if (!entityBranchId) return false
  return user.branchIds.includes(entityBranchId)
}

// Ownership check — use for resource-level enforcement.
// Returns true if the user owns the resource OR is super_admin or team_leader in the branch.
export async function canAccessResource(
  resourceOwnerId: string,
  options?: { branchId?: string }
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  if (user.id === resourceOwnerId) return true
  if (user.globalRole === 'super_admin') return true
  if (user.globalRole === 'team_leader') {
    if (!options?.branchId) return false
    return user.branchIds.includes(options.branchId)
  }

  return false
}
