import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  SessionFeedbackAggregate,
  InstructorRatingSummary,
} from './types'

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

  // Get active group's gc
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const groupId = (gsRow as any)?.group_id ?? null
  if (!groupId) return []

  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  const gcId = (gcRow as any)?.id ?? null
  if (!gcId) return []

  // Recently completed sessions
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: schedRows } = await db
    .from('schedules')
    .select('id, scheduled_at')
    .eq('group_course_id', gcId)
    .eq('status', 'completed')
    .gte('scheduled_at', cutoff)
    .order('scheduled_at', { ascending: false })
    .limit(limit)

  if (!schedRows || schedRows.length === 0) return []

  const schedIds = schedRows.map((s: any) => s.id as string)

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

  // Get group name
  const { data: groupRow } = await db.from('groups').select('name').eq('id', groupId).maybeSingle()
  const groupName = (groupRow as any)?.name ?? ''

  return schedRows
    .filter((s: any) => !submittedIds.has(s.id))
    .map((s: any) => ({
      schedule_id:  s.id,
      group_name:   groupName,
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
