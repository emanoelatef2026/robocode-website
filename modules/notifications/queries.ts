import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Notification, NotificationFeed } from './types'

// Returns last 30 notifications for userId, with read status resolved.
export async function getNotificationFeed(userId: string): Promise<NotificationFeed> {
  const db = createServiceClient()

  const { data: rows } = await db
    .from('notifications')
    .select('id, type, title, body, href, created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!rows || rows.length === 0) return { notifications: [], unread_count: 0 }

  const notifIds = (rows as any[]).map((r) => r.id as string)

  const { data: readRows } = await db
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId)
    .in('notification_id', notifIds)

  const readSet = new Set((readRows ?? []).map((r: any) => r.notification_id as string))

  const notifications: Notification[] = (rows as any[]).map((r) => ({
    id:         r.id,
    type:       r.type,
    title:      r.title,
    body:       r.body    ?? null,
    href:       r.href    ?? null,
    created_at: r.created_at,
    is_read:    readSet.has(r.id),
  }))

  const unread_count = notifications.filter((n) => !n.is_read).length

  return { notifications, unread_count }
}

// Lightweight count for initial page load — avoids fetching full list.
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const db = createServiceClient()

  const { count: total } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)

  if (!total) return 0

  const { count: readCount } = await db
    .from('notification_reads')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)

  return Math.max(0, (total ?? 0) - (readCount ?? 0))
}

// ── Recipient resolution — shared by every student-domain notification ───────

// Returns the auth user_id for a student's own portal account, or null if none.
export async function getStudentUserId(studentId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db.from('students').select('user_id').eq('id', studentId).maybeSingle()
  return (data as any)?.user_id ?? null
}

// Returns the auth user_ids of every parent linked to a student who hasn't
// opted out of notifications (parent_students.can_receive_notifications).
export async function getParentUserIdsForStudent(studentId: string): Promise<string[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('parent_students')
    .select('can_receive_notifications, parents!parent_students_parent_id_fkey(user_id)')
    .eq('student_id', studentId)
    .eq('can_receive_notifications', true)

  return ((data ?? []) as any[])
    .map((row) => row.parents?.user_id as string | undefined)
    .filter((id): id is string => Boolean(id))
}
