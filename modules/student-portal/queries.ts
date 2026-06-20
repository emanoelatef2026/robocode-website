import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  StudentEnrollment,
  StudentProgressStats,
  RecentFeedbackItem,
  TimelineEvent,
  StudentDashboardData,
  StudentAttendanceRecord,
  CertificateEligibility,
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
    day_of_week: null, group_time: null,
    enrollment_id: null, enrolled_sessions: 0, consumed_sessions: 0, remaining_sessions: 0,
    att_present: 0, att_absent: 0, att_late: 0, att_total: 0, att_pct: 0,
    assignments_total: 0, assignments_submitted: 0, assignments_graded: 0, assignments_avg_score: null,
    portfolio_projects: 0, portfolio_reviewed: 0, overall_pct: null,
    upcoming_homework: [], recent_feedback: [],
  }
  if (!groupId) return { student_id: studentId, student_name: studentName, ...empty }

  // Group + course info
  // Fetch ALL group_courses (active AND inactive) — mirrors getGroupSchedules which
  // deliberately has no status filter so sessions from replaced/inactive courses are
  // visible.  We still prefer an active non-placeholder course for display purposes.
  const [groupRes, gcListRes] = await Promise.all([
    db.from('groups').select('name, day_of_week, time').eq('id', groupId).maybeSingle(),
    db.from('group_courses')
      .select('id, status, instructor_id, course_id, courses!group_courses_course_id_fkey(title)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ])

  const gcList   = (gcListRes.data ?? []) as any[]
  const allGcIds = gcList.map((gc: any) => gc.id as string)
  // For display: prefer active + real course, then active placeholder, then any real, then any
  const primaryGc =
    gcList.find((gc: any) => gc.status === 'active' && gc.courses?.title && gc.courses.title !== 'General Sessions') ??
    gcList.find((gc: any) => gc.status === 'active') ??
    gcList.find((gc: any) => gc.courses?.title && gc.courses.title !== 'General Sessions') ??
    gcList[0] ?? null
  const courseTitle  = primaryGc?.courses?.title ?? null
  const instrId      = primaryGc?.instructor_id  ?? null

  // ── Enrollment-scoped session progress ───────────────────────────────────────
  // Use the student's purchased enrollment, NOT group.total_sessions.
  // Prefer enrollment linked to this group; fall back to any ACTIVE enrollment (FIFO).
  let enrollmentId:        string | null = null
  let enrolledSessions     = 0
  let consumedSessions     = 0
  let remainingSessions    = 0
  let enrollmentStartDate: string | null = null

  {
    const { data: enrRow } = await db
      .from('student_enrollments')
      .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, start_date')
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const e = (enrRow as any) ?? null
    if (e) {
      enrollmentId         = e.id
      enrolledSessions     = Number(e.enrolled_sessions  ?? 0)
      consumedSessions     = Number(e.consumed_sessions  ?? 0)
      remainingSessions    = Number(e.remaining_sessions ?? 0)
      enrollmentStartDate  = e.start_date ?? null
    } else {
      // Fallback: any ACTIVE enrollment for this student
      const { data: fallbackRow } = await db
        .from('student_enrollments')
        .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, start_date')
        .eq('student_id', studentId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      const f = (fallbackRow as any) ?? null
      if (f) {
        enrollmentId         = f.id
        enrolledSessions     = Number(f.enrolled_sessions  ?? 0)
        consumedSessions     = Number(f.consumed_sessions  ?? 0)
        remainingSessions    = Number(f.remaining_sessions ?? 0)
        enrollmentStartDate  = f.start_date ?? null
      }
    }
  }

  // Instructor name — try group_courses.instructor_id first, then group_instructors
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
  // Fallback: group_instructors table (TL assigns instructor at the group level)
  if (!instructorName) {
    const { data: giRows } = await db
      .from('group_instructors')
      .select('role, instructors!group_instructors_instructor_id_fkey(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))')
      .eq('group_id', groupId)
    const gis = (giRows ?? []) as any[]
    const gi  = gis.find((r: any) => r.role === 'lead') ?? gis[0] ?? null
    const ip  = gi?.instructors?.users?.profiles
    if (ip) instructorName = [ip.first_name, ip.last_name].filter(Boolean).join(' ') || null
  }

  // Sessions — scoped to the student's enrollment window.
  // scheduleIds:          non-cancelled sessions (for assignment queries)
  // completedScheduleIds: completed sessions only (for attendance stats)
  // Both are filtered to sessions on/after enrollmentStartDate so we never count
  // sessions from before the student's package started.
  let scheduleIds:          string[] = []
  let completedScheduleIds: string[] = []

  if (allGcIds.length > 0) {
    let schedQuery = db
      .from('schedules')
      .select('id, status, scheduled_at')
      .in('group_course_id', allGcIds)
      .neq('status', 'cancelled')

    if (enrollmentStartDate) {
      schedQuery = schedQuery.gte('scheduled_at', enrollmentStartDate)
    }

    const { data: schedRows } = await schedQuery
    const rows = schedRows ?? []
    scheduleIds          = rows.map((s: any) => s.id as string)
    completedScheduleIds = rows.filter((s: any) => s.status === 'completed').map((s: any) => s.id as string)
  }

  // Attendance — only completed sessions in the enrollment window.
  // Invalidated records (cancelled session backfill) are excluded.
  let attPresent = 0, attAbsent = 0, attLate = 0, attTotal = 0
  if (completedScheduleIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('status')
      .eq('student_id', studentId)
      .in('schedule_id', completedScheduleIds)
      .is('invalidated_at', null)
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
  const dashCourseId = primaryGc?.course_id as string | undefined
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
  let portfolioProjects  = 0
  let portfolioReviewed  = 0
  const { data: portfolioRow } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (portfolioRow) {
    const [totalRes, reviewedRes] = await Promise.all([
      db.from('portfolio_projects')
        .select('id', { count: 'exact', head: true })
        .eq('portfolio_id', (portfolioRow as any).id)
        .eq('is_archived', false),
      db.from('portfolio_projects')
        .select('id', { count: 'exact', head: true })
        .eq('portfolio_id', (portfolioRow as any).id)
        .eq('is_archived', false)
        .eq('status', 'approved'),
    ])
    portfolioProjects = totalRes.count ?? 0
    portfolioReviewed = reviewedRes.count ?? 0
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

  const gRow = groupRes.data as any
  return {
    student_id:         studentId,
    student_name:       studentName,
    group_id:           groupId,
    group_name:         gRow?.name        ?? null,
    course_title:       courseTitle,
    instructor_name:    instructorName,
    day_of_week:        gRow?.day_of_week ?? null,
    group_time:         gRow?.time        ?? null,
    enrollment_id:      enrollmentId,
    enrolled_sessions:  enrolledSessions,
    consumed_sessions:  consumedSessions,
    remaining_sessions: remainingSessions,
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
    portfolio_reviewed:    portfolioReviewed,
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

  // Instructor name — try group_courses.instructor_id first, then group_instructors
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
  if (!instructorName) {
    const { data: giRows } = await db
      .from('group_instructors')
      .select('role, instructors!group_instructors_instructor_id_fkey(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))')
      .eq('group_id', groupId)
    const gis = (giRows ?? []) as any[]
    const gi  = gis.find((r: any) => r.role === 'lead') ?? gis[0] ?? null
    const ip  = gi?.instructors?.users?.profiles
    if (ip) instructorName = [ip.first_name, ip.last_name].filter(Boolean).join(' ') || null
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

  // Resolve active group + gc for session numbering
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const groupId = (gsRow as any)?.group_id ?? null

  const schedNumMap = new Map<string, number>()
  const topicMap    = new Map<string, string | null>()

  if (groupId) {
    // Use ALL group_courses (active AND inactive) so sessions from replaced/inactive
    // courses appear in the timeline — mirrors getGroupSchedules behavior.
    const { data: gcRows } = await db
      .from('group_courses')
      .select('id')
      .eq('group_id', groupId)
    const allGcIds = (gcRows ?? []).map((r: any) => r.id as string)

    if (allGcIds.length > 0) {
      // Only completed sessions appear in the student-visible timeline.
      const { data: schedRows } = await db
        .from('schedules')
        .select('id, scheduled_at, session_number')
        .in('group_course_id', allGcIds)
        .eq('status', 'completed')
        .order('scheduled_at', { ascending: true })
      ;(schedRows ?? []).forEach((s: any, idx: number) => {
        schedNumMap.set(s.id, (s as any).session_number ?? (idx + 1))
      })

      // Safe topic enrichment
      const schedIds = (schedRows ?? []).map((s: any) => s.id as string)
      if (schedIds.length > 0) {
        const { data: enrichRows } = await db
          .from('schedules').select('id, topic').in('id', schedIds)
        for (const r of enrichRows ?? []) topicMap.set((r as any).id, (r as any).topic ?? null)
      }
    }
  }

  // Attendance events — only sessions in schedNumMap (completed sessions).
  // Records on cancelled/postponed sessions are silently skipped.
  const { data: attRows } = await db
    .from('attendance_records')
    .select('id, schedule_id, status, recorded_at')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(15)

  for (const a of (attRows ?? []) as any[]) {
    if (!schedNumMap.has(a.schedule_id)) continue  // skip non-completed sessions
    const num   = schedNumMap.get(a.schedule_id) ?? null
    const topic = topicMap.get(a.schedule_id) ?? null
    const label = num ? `Session ${num}` : 'Session'
    const title = topic ? `${label}: ${topic}` : label
    if (a.status === 'present' || a.status === 'late' || a.status === 'makeup') {
      events.push({ id: `att-${a.id}`, event_type: 'attended', title, subtitle: `${a.status === 'late' ? 'Late' : 'Attended'}`, date: a.recorded_at })
    } else if (a.status === 'absent') {
      events.push({ id: `att-${a.id}`, event_type: 'missed', title, subtitle: 'Absent', date: a.recorded_at })
    }
  }

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
    .slice(0, 30)
}

// ─── Student attendance history (session-by-session) ──────────────────────────

export async function getStudentAttendanceHistory(userId: string): Promise<StudentAttendanceRecord[]> {
  const db        = createServiceClient()
  const studentId = await resolveStudentId(userId)
  if (!studentId) return []

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

  // Fetch ALL group_courses (active AND inactive) — matches getGroupSchedules so
  // sessions recorded under a replaced/inactive course are included.
  const { data: gcRows } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
  const allGcIds = (gcRows ?? []).map((r: any) => r.id as string)
  if (allGcIds.length === 0) return []

  // Only completed sessions are academically visible to students.
  // Filtered to the student's enrollment window (sessions on/after the earliest
  // enrollment start_date) so pre-enrollment sessions are excluded.
  // session_number is the canonical immutable number from the DB (migration 0085).

  const { data: enrollRow } = await db
    .from('student_enrollments')
    .select('start_date')
    .eq('student_id', studentId)
    .in('status', ['ACTIVE', 'COMPLETED', 'DROPPED', 'TRANSFERRED', 'PAUSED', 'CANCELLED'])
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  const enrollmentStartDate = (enrollRow as any)?.start_date ?? null

  let schedQuery = db
    .from('schedules')
    .select('id, scheduled_at, session_number')
    .in('group_course_id', allGcIds)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: true })

  if (enrollmentStartDate) {
    schedQuery = schedQuery.gte('scheduled_at', enrollmentStartDate)
  }

  const { data: schedRows } = await schedQuery

  if (!schedRows || schedRows.length === 0) return []

  const schedIds = schedRows.map((s: any) => s.id as string)
  const dateMap  = new Map((schedRows as any[]).map((s, idx) => [
    s.id as string,
    {
      num:  (s as any).session_number ?? (idx + 1),
      date: s.scheduled_at,
    },
  ]))

  // Safe topic enrichment
  const topicMap = new Map<string, string | null>()
  const { data: enrichRows } = await db
    .from('schedules').select('id, topic').in('id', schedIds)
  for (const r of enrichRows ?? []) topicMap.set((r as any).id, (r as any).topic ?? null)

  // Attendance records — exclude invalidated (cancelled session backfill)
  const { data: attRows } = await db
    .from('attendance_records')
    .select('schedule_id, status')
    .eq('student_id', studentId)
    .in('schedule_id', schedIds)
    .is('invalidated_at', null)
  const attStatusMap = new Map((attRows ?? []).map((a: any) => [a.schedule_id as string, a.status as string]))

  return schedRows.map((s: any) => ({
    session_num: dateMap.get(s.id)!.num,
    date:        dateMap.get(s.id)!.date,
    topic:       topicMap.get(s.id) ?? null,
    status:      attStatusMap.get(s.id) ?? null,
  })).reverse() // newest first
}

// ─── Certificate eligibility ──────────────────────────────────────────────────

export async function getCertificateEligibility(userId: string): Promise<CertificateEligibility | null> {
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
  if (!groupId) return null

  const [groupRes, gcRes] = await Promise.all([
    db.from('groups').select('name').eq('id', groupId).maybeSingle(),
    db.from('group_courses')
      .select('id, courses!group_courses_course_id_fkey(title)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  // Active enrollment — prefer group-linked, fallback to any ACTIVE (FIFO)
  let enrolledSessions  = 0
  let consumedSessions  = 0
  let remainingSessions = 0

  {
    const { data: enrRow } = await db
      .from('student_enrollments')
      .select('enrolled_sessions, consumed_sessions, remaining_sessions')
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const e = (enrRow as any) ?? null
    if (e) {
      enrolledSessions  = Number(e.enrolled_sessions  ?? 0)
      consumedSessions  = Number(e.consumed_sessions  ?? 0)
      remainingSessions = Number(e.remaining_sessions ?? 0)
    } else {
      const { data: fallbackRow } = await db
        .from('student_enrollments')
        .select('enrolled_sessions, consumed_sessions, remaining_sessions')
        .eq('student_id', studentId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const f = (fallbackRow as any) ?? null
      if (f) {
        enrolledSessions  = Number(f.enrolled_sessions  ?? 0)
        consumedSessions  = Number(f.consumed_sessions  ?? 0)
        remainingSessions = Number(f.remaining_sessions ?? 0)
      }
    }
  }

  const isEligible = enrolledSessions > 0 && consumedSessions >= enrolledSessions

  return {
    is_eligible:        isEligible,
    consumed_sessions:  consumedSessions,
    enrolled_sessions:  enrolledSessions,
    sessions_remaining: remainingSessions,
    group_name:         (groupRes.data as any)?.name ?? null,
    course_title:       (gcRes.data as any)?.courses?.title ?? null,
  }
}
