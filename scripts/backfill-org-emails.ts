/**
 * One-off backfill: rewrite every non-@robocodeschools.com login email to the
 * generated convention (see lib/generate-login-email.ts), for every existing
 * account (students, parents, instructors, team leaders, admins).
 *
 * Usage:
 *   npx ts-node scripts/backfill-org-emails.ts            # dry run — writes CSV only
 *   npx ts-node scripts/backfill-org-emails.ts --apply     # actually updates auth.users
 *
 * ENV REQUIRED:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * WARNING: --apply rewrites real login credentials. Review the dry-run CSV first.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateUniqueLoginEmail, ORG_EMAIL_DOMAIN } from '../lib/generate-login-email'

const URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APPLY = process.argv.includes('--apply')

const db = createClient(URL, KEY)

const STAFF_ROLES = new Set(['super_admin', 'team_leader', 'instructor'])
const PAGE_SIZE = 1000

interface UserRow { id: string; email: string }
interface ProfileRow { user_id: string; first_name: string | null; last_name: string | null }
interface UserRoleRow { user_id: string; roles: { name: string } | { name: string }[] | null }

async function fetchAllPaged<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

async function main() {
  console.log('Loading users, profiles, and roles…')
  const users    = await fetchAllPaged<UserRow>('users', 'id, email')
  const profiles = await fetchAllPaged<ProfileRow>('profiles', 'user_id, first_name, last_name')
  const userRoles = await fetchAllPaged<UserRoleRow>('user_roles', 'user_id, roles(name)')

  const profileByUser = new Map(profiles.map(p => [p.user_id, p]))
  const rolesByUser = new Map<string, string[]>()
  for (const ur of userRoles) {
    const names = Array.isArray(ur.roles) ? ur.roles.map(r => r.name) : ur.roles ? [ur.roles.name] : []
    const existing = rolesByUser.get(ur.user_id) ?? []
    rolesByUser.set(ur.user_id, [...existing, ...names])
  }

  const takenLocalParts = new Set(
    users
      .filter(u => u.email.toLowerCase().endsWith(`@${ORG_EMAIL_DOMAIN}`))
      .map(u => u.email.toLowerCase().split('@')[0])
  )

  const rows: { id: string; old_email: string; new_email: string; role: string }[] = []

  for (const u of users) {
    if (u.email.toLowerCase().endsWith(`@${ORG_EMAIL_DOMAIN}`)) continue // already compliant

    const profile = profileByUser.get(u.id)
    const firstName = profile?.first_name || 'user'
    const lastName  = profile?.last_name  || 'account'
    const roleNames = rolesByUser.get(u.id) ?? []
    const kind = roleNames.some(r => STAFF_ROLES.has(r)) ? 'staff' : 'learner'

    const newEmail = await generateUniqueLoginEmail(kind, firstName, lastName, async (localPart) => {
      if (takenLocalParts.has(localPart.toLowerCase())) return true
      return false
    })
    takenLocalParts.add(newEmail.split('@')[0].toLowerCase())

    rows.push({ id: u.id, old_email: u.email, new_email: newEmail, role: roleNames.join('+') || 'none' })
  }

  const csvLines = ['id,old_email,new_email,role', ...rows.map(r => `${r.id},${r.old_email},${r.new_email},${r.role}`)]
  const csvPath = join(process.cwd(), `backfill-org-emails-${Date.now()}.csv`)
  writeFileSync(csvPath, csvLines.join('\n'))

  console.log(`${rows.length} account(s) need backfill out of ${users.length} total.`)
  console.log(`CSV written to ${csvPath}`)

  if (!APPLY) {
    console.log('Dry run only — re-run with --apply to actually update auth.users emails.')
    return
  }

  console.log('Applying updates to auth.users…')
  let ok = 0
  let failed = 0
  for (const r of rows) {
    const { error } = await db.auth.admin.updateUserById(r.id, { email: r.new_email, email_confirm: true })
    if (error) {
      failed++
      console.error(`FAILED ${r.id} (${r.old_email} -> ${r.new_email}): ${error.message}`)
    } else {
      ok++
    }
  }
  console.log(`Backfill applied: ${ok} updated, ${failed} failed.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
