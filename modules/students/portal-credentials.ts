'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'

export type PortalStatus = 'active' | 'password_missing' | 'no_access' | 'no_account'

export interface StudentPortalCredentials {
  email:             string | null
  portal_password:   string | null
  has_portal_access: boolean
  status:            PortalStatus
}

// Canonical resolver for student portal credentials.
// Used by Quick View modal and any future auth-display surface.
// Separates queries so a missing portal_password column never hides the email.
export async function getStudentPortalCredentials(
  studentId: string,
): Promise<StudentPortalCredentials> {
  await requirePermission('manage_students')
  const db = createServiceClient()

  // Step 1: fetch user_id + portal_password together.
  // If portal_password column absent from PostgREST schema cache, fall back to user_id only.
  const { data: studentRow, error: stuErr } = await db
    .from('students')
    .select('user_id, portal_password')
    .eq('id', studentId)
    .maybeSingle()

  let userId:          string | null = null
  let portal_password: string | null = null

  if (!stuErr && studentRow) {
    userId          = (studentRow as any).user_id         ?? null
    portal_password = (studentRow as any).portal_password ?? null
  } else {
    const { data: fallback } = await db
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .maybeSingle()
    userId = (fallback as any)?.user_id ?? null
  }

  if (!userId) {
    return { email: null, portal_password: null, has_portal_access: false, status: 'no_account' }
  }

  // Step 2: fetch email directly from users by PK — no FK join ambiguity.
  const { data: userRow } = await db
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  const email = (userRow as any)?.email ?? null

  const status: PortalStatus =
    !email            ? 'no_access'
    : !portal_password ? 'password_missing'
    : 'active'

  return { email, portal_password, has_portal_access: !!email, status }
}
