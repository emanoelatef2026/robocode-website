import 'server-only'
import { createServiceClient }                                from '@/lib/supabase/service'
import type { MessageStatus, MessageCategory }                from './constants'
export type { MessageStatus, MessageCategory }                from './constants'
export { CATEGORY_LABELS, STATUS_CONFIG }                     from './constants'

export interface ParentMessage {
  id:             string
  parent_user_id: string
  student_id:     string | null
  branch_id:      string
  category:       MessageCategory
  message:        string
  image_url:      string | null
  status:         MessageStatus
  internal_note:  string | null
  created_at:     string
  updated_at:     string
  student_name?:  string | null
}

// ── Parent: own messages ───────────────────────────────────────────────────────

export async function getParentMessages(
  parentUserId: string,
  studentId?:   string
): Promise<ParentMessage[]> {
  const db    = createServiceClient()
  let q = db
    .from('parent_messages')
    .select(`
      id, parent_user_id, student_id, branch_id, category, message,
      image_url, status, internal_note, created_at, updated_at,
      students!parent_messages_student_id_fkey(
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .eq('parent_user_id', parentUserId)
    .order('created_at', { ascending: false })

  if (studentId) q = (q as any).eq('student_id', studentId)

  const { data } = await q
  return (data ?? []).map((r: any) => {
    const prof = r.students?.users?.profiles
    const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null
    return { ...r, student_name: name }
  }) as ParentMessage[]
}

// ── TL: messages for own branches ─────────────────────────────────────────────

export interface TLMessageFilter {
  branchIds:  string[]
  status?:    MessageStatus
  category?:  MessageCategory
  from?:      string
  to?:        string
}

export interface TLMessage extends ParentMessage {
  parent_name:   string | null
  student_name:  string | null
}

export async function getTLMessages(filter: TLMessageFilter): Promise<TLMessage[]> {
  if (!filter.branchIds.length) return []

  const db = createServiceClient()
  let q = db
    .from('parent_messages')
    .select(`
      id, parent_user_id, student_id, branch_id, category, message,
      image_url, status, internal_note, created_at, updated_at,
      students!parent_messages_student_id_fkey(
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
      )
    `)
    .in('branch_id', filter.branchIds)
    .order('created_at', { ascending: false })

  if (filter.status)   q = (q as any).eq('status',   filter.status)
  if (filter.category) q = (q as any).eq('category', filter.category)
  if (filter.from)     q = (q as any).gte('created_at', filter.from)
  if (filter.to)       q = (q as any).lte('created_at', filter.to)

  const { data } = await q

  // Resolve parent names via auth.users → profiles
  const parentUserIds = [...new Set((data ?? []).map((r: any) => r.parent_user_id as string))]
  const parentNameMap = new Map<string, string | null>()

  if (parentUserIds.length > 0) {
    const { data: profileRows } = await db
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', parentUserIds)
    for (const p of profileRows ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || null
      parentNameMap.set((p as any).user_id, name)
    }
  }

  return (data ?? []).map((r: any) => {
    const prof      = r.students?.users?.profiles
    const studName  = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null
    return {
      ...r,
      student_name: studName,
      parent_name:  parentNameMap.get(r.parent_user_id) ?? null,
    }
  }) as TLMessage[]
}

// ── TL: message KPI counts ─────────────────────────────────────────────────────

export async function getTLMessageCounts(branchIds: string[]): Promise<{ open: number; resolved: number }> {
  if (!branchIds.length) return { open: 0, resolved: 0 }
  const db = createServiceClient()

  const [{ count: openCount }, { count: resolvedCount }] = await Promise.all([
    db.from('parent_messages')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .in('status', ['submitted', 'under_review']),
    db.from('parent_messages')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .eq('status', 'resolved'),
  ])

  return { open: openCount ?? 0, resolved: resolvedCount ?? 0 }
}
