'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { deleteSessionCookie, setSessionCookie } from '@/lib/lms-session'
import { resolveUserPermissions } from '@/modules/rbac/resolver'
import { getSupabasePublic } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/modules/rbac/guards'
import { ROLE_PORTAL_MAP } from '@/types/enums'

const STUDIO_ROLES          = new Set(['super_admin', 'team_leader'])
const WORKSPACE_PICKER_ROLES = new Set(['super_admin', 'team_leader'])

// ── Sign in ───────────────────────────────────────────────────────────────────

export interface SignInState {
  error?: string
}

export async function signIn(
  _prev: SignInState | null,
  formData: FormData
): Promise<SignInState> {
  const email    = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const msg = error?.message ?? ''
    if (
      msg.toLowerCase().includes('invalid login credentials') ||
      msg.toLowerCase().includes('invalid email or password')
    ) {
      return { error: 'Invalid email or password.' }
    }
    if (msg.toLowerCase().includes('email not confirmed')) {
      return { error: 'Email not confirmed. Contact your administrator.' }
    }
    return { error: 'Sign in failed. Please try again.' }
  }

  let resolvedRole: string
  try {
    const resolved = await resolveUserPermissions(data.user.id)
    await setSessionCookie({
      id:          data.user.id,
      email:       data.user.email ?? '',
      globalRole:  resolved.globalRole,
      branchIds:   resolved.branchIds,
      permissions: Array.from(resolved.permissions),
    })
    resolvedRole = resolved.globalRole
  } catch {
    return { error: 'Failed to load your account. Contact your administrator.' }
  }

  // Multi-workspace roles choose their destination; single-workspace roles go straight in
  if (WORKSPACE_PICKER_ROLES.has(resolvedRole)) {
    redirect('/select-workspace')
  }
  redirect(ROLE_PORTAL_MAP[resolvedRole as keyof typeof ROLE_PORTAL_MAP] ?? '/')
}

// ── Studio sign in ────────────────────────────────────────────────────────────

export interface SignInStudioState {
  error?: string
}

export async function signInStudio(
  _prev: SignInStudioState | null,
  formData: FormData
): Promise<SignInStudioState> {
  const email    = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const msg = error?.message ?? ''
    if (
      msg.toLowerCase().includes('invalid login credentials') ||
      msg.toLowerCase().includes('invalid email or password')
    ) {
      return { error: 'Invalid email or password.' }
    }
    if (msg.toLowerCase().includes('email not confirmed')) {
      return { error: 'Email not confirmed. Contact your administrator.' }
    }
    return { error: 'Sign in failed. Please try again.' }
  }

  try {
    const resolved = await resolveUserPermissions(data.user.id)
    if (!STUDIO_ROLES.has(resolved.globalRole)) {
      await supabase.auth.signOut()
      return { error: 'Your account does not have access to Studio.' }
    }
    await setSessionCookie({
      id:          data.user.id,
      email:       data.user.email ?? '',
      globalRole:  resolved.globalRole,
      branchIds:   resolved.branchIds,
      permissions: Array.from(resolved.permissions),
    })
  } catch {
    return { error: 'Failed to load your account. Contact your administrator.' }
  }

  redirect('/select-workspace')
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  await deleteSessionCookie()
  redirect('/login')
}

// ── Change password ───────────────────────────────────────────────────────────

export interface ChangePasswordState {
  error?: string
  success?: boolean
}

export async function changePassword(
  _prev: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = (formData.get('current_password') as string) ?? ''
  const newPassword     = (formData.get('new_password') as string) ?? ''
  const confirmPassword = (formData.get('confirm_password') as string) ?? ''

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All fields are required.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' }
  }
  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters.' }
  }

  const user = await requireAuth()

  // Verify current password using the anon client (doesn't modify session cookies)
  const anonClient = getSupabasePublic()
  const { error: verifyError } = await anonClient.auth.signInWithPassword({
    email:    user.email,
    password: currentPassword,
  })
  if (verifyError) {
    return { error: 'Current password is incorrect.' }
  }

  // Update password via admin API
  const db = createServiceClient()
  const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateError) {
    return { error: 'Failed to update password. Please try again.' }
  }

  return { success: true }
}
