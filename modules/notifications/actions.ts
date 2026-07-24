'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/modules/rbac/guards'
import type { NotificationFeed } from './types'
import { getNotificationFeed } from './queries'

// ── Read (called from client components) ─────────────────────────────────────

export async function fetchNotificationFeed(): Promise<NotificationFeed> {
  const user = await requireAuth()
  return getNotificationFeed(user.id)
}

// ── Mark read ─────────────────────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await requireAuth()
  const db   = createServiceClient()

  await db
    .from('notification_reads')
    .upsert(
      { notification_id: notificationId, user_id: user.id },
      { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
    )
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const { data: rows } = await db
    .from('notifications')
    .select('id')
    .eq('recipient_id', user.id)

  if (!rows || rows.length === 0) return

  const inserts = (rows as any[]).map((r) => ({
    notification_id: r.id as string,
    user_id:         user.id,
  }))

  await db
    .from('notification_reads')
    .upsert(inserts, { onConflict: 'notification_id,user_id', ignoreDuplicates: true })
}

// ── Seed helpers (called from server-side on dashboard load) ─────────────────

// Creates a SESSION_STARTING notification if the session starts within 30 min.
// Idempotent — dedup_key prevents duplicates.
export async function seedSessionStartingNotification(
  recipientId: string,
  sessionId:   string,
  groupName:   string,
  scheduledAt: string,
): Promise<void> {
  const minutesUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60_000
  if (minutesUntil < 0 || minutesUntil > 30) return

  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'SESSION_STARTING',
        title:        `Session starting soon — ${groupName}`,
        body:         `Starts in ${Math.round(minutesUntil)} minutes`,
        href:         `/portal/instructor/groups`,
        dedup_key:    `session_starting:${sessionId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Deletes SESSION_STARTING notification for a given group_course_id.
// Called when a session is postponed or cancelled — the notification is no longer valid.
export async function deleteSessionStartingNotification(
  recipientId:   string,
  groupCourseId: string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .delete()
    .eq('recipient_id', recipientId)
    .eq('dedup_key', `session_starting:${groupCourseId}`)
    .eq('type', 'SESSION_STARTING')
}

// Marks SESSION_STARTING notification as read when a session is completed.
export async function readSessionStartingNotification(
  recipientId:   string,
  groupCourseId: string,
): Promise<void> {
  const db = createServiceClient()
  const { data: notif } = await db
    .from('notifications')
    .select('id')
    .eq('recipient_id', recipientId)
    .eq('dedup_key', `session_starting:${groupCourseId}`)
    .eq('type', 'SESSION_STARTING')
    .maybeSingle()

  if (!notif) return

  await db
    .from('notification_reads')
    .upsert(
      { notification_id: (notif as any).id, user_id: recipientId },
      { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
    )
}

// Notifies instructor that a trial session was assigned to them.
export async function seedTrialSessionAssignedNotification(
  recipientId: string,
  sessionId:   string,
  scheduledAt: string,
): Promise<void> {
  const db       = createServiceClient()
  const dateStr  = new Date(scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dedupKey = `trial_assigned:${sessionId}`

  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'TRIAL_SESSION_ASSIGNED',
        title:        `Trial session assigned — ${dateStr}`,
        body:         'A trial session has been assigned to you.',
        href:         `/portal/instructor/special-sessions/${sessionId}`,
        dedup_key:    dedupKey,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies instructor that a standalone makeup session was assigned to them.
export async function seedMakeupSessionAssignedNotification(
  recipientId: string,
  sessionId:   string,
  scheduledAt: string,
): Promise<void> {
  const db       = createServiceClient()
  const dateStr  = new Date(scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dedupKey = `makeup_assigned:${sessionId}`

  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'MAKEUP_SESSION_ASSIGNED',
        title:        `Makeup session assigned — ${dateStr}`,
        body:         'A standalone makeup session has been assigned to you.',
        href:         `/portal/instructor/special-sessions/${sessionId}`,
        dedup_key:    dedupKey,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Seeds a 30-minute reminder for a trial or makeup special session.
// Idempotent — dedup_key prevents duplicates. Called from instructor layout on page load.
export async function seedSpecialSessionReminderNotification(
  recipientId: string,
  sessionId:   string,
  sessionType: 'trial' | 'makeup',
  scheduledAt: string,
): Promise<void> {
  const minutesUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60_000
  if (minutesUntil < 0 || minutesUntil > 30) return

  const db       = createServiceClient()
  const label    = sessionType === 'trial' ? 'Trial' : 'Makeup'
  const dedupKey = `special_session_reminder:${sessionId}`

  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'TRIAL_SESSION_REMINDER',
        title:        `${label} session starting soon`,
        body:         `Starts in ${Math.round(minutesUntil)} minutes`,
        href:         `/portal/instructor/special-sessions/${sessionId}`,
        dedup_key:    dedupKey,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}


// ── Student domain seed helpers (Sprint 2) ────────────────────────────────────

// Notifies a student or parent that a new evaluation was published for them.
export async function seedEvaluationPublishedNotification(
  recipientId:  string,
  evaluationId: string,
  criterionLabel: string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'EVALUATION_PUBLISHED',
        title:        `New evaluation — ${criterionLabel}`,
        body:         'A new evaluation has been recorded.',
        dedup_key:    `evaluation_published:${evaluationId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a student that a note visible to them was added.
export async function seedStudentNoteNotification(
  recipientId: string,
  noteId:      string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'STUDENT_NOTE_SHARED',
        title:        'New note from your instructor',
        dedup_key:    `student_note:${noteId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a parent that a note visible to them was added.
export async function seedParentNoteNotification(
  recipientId: string,
  noteId:      string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'PARENT_NOTE_SHARED',
        title:        'New note about your child',
        dedup_key:    `parent_note:${noteId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a student that they earned a new achievement.
export async function seedAchievementEarnedNotification(
  recipientId:     string,
  achievementId:   string,
  achievementTitle: string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'ACHIEVEMENT_EARNED',
        title:        `Achievement unlocked — ${achievementTitle}`,
        dedup_key:    `achievement_earned:${achievementId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a student/parent of a logged competition result.
export async function seedCompetitionResultNotification(
  recipientId:     string,
  competitionId:   string,
  competitionName: string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'COMPETITION_RESULT',
        title:        `Competition result recorded — ${competitionName}`,
        dedup_key:    `competition_result:${competitionId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a student/parent that new homework was assigned in their group.
export async function seedNewHomeworkAssignedNotification(
  recipientId:  string,
  assignmentId: string,
  title:        string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'NEW_HOMEWORK_ASSIGNED',
        title:        `New homework — ${title}`,
        href:         '/portal/student/assignments',
        dedup_key:    `new_homework:${assignmentId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a student/parent that resources were added to a session in their
// group. Dedup'd per session (not per edit) — resources_links is a
// full-replace array with no stable per-item id, so this fires once when a
// session first gets resources rather than re-notifying on every tweak.
export async function seedNewSessionResourcesNotification(
  recipientId: string,
  sessionId:   string,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'NEW_SESSION_RESOURCES',
        title:        'New session resources available',
        dedup_key:    `session_resources:${sessionId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a parent that their child's attendance was recorded (new record)
// or corrected (status changed) for a session.
export async function seedAttendanceRecordedNotification(
  recipientId: string,
  attendanceRecordId: string,
  status: string,
  groupName: string | null,
): Promise<void> {
  const db = createServiceClient()
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'ATTENDANCE_RECORDED',
        title:        `Attendance recorded — ${label}${groupName ? ` (${groupName})` : ''}`,
        href:         '/portal/parent/attendance',
        dedup_key:    `attendance_recorded:${attendanceRecordId}:${status}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Notifies a parent that a payment was recorded against their child's balance.
export async function seedPaymentRecordedNotification(
  recipientId: string,
  paymentId:   string,
  amount:      number,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'PAYMENT_RECORDED',
        title:        `Payment recorded — EGP ${amount.toLocaleString()}`,
        href:         '/portal/parent/finance',
        dedup_key:    `payment_recorded:${paymentId}:${recipientId}`,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}

// Creates a HOMEWORK_NEEDS_GRADING notification (one per pending batch check).
export async function seedHomeworkNotification(
  recipientId: string,
  pendingCount: number,
): Promise<void> {
  if (pendingCount === 0) return
  const db       = createServiceClient()
  const dedupKey = `homework_pending:${new Date().toISOString().slice(0, 10)}`

  await db
    .from('notifications')
    .upsert(
      {
        recipient_id: recipientId,
        type:         'HOMEWORK_NEEDS_GRADING',
        title:        `${pendingCount} homework submission${pendingCount > 1 ? 's' : ''} need grading`,
        href:         '/portal/instructor/homework',
        dedup_key:    dedupKey,
      },
      { onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true }
    )
}
