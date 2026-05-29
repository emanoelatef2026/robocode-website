import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CONFIGURABLE_PERMISSIONS } from '@/modules/rbac/permissions'
import type { PermissionName } from '@/modules/rbac/types'

// Replace the configurable permission set for a user.
// Called from TL and instructor create/update actions.
//
// If grantedPermissions is empty: deletes all user_permissions rows → user
// falls back to role defaults on next resolver run.
// If grantedPermissions is non-empty: stores exactly that set for the
// configurable subset, replacing any previous custom grants.
export async function saveUserPermissions(
  targetUserId: string,
  grantedBy: string,
  grantedPermissions: string[]
): Promise<void> {
  const db = createServiceClient()

  // Validate: only accept known configurable permission names
  const valid = grantedPermissions.filter((p) =>
    (CONFIGURABLE_PERMISSIONS as readonly string[]).includes(p)
  ) as PermissionName[]

  // Resolve IDs for all configurable permissions (needed for deletion)
  const { data: allConfigRows } = await db
    .from('permissions')
    .select('id, name')
    .in('name', CONFIGURABLE_PERMISSIONS as unknown as string[])

  const allConfigIds = (allConfigRows ?? []).map((r: any) => r.id as string)

  // Delete all existing configurable user_permissions for this user
  if (allConfigIds.length > 0) {
    await db
      .from('user_permissions')
      .delete()
      .eq('user_id', targetUserId)
      .in('permission_id', allConfigIds)
  }

  if (valid.length === 0) return

  // Look up IDs for the granted permissions
  const { data: grantedRows } = await db
    .from('permissions')
    .select('id, name')
    .in('name', valid)

  if (!grantedRows || grantedRows.length === 0) return

  await db.from('user_permissions').insert(
    (grantedRows as any[]).map((p) => ({
      user_id:       targetUserId,
      permission_id: p.id,
      granted_by:    grantedBy,
    }))
  )
}
