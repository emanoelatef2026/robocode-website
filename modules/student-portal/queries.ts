import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  StudentEnrollment,
  StudentProgressStats,
  RecentFeedbackItem,
  TimelineEvent,
} from './types'

// ─── Shared student-id lookup ─────────────────────────────────────────────────

async function resolveStudentId(userId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as any)?.id ?? null
}

// ─── Current enrollment ───────────────────────────────────────────────────────

export async function getStudentEnrollment(userId: string): Promise<StudentEnrollment | null> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return null

  // Latest active group membership
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const groupId = (gsRow as any)?.group_id ?? null
  if (!groupId) {
    return { student_id: studentId, group_id: null, group_name: null, course_title: null, semester_name: null, instructor_name: null }
  }

  // Group name
  const { data: groupRow } = await db
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle()

  // Active group_course — course + semester + instructor (FK hints confirmed in instructor-portal queries)
  const { data: gcRow } = await db
    .from('group_courses')
    .select(`
      instructor_id,
      courses!group_courses_course_id_fkey(title),
      semesters!group_courses_semester_id_fkey(name)
    `)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const gc           = gcRow as any
  const instructorId = gc?.instructor_id ?? null

  // Instructor name (separate query to avoid unverified nested FK)
  let instructorName: string | null = null
  if (instructorId) {
    const { data: instrRow } = await db
      .from('instructors')
      .select('users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
      .eq('id', instructorId)
      .maybeSingle()
    const prof = (instrRow as any)?.users?.profiles
    if (prof) instructorName = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null
  }

  return {
    student_id:      studentId,
    group_id:        groupId,
    group_name:      (groupRow as any)?.name      ?? null,
    course_title:    gc?.courses?.title            ?? null,
    semester_name:   gc?.semesters?.name           ?? null,
    instructor_name: instructorName,
  }
}

// ─── Progress stats ───────────────────────────────────────────────────────────

export async function getStudentProgressStats(userId: string): Promise<StudentProgressStats | null> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return null

  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const groupId = (gsRow as any)?.group_id ?? null
  if (!groupId) return { attendance_pct: null, assignment_pct: null, portfolio_pct: null, progress_pct: null }

  const { data: p } = await db
    .from('student_course_progress')
    .select('attendance_score, assignment_score, portfolio_score, completion_percentage')
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .maybeSingle()

  return {
    attendance_pct: (p as any)?.attendance_score     ?? null,
    assignment_pct: (p as any)?.assignment_score     ?? null,
    portfolio_pct:  (p as any)?.portfolio_score      ?? null,
    progress_pct:   (p as any)?.completion_percentage ?? null,
  }
}

// ─── Recent feedback (public only — never student_notes) ─────────────────────

export async function getRecentFeedback(userId: string): Promise<RecentFeedbackItem[]> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return []

  const { data: subs } = await db
    .from('submissions')
    .select(`
      id, score, public_feedback, submitted_at,
      assignments!submissions_assignment_id_fkey(title, max_score)
    `)
    .eq('student_id', studentId)
    .eq('status', 'graded')
    .not('public_feedback', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  return (subs ?? []).map((sub: any) => ({
    submission_id:    sub.id,
    assignment_title: sub.assignments?.title     ?? 'Assignment',
    max_score:        sub.assignments?.max_score ?? null,
    score:            sub.score                  ?? null,
    public_feedback:  sub.public_feedback,
    submitted_at:     sub.submitted_at,
  }))
}

// ─── Activity timeline ────────────────────────────────────────────────────────

export async function getStudentTimeline(userId: string): Promise<TimelineEvent[]> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return []

  const events: TimelineEvent[] = []

  // Submissions + gradings
  const { data: subs } = await db
    .from('submissions')
    .select('id, status, score, submitted_at, updated_at, assignments!submissions_assignment_id_fkey(title)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(8)

  for (const sub of (subs ?? []) as any[]) {
    const title = sub.assignments?.title ?? 'Assignment'
    events.push({ id: `sub-${sub.id}`, event_type: 'submitted', title, subtitle: 'Submitted', date: sub.submitted_at })
    if (sub.status === 'graded' && sub.score != null) {
      events.push({ id: `grade-${sub.id}`, event_type: 'graded', title, subtitle: `Graded · ${sub.score} pts`, date: sub.updated_at })
    }
  }

  // Portfolio projects
  const { data: portfolio } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (portfolio) {
    const { data: projects } = await db
      .from('portfolio_projects')
      .select('id, title, created_at')
      .eq('portfolio_id', (portfolio as any).id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5)

    for (const p of (projects ?? []) as any[]) {
      events.push({ id: `proj-${p.id}`, event_type: 'portfolio', title: p.title, subtitle: 'Added to portfolio', date: p.created_at })
    }
  }

  // Certificates
  const { data: certs } = await db
    .from('certificates')
    .select('id, title, issued_at')
    .eq('student_id', studentId)
    .order('issued_at', { ascending: false })
    .limit(5)

  for (const c of (certs ?? []) as any[]) {
    events.push({ id: `cert-${c.id}`, event_type: 'certificate', title: c.title, subtitle: 'Certificate issued', date: c.issued_at })
  }

  return events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
}
