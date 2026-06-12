import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ScheduleStatus } from '@/types/enums'
import { ACADEMICALLY_CONSUMING_SESSION_STATUSES } from './constants'

export function isAcademicallyConsumingSession(status: ScheduleStatus): boolean {
  return ACADEMICALLY_CONSUMING_SESSION_STATUSES.has(status)
}

export function filterAcademicSessions<T extends { status: string }>(sessions: T[]): T[] {
  return sessions.filter(s =>
    ACADEMICALLY_CONSUMING_SESSION_STATUSES.has(s.status as ScheduleStatus)
  )
}

// Read the trigger-maintained completed_sessions column (migration 0034).
// This is the canonical source for how many sessions a group has delivered.
export async function getGroupCompletedSessionCount(groupId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('groups')
    .select('completed_sessions')
    .eq('id', groupId)
    .maybeSingle()
  return (data as any)?.completed_sessions ?? 0
}

// Count completed sessions in a group within a session_number range.
// Mirrors the subquery in v_instructor_allocation_summary (migration 0087).
// Pass toSession=null for an open-ended (current) allocation.
export async function getInstructorCompletedSessionCount(
  groupId: string,
  fromSession: number,
  toSession: number | null,
): Promise<number> {
  const db = createServiceClient()

  // group_courses join needed because session_number lives on schedules, group on group_courses
  const { data: gcRows } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
  const gcIds = (gcRows ?? []).map((r: any) => r.id as string)
  if (!gcIds.length) return 0

  let q = db
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .in('group_course_id', gcIds)
    .eq('status', 'completed')
    .gte('session_number', fromSession)

  if (toSession != null) q = q.lte('session_number', toSession)

  const { count } = await q
  return count ?? 0
}

// Count consumption ledger entries for a student+enrollment pair.
// Stale entries are hard-deleted by reconcile_cancelled_session_attendance (migration 0088),
// so a plain count is safe — no need to filter by invalidated_at.
export async function getStudentConsumedSessionCount(
  studentId: string,
  enrollmentId: string,
): Promise<number> {
  const db = createServiceClient()
  const { count } = await db
    .from('attendance_consumptions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('enrollment_id', enrollmentId)
  return count ?? 0
}
