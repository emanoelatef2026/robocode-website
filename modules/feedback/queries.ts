import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveActiveGroupIds } from '@/modules/academic/enrollment-integrity'
import type {
  SessionFeedbackAggregate,
  InstructorRatingSummary,
} from './types'

export const FEEDBACK_ELIGIBLE_ATTENDANCE_STATUSES = ['present', 'late', 'makeup'] as const

export function isFeedbackEligibleAttendanceStatus(status: string | null | undefined): boolean {
  return FEEDBACK_ELIGIBLE_ATTENDANCE_STATUSES.includes(status as typeof FEEDBACK_ELIGIBLE_ATTENDANCE_STATUSES[number])
}

// ── Check if a student has already submitted feedback for a session ────────────

export async function hasStudentSubmittedFeedback(
  studentId:  string,
  scheduleId: string
): Promise<boolean> {
  const db = createServiceClient()
  const { data } = await db
    .from('session_feedback')
    .select('id')
    .eq('student_id', studentId)
    .eq('schedule_id', scheduleId)
    .maybeSingle()
  return !!data
}

// ── Get recently completed sessions for a student that need feedback ──────────

export async function getPendingFeedbackSessions(
  studentId: string,
  limit = 3
): Promise<Array<{ schedule_id: string; group_name: string; topic: string | null; scheduled_at: string }>> {
  const db = createServiceClient()

  // Every concurrently active group, not just one — a pending-feedback
  // session in a second concurrent course must still surface here.
  const activeGroupIds = await resolveActiveGroupIds(db, studentId)
  if (activeGroupIds.length === 0) return []

  const { data: gcRows } = await db
    .from('group_courses')
    .select('id, group_id')
    .in('group_id', activeGroupIds)
  const gcRowsData = (gcRows ?? []) as { id: string; group_id: string }[]
  if (gcRowsData.length === 0) return []

  const gcIds        = gcRowsData.map(gc => gc.id)
  const groupIdByGc  = new Map(gcRowsData.map(gc => [gc.id, gc.group_id]))

  // Pending feedback must not expire after a fixed number of days. A student
  // may log in later, and the request should remain until it is submitted.
  const { data: schedRows } = await db
    .from('schedules')
    .select('id, scheduled_at, group_course_id')
    .in('group_course_id', gcIds)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    // Filter by the student's attendance below before applying the UI limit.
    // Limiting here could fill the page with absent/already-reviewed sessions
    // and hide an older session that still needs feedback.
    .limit(Math.max(limit * 10, 30))

  if (!schedRows || schedRows.length === 0) return []

  const schedIds = schedRows.map((s: any) => s.id as string)

  // A review belongs to a student who attended the session, not merely to
  // every current group member. This also keeps feedback available after a
  // group/course is completed or the student's membership is later changed.
  const { data: attendanceRows } = await db
    .from('attendance_records')
    .select('schedule_id, status')
    .eq('student_id', studentId)
    .in('schedule_id', schedIds)
  const attendedIds = new Set(
    (attendanceRows ?? [])
      .filter((r: any) => isFeedbackEligibleAttendanceStatus(r.status))
      .map((r: any) => r.schedule_id as string)
  )
  if (attendedIds.size === 0) return []

  // Exclude sessions where student already submitted feedback
  const { data: submitted } = await db
    .from('session_feedback')
    .select('schedule_id')
    .eq('student_id', studentId)
    .in('schedule_id', schedIds)
  const submittedIds = new Set((submitted ?? []).map((r: any) => r.schedule_id as string))

  // Get topics (safe enrichment)
  const topicMap = new Map<string, string | null>()
  const { data: enrichRows } = await db
    .from('schedules').select('id, topic').in('id', schedIds)
  for (const r of enrichRows ?? []) topicMap.set((r as any).id, (r as any).topic ?? null)

  // Group names for every surfaced group
  const groupIds = [...new Set(gcRowsData.map(gc => gc.group_id))]
  const { data: groupRows } = await db.from('groups').select('id, name').in('id', groupIds)
  const groupNameById = new Map(((groupRows ?? []) as any[]).map(g => [g.id as string, g.name as string]))

  return schedRows
    .filter((s: any) => attendedIds.has(s.id) && !submittedIds.has(s.id))
    .slice(0, limit)
    .map((s: any) => ({
      schedule_id:  s.id,
      group_name:   groupNameById.get(groupIdByGc.get(s.group_course_id) ?? '') ?? '',
      topic:        topicMap.get(s.id) ?? null,
      scheduled_at: s.scheduled_at,
    }))
}

// ── Aggregate feedback for a session (instructor-safe: no individual data) ────

export async function getSessionFeedbackAggregate(
  scheduleId: string
): Promise<SessionFeedbackAggregate | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('session_feedback')
    .select('q1_score, q2_score, q3_score')
    .eq('schedule_id', scheduleId)

  if (!data || data.length === 0) return null

  const n = data.length
  const avg = (field: 'q1_score' | 'q2_score' | 'q3_score') =>
    Math.round((data.reduce((sum, r: any) => sum + (r[field] as number), 0) / n) * 10) / 10

  const avgQ1 = avg('q1_score')
  const avgQ2 = avg('q2_score')
  const avgQ3 = avg('q3_score')

  return {
    schedule_id:     scheduleId,
    total_responses: n,
    avg_overall:     Math.round(((avgQ1 + avgQ2 + avgQ3) / 3) * 10) / 10,
    avg_q1:          avgQ1,
    avg_q2:          avgQ2,
    avg_q3:          avgQ3,
  }
}

// ── Instructor overall rating (aggregate across all their sessions) ────────────

export async function getInstructorRatingSummary(
  instructorId: string
): Promise<InstructorRatingSummary | null> {
  const db = createServiceClient()

  // Get all group_course ids for this instructor
  const { data: gcRows } = await db
    .from('group_courses')
    .select('id')
    .eq('instructor_id', instructorId)
    .eq('status', 'active')

  const gcIds = (gcRows ?? []).map((r: any) => r.id as string)
  if (gcIds.length === 0) return null

  // Get all completed sessions
  const { data: schedRows } = await db
    .from('schedules')
    .select('id')
    .in('group_course_id', gcIds)
    .eq('status', 'completed')

  const schedIds = (schedRows ?? []).map((r: any) => r.id as string)
  if (schedIds.length === 0) return null

  // Get all feedback
  const { data: feedback } = await db
    .from('session_feedback')
    .select('q1_score, q2_score, q3_score')
    .in('schedule_id', schedIds)

  if (!feedback || feedback.length === 0) return null

  const n = feedback.length
  const sum = feedback.reduce(
    (acc, r: any) => ({
      q1: acc.q1 + (r.q1_score as number),
      q2: acc.q2 + (r.q2_score as number),
      q3: acc.q3 + (r.q3_score as number),
    }),
    { q1: 0, q2: 0, q3: 0 }
  )

  const avgQ1 = Math.round((sum.q1 / n) * 10) / 10
  const avgQ2 = Math.round((sum.q2 / n) * 10) / 10
  const avgQ3 = Math.round((sum.q3 / n) * 10) / 10

  return {
    instructor_id:   instructorId,
    total_responses: n,
    avg_overall:     Math.round(((avgQ1 + avgQ2 + avgQ3) / 3) * 10) / 10,
    avg_q1:          avgQ1,
    avg_q2:          avgQ2,
    avg_q3:          avgQ3,
  }
}
