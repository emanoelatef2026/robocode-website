import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface DuplicateParentAccount {
  parentId:   string
  userId:     string
  name:       string
  email:      string
  createdAt:  string
  children:   { studentId: string; name: string }[]
}

export interface DuplicateParentGroup {
  phone:    string
  accounts: DuplicateParentAccount[]
}

/**
 * Read-only report of parent portal accounts (public.parents) that share the
 * same login phone number — the signature left behind by the pre-fix
 * account-creation bug (every creation call site minted a brand-new login
 * with no identity check). Produces a report for a human to review; does
 * NOT merge anything automatically — merging two real Supabase Auth users
 * safely (history, notifications, messages, timeline) needs a case-by-case
 * judgment call two accounts sharing a phone could also be two different
 * real people (e.g. father and mother sharing one number).
 */
export async function getDuplicateParentGroups(): Promise<DuplicateParentGroup[]> {
  const db = createServiceClient()

  const { data: parentRows } = await db
    .from('parents')
    .select(`
      id, user_id, created_at,
      users!parents_user_id_fkey ( email, phone, profiles!profiles_user_id_fkey ( first_name, last_name ) ),
      parent_students (
        student_id,
        students!parent_students_student_id_fkey (
          users!students_user_id_fkey ( profiles!profiles_user_id_fkey ( first_name, last_name ) )
        )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const byPhone = new Map<string, DuplicateParentAccount[]>()

  for (const row of (parentRows ?? []) as any[]) {
    const u = row.users ?? {}
    const phone = (u.phone as string | null)?.trim()
    if (!phone) continue

    const profile = u.profiles ?? null
    const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : (u.email ?? 'Unknown parent')

    const children = (Array.isArray(row.parent_students) ? row.parent_students : []).map((ps: any) => {
      const studentProfile = ps.students?.users?.profiles ?? null
      return {
        studentId: ps.student_id as string,
        name: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}`.trim() : 'Unknown student',
      }
    })

    const account: DuplicateParentAccount = {
      parentId:  row.id,
      userId:    row.user_id,
      name:      name || 'Unknown parent',
      email:     u.email ?? '',
      createdAt: row.created_at,
      children,
    }

    const list = byPhone.get(phone)
    if (list) list.push(account)
    else byPhone.set(phone, [account])
  }

  return [...byPhone.entries()]
    .filter(([, accounts]) => accounts.length > 1)
    .map(([phone, accounts]) => ({ phone, accounts }))
    .sort((a, b) => b.accounts.length - a.accounts.length)
}
