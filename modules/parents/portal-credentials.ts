'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import type { PortalStatus }   from '@/modules/students/portal-credentials'

export interface ParentPortalCredentials {
  email:             string | null
  portal_password:   string | null
  has_portal_access: boolean
  status:            PortalStatus
}

// Canonical resolver for a student's primary parent's portal credentials.
// Used by the welcome-message feature. Mirrors getStudentPortalCredentials.
export async function getParentPortalCredentialsForStudent(
  studentId: string,
): Promise<ParentPortalCredentials> {
  await requirePermission('manage_students')
  const db = createServiceClient()

  const { data: linkRows } = await db
    .from('parent_students')
    .select('parents!parent_students_parent_id_fkey(user_id, portal_password)')
    .eq('student_id', studentId)
    .order('is_primary', { ascending: false })
    .limit(1)

  const link = (linkRows ?? [])[0] as unknown as { parents: { user_id: string; portal_password: string | null } | null } | undefined
  const parent = link?.parents ?? null

  if (!parent?.user_id) {
    return { email: null, portal_password: null, has_portal_access: false, status: 'no_account' }
  }

  const { data: userRow } = await db
    .from('users')
    .select('email')
    .eq('id', parent.user_id)
    .maybeSingle()

  const email = (userRow as any)?.email ?? null
  const portal_password = parent.portal_password ?? null

  const status: PortalStatus =
    !email             ? 'no_access'
    : !portal_password ? 'password_missing'
    : 'active'

  return { email, portal_password, has_portal_access: !!email, status }
}
