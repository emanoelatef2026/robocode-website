import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionCookie } from '@/lib/lms-session'
import type { AppUser } from '@/types/app'

// Get the current Supabase session (used at the auth callback to exchange tokens).
export async function getSupabaseSession() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Get the authenticated Supabase user (server-validated, not from cookie).
export async function getSupabaseUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Get the current LMS AppUser from the encrypted session cookie.
// This is the fast path used by Server Components and guards.
// Returns null if not authenticated or session is expired/invalid.
export async function getCurrentAppUser(): Promise<AppUser | null> {
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
