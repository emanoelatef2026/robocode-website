import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'OVERDUE_PAYMENT'
  | 'UPCOMING_DUE'
  | 'PACKAGE_EXHAUSTION'
  | 'ATTENDANCE_RISK'
  | 'RENEWAL_RECOMMENDATION'
  | 'UNRESOLVED_COMPLAINT'
  | 'INSTRUCTOR_ASSIGNMENT'
  | 'NEW_HOMEWORK'
  | 'DROPOUT_RISK'
  | 'TASK_ASSIGNED'

export type NotificationChannel = 'in_app' | 'whatsapp' | 'email' | 'push'
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface NotificationInput {
  branch_id?:        string
  student_id?:       string
  enrollment_id?:    string
  parent_id?:        string
  recipient_user_id: string
  type:              NotificationType
  channel?:          NotificationChannel
  priority?:         NotificationPriority
  title:             string
  body?:             string
  payload?:          Record<string, unknown>
  scheduled_for?:    string    // ISO timestamp, defaults to NOW
  cooldown_hours?:   number    // dedup window — default 24h
}

// ── Queue notification (with deduplication) ───────────────────────────────────

export async function queueNotification(input: NotificationInput): Promise<void> {
  const db      = createServiceClient()
  const channel = input.channel    ?? 'in_app'
  const priority = input.priority  ?? 'MEDIUM'
  const cooldownHours = input.cooldown_hours ?? 24

  // Build dedup key: {student_id}:{type}:{channel}
  const dedupKey = input.student_id
    ? `${input.student_id}:${input.type}:${channel}`
    : null

  // Check cooldown — has a notification of this type+channel been sent recently?
  if (dedupKey) {
    const cooldownStart = new Date(Date.now() - cooldownHours * 3600000).toISOString()
    const { count } = await db
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('dedup_key', dedupKey)
      .gte('created_at', cooldownStart)
      .in('status', ['PENDING', 'SENT'])

    if ((count ?? 0) > 0) return  // suppressed — within cooldown window
  }

  await db.from('notification_queue').insert({
    branch_id:        input.branch_id        ?? null,
    student_id:       input.student_id       ?? null,
    enrollment_id:    input.enrollment_id    ?? null,
    parent_id:        input.parent_id        ?? null,
    recipient_user_id: input.recipient_user_id,
    type:             input.type,
    channel,
    priority,
    title:            input.title,
    body:             input.body             ?? null,
    payload:          input.payload          ?? {},
    status:           'PENDING',
    scheduled_for:    input.scheduled_for    ?? new Date().toISOString(),
    dedup_key:        dedupKey,
  })
}

// ── Batch queue (fire-and-forget multiple notifications) ──────────────────────

export async function queueNotifications(inputs: NotificationInput[]): Promise<void> {
  // Sequential to respect dedup checks
  for (const input of inputs) {
    await queueNotification(input).catch(() => {/* non-fatal */})
  }
}

// ── Fetch pending notifications for processing ────────────────────────────────

export async function getUnsentNotifications(opts: {
  branchIds?: string[]
  channel?:   NotificationChannel
  limit?:     number
} = {}): Promise<Array<{
  id: string; type: NotificationType; channel: NotificationChannel
  priority: NotificationPriority; title: string; body: string | null
  recipient_user_id: string; student_id: string | null; payload: Record<string, unknown>
}>> {
  const db = createServiceClient()

  let q = db
    .from('notification_queue')
    .select('id, type, channel, priority, title, body, recipient_user_id, student_id, payload')
    .eq('status', 'PENDING')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('scheduled_for', { ascending: true })
    .limit(opts.limit ?? 100)

  if (opts.branchIds?.length) q = (q as any).in('branch_id', opts.branchIds)
  if (opts.channel)           q = q.eq('channel', opts.channel)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id:                r.id,
    type:              r.type as NotificationType,
    channel:           r.channel as NotificationChannel,
    priority:          r.priority as NotificationPriority,
    title:             r.title as string,
    body:              r.body as string | null,
    recipient_user_id: r.recipient_user_id as string,
    student_id:        r.student_id as string | null,
    payload:           (r.payload ?? {}) as Record<string, unknown>,
  }))
}

// ── Mark notification sent/failed ─────────────────────────────────────────────

export async function markNotificationSent(id: string): Promise<void> {
  const db = createServiceClient()
  await db.from('notification_queue').update({ status: 'SENT', sent_at: new Date().toISOString() }).eq('id', id)
}

export async function markNotificationFailed(id: string, error: string): Promise<void> {
  const db = createServiceClient()
  await db.from('notification_queue').update({ status: 'FAILED', error }).eq('id', id)
}

// ── Notification labels ────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  OVERDUE_PAYMENT:        'Overdue Payment',
  UPCOMING_DUE:           'Payment Due Soon',
  PACKAGE_EXHAUSTION:     'Sessions Running Out',
  ATTENDANCE_RISK:        'Attendance Risk',
  RENEWAL_RECOMMENDATION: 'Renewal Recommended',
  UNRESOLVED_COMPLAINT:   'Complaint Needs Attention',
  INSTRUCTOR_ASSIGNMENT:  'Instructor Update',
  NEW_HOMEWORK:           'New Homework Assigned',
  DROPOUT_RISK:           'Student at Risk',
  TASK_ASSIGNED:          'Task Assigned',
}
