import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  StudentEnrollment,
  StudentProgressStats,
  RecentFeedbackItem,
  TimelineEvent,
  StudentDashboardData,
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

// ─── Comprehensive dashboard data ────────────────────────────────────────────
// Single function that loads everything the student dashboard needs.
// Uses safe fallbacks — never throws, never returns "—" for numeric fields.

export async function getStudentDashboardData(
  userId: string
): Promise<StudentDashboardData | null> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return null

  // Student name
  const { data: studentRow } = await db
    .from('students')
    .select('users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', studentId)
    .maybeSingle()
  const sp          = (studentRow as any)?.users?.profiles
  const studentName = [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Student'

  // Active group
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const groupId = (gsRow as any)?.group_id ?? null

  const empty: Omit<StudentDashboardData, 'student_id' | 'student_name'> = {
    group_id: null, group_name: null, course_title: null, instructor_name: null,
    completed_sessions: 0, total_sessions: 0,
    att_present: 0, att_absent: 0, att_late: 0, att_total: 0, att_pct: 0,
    assignments_total: 0, assignments_submitted: 0, assignments_graded: 0, assignments_avg_score: null,
    portfolio_projects: 0, overall_pct: null,
    upcoming_homework: [], recent_feedback: [],
  }
  if (!groupId) return { student_id: studentId, student_name: studentName, ...empty }

  // Group + course info
  const [groupRes, gcRes] = await Promise.all([
    db.from('groups').select('name').eq('id', groupId).maybeSingle(),
    db.from('group_courses')
      .select('id, instructor_id, course_id, courses!group_courses_course_id_fkey(title)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  const gc          = gcRes.data  as any
  const gcId        = gc?.id              ?? null
  const courseTitle = gc?.courses?.title  ?? null
  const instrId     = gc?.instructor_id   ?? null

  // Safe fetch of total_sessions (migration 0042 may not be applied in all envs)
  let totalSessions = 24
  if (gcId) {
    const { data: tsRow } = await db
      .from('group_courses').select('total_sessions').eq('id', gcId).maybeSingle()
    if (tsRow) totalSessions = (tsRow as any).total_sessions ?? 24
  }

  // Instructor name
  let instructorName: string | null = null
  if (instrId) {
    const { data: ir } = await db
      .from('instructors')
      .select('users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
      .eq('id', instrId)
      .maybeSingle()
    const ip = (ir as any)?.users?.profiles
    if (ip) instructorName = [ip.first_name, ip.last_name].filter(Boolean).join(' ') || null
  }

  // Sessions + attendance in parallel
  let scheduleIds:      string[] = []
  let completedSessions          = 0

  if (gcId) {
    const { data: schedRows } = await db
      .from('schedules')
      .select('id, status')
      .eq('group_course_id', gcId)
      .neq('status', 'cancelled')
    scheduleIds      = (schedRows ?? []).map((s: any) => s.id as string)
    completedSessions = (schedRows ?? []).filter((s: any) => s.status === 'completed').length
  }

  // Attendance for this student in this group's sessions
  let attPresent = 0, attAbsent = 0, attLate = 0, attTotal = 0
  if (scheduleIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId)
      .in('schedule_id', scheduleIds)
    for (const a of attRows ?? []) {
      attTotal++
      const st = (a as any).status as string
      if (st === 'present') attPresent++
      else if (st === 'absent') attAbsent++
      else if (st === 'late') attLate++
    }
  }
  const attPct = attTotal > 0
    ? Math.round(((attPresent + attLate) / attTotal) * 100)
    : 0

  // ── Assignment counts — mirrors listStudentAssignments two-path logic ─────────
  // Both legacy module-linked AND session-direct assignments are counted so the
  // dashboard widget matches the full assignments page.
  let assignTotal = 0, assignSubmitted = 0, assignGraded = 0
  let assignAvg: number | null = null
  let upcomingHomework: import('./types').UpcomingHomework[] = []

  const dashAssignIds = new Set<string>()

  // Path A: module-linked (for legacy groups with course_modules)
  // gc is already declared above from gcRes.data
  const dashCourseId = (gcRes.data as any)?.course_id as string | undefined
  if (dashCourseId) {
    const { data: modRows } = await db
      .from('course_modules').select('id').eq('course_id', dashCourseId).is('deleted_at', null)
    const modIds = (modRows ?? []).map((m: any) => m.id as string)
    if (modIds.length > 0) {
      const { data: lesRows } = await db
        .from('lessons').select('id').in('module_id', modIds).is('deleted_at', null)
      const lesIds = (lesRows ?? []).map((l: any) => l.id as string)
      const orParts = [`module_id.in.(${modIds.join(',')})`]
      if (lesIds.length > 0) orParts.push(`lesson_id.in.(${lesIds.join(',')})`)
      const { data: rows } = await db
        .from('assignments').select('id').eq('status', 'published').is('deleted_at', null)
        .or(orParts.join(','))
      for (const a of rows ?? []) dashAssignIds.add((a as any).id as string)
    }
  }

  // Path B: session-direct (for new groups without modules)
  if (scheduleIds.length > 0) {
    const { data: rows } = await db
      .from('assignments').select('id, title, type, due_at')
      .in('schedule_id', scheduleIds)
      .is('module_id', null).is('lesson_id', null)
      .eq('status', 'published').is('deleted_at', null)
    for (const a of rows ?? []) dashAssignIds.add((a as any).id as string)
  }

  if (dashAssignIds.size > 0) {
    const allIds = [...dashAssignIds]
    assignTotal  = allIds.length

    const { data: subRows } = await db
      .from('submissions')
      .select('assignment_id, status, score')
      .eq('student_id', studentId)
      .in('assignment_id', allIds)

    const submittedSet = new Set((subRows ?? []).map((s: any) => s.assignment_id as string))
    assignSubmitted = submittedSet.size

    const gradedRows = (subRows ?? []).filter((s: any) => s.status === 'graded')
    assignGraded = gradedRows.length
    if (gradedRows.length > 0) {
      const total = gradedRows.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0)
      assignAvg   = Math.round((total / gradedRows.length) * 10) / 10
    }

    // Upcoming: session-direct only for "upcoming" widget (those have due dates from sessions)
    if (scheduleIds.length > 0) {
      const now = new Date()
      const { data: upcomingRows } = await db
        .from('assignments').select('id, title, type, due_at')
        .in('schedule_id', scheduleIds)
        .is('module_id', null).is('lesson_id', null)
        .eq('status', 'published').is('deleted_at', null)
      upcomingHomework = (upcomingRows ?? [])
        .filter((a: any) => !submittedSet.has(a.id) && (!a.due_at || new Date(a.due_at) >= now))
        .map((a: any) => ({ id: a.id, title: a.title, due_at: a.due_at ?? null, type: a.type }))
        .slice(0, 5)
    }
  }

  // Portfolio project count
  let portfolioProjects = 0
  const { data: portfolioRow } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (portfolioRow) {
    const { count } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', (portfolioRow as any).id)
      .eq('is_archived', false)
    portfolioProjects = count ?? 0
  }

  // Overall from student_course_progress
  const { data: progressRow } = await db
    .from('student_course_progress')
    .select('completion_percentage')
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .maybeSingle()
  const overallPct = (progressRow as any)?.completion_percentage ?? null

  // Recent feedback (public only)
  const { data: feedbackRows } = await db
    .from('submissions')
    .select('id, score, public_feedback, submitted_at, assignments!submissions_assignment_id_fkey(title, max_score)')
    .eq('student_id', studentId)
    .eq('status', 'graded')
    .not('public_feedback', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(3)

  const recentFeedback: RecentFeedbackItem[] = (feedbackRows ?? []).map((sub: any) => ({
    submission_id:    sub.id,
    assignment_title: sub.assignments?.title     ?? 'Assignment',
    max_score:        sub.assignments?.max_score ?? null,
    score:            sub.score                  ?? null,
    public_feedback:  sub.public_feedback,
    submitted_at:     sub.submitted_at,
  }))

  return {
    student_id:         studentId,
    student_name:       studentName,
    group_id:           groupId,
    group_name:         (groupRes.data as any)?.name ?? null,
    course_title:       courseTitle,
    instructor_name:    instructorName,
    completed_sessions: completedSessions,
    total_sessions:     totalSessions,
    att_present:        attPresent,
    att_absent:         attAbsent,
    att_late:           attLate,
    att_total:          attTotal,
    att_pct:            attPct,
    assignments_total:     assignTotal,
    assignments_submitted: assignSubmitted,
    assignments_graded:    assignGraded,
    assignments_avg_score: assignAvg,
    portfolio_projects:    portfolioProjects,
    overall_pct:           overallPct,
    upcoming_homework:     upcomingHomework,
    recent_feedback:       recentFeedback,
  }
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
    return { student_id: studentId, group_id: null, group_name: null, course_title: null, instructor_name: null }
  }

  // Group name
  const { data: groupRow } = await db
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle()

  // Active group_course — course + instructor only (semester removed from new model).
  // Semester join is intentionally absent: the FK semesters!group_courses_semester_id_fkey
  // is unreliable and was silently poisoning the entire gcRow, causing course and
  // instructor to both show "—" on the student dashboard.
  const { data: gcRow } = await db
    .from('group_courses')
    .select('instructor_id, courses!group_courses_course_id_fkey(title)')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const gc           = gcRow as any
  const instructorId = gc?.instructor_id ?? null

  // Instructor name (separate query to avoid nested-FK failures)
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
    group_name:      (groupRow as any)?.name   ?? null,
    course_title:    gc?.courses?.title         ?? null,
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
