import 'server-only'
import type { createServiceClient } from '@/lib/supabase/service'

export interface ParentMatchCandidate {
  parentId:   string
  userId:     string
  name:       string
  email:      string
  phone:      string | null
  childCount: number
}

export type ParentResolution =
  | { kind: 'create' }
  | { kind: 'link'; parentId: string }
  | { kind: 'ambiguous'; candidates: ParentMatchCandidate[] }

export const AMBIGUOUS_PARENT_MATCH = 'AMBIGUOUS_PARENT_MATCH' as const

function normalizePhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim()
  return trimmed || null
}

/**
 * Finds existing parent portal accounts (public.parents — the real login,
 * not the CRM-only student_parent_contacts row) whose phone matches. Phone
 * is the only stable real-world identity signal available: login emails are
 * synthetic (lib/generate-login-email.ts) and never re-typed by staff, so
 * they can never be used to detect "this is the same person."
 */
export async function findParentMatchesByPhone(
  db: ReturnType<typeof createServiceClient>,
  phone: string | null | undefined
): Promise<ParentMatchCandidate[]> {
  const normalized = normalizePhone(phone)
  if (!normalized) return []

  const { data: userRows } = await db.from('users').select('id').eq('phone', normalized)
  const userIds = ((userRows ?? []) as { id: string }[]).map(u => u.id)
  if (!userIds.length) return []

  const { data: parentRows } = await db
    .from('parents')
    .select(`
      id, user_id,
      users!parents_user_id_fkey ( email, phone, profiles!profiles_user_id_fkey ( first_name, last_name ) ),
      parent_students ( student_id )
    `)
    .in('user_id', userIds)
    .is('deleted_at', null)

  return ((parentRows ?? []) as any[]).map((row) => {
    const u = row.users ?? {}
    const profile = u.profiles ?? null
    const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : (u.email ?? 'Unknown parent')
    return {
      parentId:   row.id as string,
      userId:     row.user_id as string,
      name:       name || 'Unknown parent',
      email:      u.email ?? '',
      phone:      u.phone ?? null,
      childCount: Array.isArray(row.parent_students) ? row.parent_students.length : 0,
    }
  })
}

/**
 * Decides whether a parent-creation call site should create a brand-new
 * portal account, silently link to an existing one, or defer to the caller
 * because more than one existing account matches (ambiguous — could be two
 * different real people who happen to share a phone).
 *
 * `resolvedParentId` / `forceNew` let a caller that already asked staff to
 * disambiguate skip the lookup and act on their choice directly.
 */
export async function resolveParentForPhone(
  db: ReturnType<typeof createServiceClient>,
  phone: string | null | undefined,
  opts: { resolvedParentId?: string | null; forceNew?: boolean } = {}
): Promise<ParentResolution> {
  if (opts.resolvedParentId) return { kind: 'link', parentId: opts.resolvedParentId }
  if (opts.forceNew) return { kind: 'create' }

  const matches = await findParentMatchesByPhone(db, phone)
  if (matches.length === 0) return { kind: 'create' }
  if (matches.length === 1) return { kind: 'link', parentId: matches[0].parentId }
  return { kind: 'ambiguous', candidates: matches }
}

/**
 * Links an already-existing parent account to a student — used instead of
 * minting a new login when resolveParentForPhone found (or staff resolved)
 * an existing account, so the real person keeps one login for every child.
 */
export async function linkExistingParentToStudent(
  db: ReturnType<typeof createServiceClient>,
  parentId: string,
  studentId: string,
  relationship: string,
  isPrimary: boolean
): Promise<void> {
  await db.from('parent_students').upsert(
    { parent_id: parentId, student_id: studentId, relationship, is_primary: isPrimary },
    { onConflict: 'parent_id,student_id', ignoreDuplicates: true }
  )
}
