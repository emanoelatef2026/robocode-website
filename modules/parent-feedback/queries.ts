import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface ParentFeedbackRecord {
  id:                string
  session_milestone: number
  q1_yes:            boolean
  q2_yes:            boolean
  q3_yes:            boolean
  q4_yes:            boolean
  rating:            number
  notes:             string | null
  submitted_at:      string
}

// ── Resolve parent id from user id ────────────────────────────────────────────

async function resolveParentId(userId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as any)?.id ?? null
}

// ── Get all submitted milestones for a parent+student pair ────────────────────

export async function getSubmittedMilestones(
  parentUserId: string,
  studentId:    string
): Promise<number[]> {
  const parentId = await resolveParentId(parentUserId)
  if (!parentId) return []

  const db = createServiceClient()
  const { data } = await db
    .from('parent_feedback')
    .select('session_milestone')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)

  return (data ?? []).map((r: any) => r.session_milestone as number)
}

// ── Get the next pending feedback milestone (if any) ─────────────────────────
// Returns the smallest multiple-of-6 milestone that has passed (completed
// sessions >= milestone) but has not yet been submitted.

export async function getPendingFeedbackMilestone(
  parentUserId:      string,
  studentId:         string,
  completedSessions: number
): Promise<number | null> {
  if (completedSessions < 6) return null

  const submitted = await getSubmittedMilestones(parentUserId, studentId)
  const submittedSet = new Set(submitted)

  for (let m = 6; m <= completedSessions; m += 6) {
    if (!submittedSet.has(m)) return m
  }
  return null
}

// ── Get all feedback submitted by this parent for this student ────────────────

export async function getParentFeedbackHistory(
  parentUserId: string,
  studentId:    string
): Promise<ParentFeedbackRecord[]> {
  const parentId = await resolveParentId(parentUserId)
  if (!parentId) return []

  const db = createServiceClient()
  const { data } = await db
    .from('parent_feedback')
    .select('id, session_milestone, q1_yes, q2_yes, q3_yes, q4_yes, rating, notes, submitted_at')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .order('session_milestone', { ascending: true })

  return (data ?? []) as ParentFeedbackRecord[]
}

// ── TL analytics: aggregate all feedback (optionally filtered) ────────────────

export interface ParentFeedbackAggregate {
  total_responses:     number
  avg_rating:          number
  recommend_pct:       number   // q4_yes %
  communication_pct:   number   // q3_yes %
  skill_growth_pct:    number   // q1_yes %
  excitement_pct:      number   // q2_yes %
}

export interface ParentFeedbackAnalyticsRow {
  id:                string
  session_milestone: number
  q1_yes:            boolean
  q2_yes:            boolean
  q3_yes:            boolean
  q4_yes:            boolean
  rating:            number
  notes:             string | null
  submitted_at:      string
  student_id:        string
  student_name:      string
  branch_name:       string | null
  course_title:      string | null
}

export async function getParentFeedbackAnalytics(filters: {
  branchId?:    string
  courseId?:    string
  instructorId?: string
  from?:        string
  to?:          string
} = {}): Promise<{
  aggregate: ParentFeedbackAggregate
  rows:      ParentFeedbackAnalyticsRow[]
}> {
  const db = createServiceClient()

  let query = db
    .from('parent_feedback')
    .select(`
      id, session_milestone, q1_yes, q2_yes, q3_yes, q4_yes, rating, notes, submitted_at,
      student_id,
      students!parent_feedback_student_id_fkey(
        users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)),
        branches!students_branch_id_fkey(name)
      )
    `)
    .order('submitted_at', { ascending: false })

  if (filters.from) query = query.gte('submitted_at', filters.from)
  if (filters.to)   query = query.lte('submitted_at', filters.to)

  const { data } = await query
  const rows: ParentFeedbackAnalyticsRow[] = (data ?? []).map((r: any) => {
    const s    = r.students
    const prof = s?.users?.profiles
    const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || 'Student'
    return {
      id:                r.id,
      session_milestone: r.session_milestone,
      q1_yes:            r.q1_yes,
      q2_yes:            r.q2_yes,
      q3_yes:            r.q3_yes,
      q4_yes:            r.q4_yes,
      rating:            r.rating,
      notes:             r.notes ?? null,
      submitted_at:      r.submitted_at,
      student_id:        r.student_id,
      student_name:      name,
      branch_name:       s?.branches?.name ?? null,
      course_title:      null,
    }
  })

  // Apply branch filter post-fetch (easier than deep nested filter)
  const filtered = filters.branchId
    ? rows.filter(r => {
        const s = (data as any[])?.find((d: any) => d.id === r.id)
        return s?.students?.branches?.id === filters.branchId
      })
    : rows

  const n = filtered.length
  if (n === 0) {
    return {
      aggregate: { total_responses: 0, avg_rating: 0, recommend_pct: 0, communication_pct: 0, skill_growth_pct: 0, excitement_pct: 0 },
      rows:      [],
    }
  }

  const aggregate: ParentFeedbackAggregate = {
    total_responses:   n,
    avg_rating:        Math.round((filtered.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10,
    recommend_pct:     Math.round(filtered.filter(r => r.q4_yes).length / n * 100),
    communication_pct: Math.round(filtered.filter(r => r.q3_yes).length / n * 100),
    skill_growth_pct:  Math.round(filtered.filter(r => r.q1_yes).length / n * 100),
    excitement_pct:    Math.round(filtered.filter(r => r.q2_yes).length / n * 100),
  }

  return { aggregate, rows: filtered }
}
