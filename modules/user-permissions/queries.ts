import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CONFIGURABLE_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '@/modules/rbac/permissions'
import type { PermissionName } from '@/modules/rbac/types'
import type { RoleName } from '@/types/enums'

// Get the user's current effective configurable permissions.
// Returns the user's explicit user_permissions if they have been customised,
// otherwise returns the role's defaults filtered to the configurable set.
export async function getUserConfigurablePermissions(
  userId: string,
  roleName: RoleName
): Promise<PermissionName[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('user_permissions')
    .select('permissions!user_permissions_permission_id_fkey(name)')
    .eq('user_id', userId)

  if (data && data.length > 0) {
    return (data as any[])
      .map((row) => (row.permissions as { name: string } | null)?.name as PermissionName)
      .filter(Boolean)
      .filter((p) => (CONFIGURABLE_PERMISSIONS as readonly string[]).includes(p))
  }

  // Not yet customised — return the role defaults for the configurable subset
  return (ROLE_DEFAULT_PERMISSIONS[roleName] ?? []).filter((p) =>
    (CONFIGURABLE_PERMISSIONS as readonly string[]).includes(p)
  )
}
