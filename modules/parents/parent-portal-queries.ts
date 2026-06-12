import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudentCourseProgress } from '@/modules/progress/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParentChildSummary {
  student_id:    string
  student_name:  string
  student_email: string
  branch_name:   string
}

export interface ChildEnrollment {
  student_id:      string
  group_id:        string | null
  group_name:      string | null
  course_title:    string | null
  instructor_name: string | null
}

export interface ChildProgressStats {
  attendance_pct: number | null
  assignment_pct: number | null
  portfolio_pct:  number | null
  progress_pct:   number | null
}

export interface AttendanceSummary {
  present:        number
  absent:         number
  late:           number
  excused:        number
  makeup:         number
  total:          number
  attendance_pct: number
}

export interface AttendanceRecord {
  id:           string
  status:       string
  note:         string | null
  recorded_at:  string
  class_date:   string | null
  course_title: string | null
}

export interface ChildAttendanceData {
  summary: AttendanceSummary
  records: AttendanceRecord[]
}

export interface ParentAssignmentItem {
  id:                      string
  title:                   string
  type:                    string
  submission_type:         string
  due_at:                  string | null
  max_score:               number
  course_title:            string | null
  module_title:            string | null
  submission_id:           string | null
  submission_status:       string | null
  submission_score:        number | null
  submission_submitted_at: string | null
  is_late:                 boolean
  public_feedback:         string | null   // Only public feedback — never private notes
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function resolveParentId(userId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as any)?.id ?? null
}

async function verifyParentChild(parentUserId: string, studentId: string): Promise<boolean> {
  const parentId = await resolveParentId(parentUserId)
  if (!parentId) return false

  const db = createServiceClient()
  const { data } = await db
    .from('parent_students')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle()
  return !!data
}

// ── Linked children list (sidebar + page default) ─────────────────────────────

export async function getParentChildren(userId: string): Promise<ParentChildSummary[]> {
  const parentId = await resolveParentId(userId)
  if (!parentId) return []

  const db = createServiceClient()
  const { data } = await db
    .from('parent_students')
    .select(`
      student_id,
      students!parent_students_student_id_fkey(
        users!students_user_id_fkey(
          email,
          profiles!profiles_user_id_fkey(first_name, last_name)
        ),
        branches!students_branch_id_fkey(name)
      )
    `)
    .eq('parent_id', parentId)

  return (data ?? []).map((row: any) => {
    const s         = row.students
    const firstName = s?.users?.profiles?.first_name ?? ''
    const lastName  = s?.users?.profiles?.last_name  ?? ''
    return {
      student_id:    row.student_id,
      student_name:  [firstName, lastName].filter(Boolean).join(' ') || s?.users?.email || 'Student',
      student_email: s?.users?.email ?? '',
      branch_name:   s?.branches?.name ?? '',
    }
  })
}

// ── Current enrollment ────────────────────────────────────────────────────────

export async function getChildEnrollment(
  parentUserId: string,
  studentId:    string
): Promise<ChildEnrollment | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()

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

  const [{ data: groupRow }, { data: gcRow }] = await Promise.all([
    db.from('groups').select('name').eq('id', groupId).maybeSingle(),
    // Semester join removed — the FK semesters!group_courses_semester_id_fkey is
    // unreliable and was silently returning null for the entire gcRow (same bug as
    // student-portal/queries.ts getStudentEnrollment).
    db.from('group_courses')
      .select('instructor_id, courses!group_courses_course_id_fkey(title)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  const gc           = gcRow as any
  const instructorId = gc?.instructor_id ?? null

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
    group_name:      (groupRow as any)?.name ?? null,
    course_title:    gc?.courses?.title       ?? null,
    instructor_name: instructorName,
  }
}

// ── Progress stats (from current active group) ────────────────────────────────

export async function getChildProgressStats(
  parentUserId: string,
  studentId:    string
): Promise<ChildProgressStats | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()

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
    attendance_pct: (p as any)?.attendance_score      ?? null,
    assignment_pct: (p as any)?.assignment_score      ?? null,
    portfolio_pct:  (p as any)?.portfolio_score       ?? null,
    progress_pct:   (p as any)?.completion_percentage ?? null,
  }
}

// ── Attendance records (no private notes) ────────────────────────────────────

export async function getChildAttendance(
  parentUserId: string,
  studentId:    string
): Promise<ChildAttendanceData | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()
  const { data } = await db
    .from('attendance_records')
    .select(`
      id, status, notes, recorded_at,
      schedules!attendance_records_schedule_id_fkey(
        scheduled_at, status,
        group_courses!schedules_group_course_id_fkey(
          courses!group_courses_course_id_fkey(title)
        )
      )
    `)
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })

  // Only show attendance from academically consuming (completed) sessions.
  // Cancelled / postponed sessions are invisible to parents.
  const rows = ((data ?? []) as any[]).filter(r => r.schedules?.status === 'completed')

  const attendedStatuses = ['present', 'late', 'makeup']
  const attended = rows.filter(r => attendedStatuses.includes(r.status)).length

  const summary: AttendanceSummary = {
    present:        rows.filter(r => r.status === 'present').length,
    absent:         rows.filter(r => r.status === 'absent').length,
    late:           rows.filter(r => r.status === 'late').length,
    excused:        rows.filter(r => r.status === 'excused').length,
    makeup:         rows.filter(r => r.status === 'makeup').length,
    total:          rows.length,
    attendance_pct: rows.length > 0 ? Math.round(attended / rows.length * 100) : 0,
  }

  const records: AttendanceRecord[] = rows.map(row => {
    const gc = row.schedules?.group_courses
    return {
      id:           row.id,
      status:       row.status,
      note:         row.notes ?? null,
      recorded_at:  row.recorded_at,
      class_date:   row.schedules?.scheduled_at ?? null,
      course_title: gc?.courses?.title ?? null,
    }
  })

  return { summary, records }
}

// ── Assignments — only public feedback exposed ────────────────────────────────

export async function getChildAssignments(
  parentUserId: string,
  studentId:    string
): Promise<ParentAssignmentItem[]> {
  if (!(await verifyParentChild(parentUserId, studentId))) return []

  const db = createServiceClient()

  const { data: groupRows } = await db
    .from('group_students').select('group_id').eq('student_id', studentId).eq('status', 'active')
  const groupIds = (groupRows ?? []).map((g: any) => g.group_id as string)
  if (!groupIds.length) return []

  const { data: gcRows } = await db
    .from('group_courses').select('id, course_id').in('group_id', groupIds).eq('status', 'active')
  const gcIds     = (gcRows ?? []).map((gc: any) => gc.id       as string)
  const courseIds = [...new Set((gcRows ?? []).map((gc: any) => gc.course_id as string))]

  // Maps for session-direct assignment course title resolution
  const gcIdToCourseId:  Record<string, string> = {}
  const courseIdToTitle: Record<string, string> = {}
  const schedIdToGcId:   Record<string, string> = {}

  for (const gc of gcRows ?? []) gcIdToCourseId[(gc as any).id] = (gc as any).course_id
  if (courseIds.length > 0) {
    const { data: courseRows } = await db.from('courses').select('id, title').in('id', courseIds)
    for (const c of courseRows ?? []) courseIdToTitle[(c as any).id] = (c as any).title
  }

  const allAssignmentIds = new Set<string>()

  // ── Path A: module/lesson-linked (legacy) ────────────────────────────────────
  if (courseIds.length > 0) {
    const { data: moduleRows } = await db
      .from('course_modules').select('id').in('course_id', courseIds).is('deleted_at', null)
    const moduleIds = (moduleRows ?? []).map((m: any) => m.id as string)

    if (moduleIds.length > 0) {
      const { data: lessonRows } = await db
        .from('lessons').select('id').in('module_id', moduleIds).is('deleted_at', null)
      const lessonIds = (lessonRows ?? []).map((l: any) => l.id as string)

      const orParts = [`module_id.in.(${moduleIds.join(',')})`]
      if (lessonIds.length) orParts.push(`lesson_id.in.(${lessonIds.join(',')})`)

      const { data: rows } = await db
        .from('assignments').select('id').eq('status', 'published').is('deleted_at', null)
        .or(orParts.join(','))
      for (const a of rows ?? []) allAssignmentIds.add((a as any).id as string)
    }
  }

  // ── Path B: session-direct (schedule_id, no module/lesson) ───────────────────
  if (gcIds.length > 0) {
    const { data: schedRows } = await db
      .from('schedules').select('id, group_course_id').in('group_course_id', gcIds)
    for (const s of schedRows ?? []) schedIdToGcId[(s as any).id] = (s as any).group_course_id
    const schedIds = (schedRows ?? []).map((s: any) => s.id as string)

    if (schedIds.length > 0) {
      const { data: rows } = await db
        .from('assignments').select('id')
        .in('schedule_id', schedIds).is('module_id', null).is('lesson_id', null)
        .eq('status', 'published').is('deleted_at', null)
      for (const a of rows ?? []) allAssignmentIds.add((a as any).id as string)
    }
  }

  if (allAssignmentIds.size === 0) return []

  // ── Fetch full data ───────────────────────────────────────────────────────────
  const { data: assignmentRows } = await db
    .from('assignments')
    .select(`
      id, title, type, submission_type, due_at, max_score,
      module_id, lesson_id, schedule_id,
      course_modules!assignments_module_id_fkey(
        title,
        courses!course_modules_course_id_fkey(title)
      ),
      lessons!assignments_lesson_id_fkey(
        title,
        course_modules!lessons_module_id_fkey(
          title,
          courses!course_modules_course_id_fkey(title)
        )
      )
    `)
    .in('id', [...allAssignmentIds])
    .eq('status', 'published').is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (!assignmentRows?.length) return []

  const assignmentIds = (assignmentRows as any[]).map(a => a.id as string)

  // Parents see ONLY public_feedback — never private notes
  const { data: submissionRows } = await db
    .from('submissions')
    .select('id, assignment_id, status, score, submitted_at, is_late, public_feedback')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds)

  const subMap = new Map((submissionRows ?? []).map((s: any) => [s.assignment_id as string, s]))

  return (assignmentRows as any[]).map(row => {
    const sub       = subMap.get(row.id) ?? null
    const modRow    = row.course_modules
    const lesRow    = row.lessons
    const lesModRow = lesRow?.course_modules

    let sessionCourseTitle: string | null = null
    if (!row.module_id && !row.lesson_id && row.schedule_id) {
      const gcId    = schedIdToGcId[row.schedule_id]
      const courseId = gcId ? gcIdToCourseId[gcId] : null
      sessionCourseTitle = courseId ? (courseIdToTitle[courseId] ?? null) : null
    }

    return {
      id:                      row.id,
      title:                   row.title,
      type:                    row.type,
      submission_type:         row.submission_type,
      due_at:                  row.due_at ?? null,
      max_score:               row.max_score,
      course_title:            modRow?.courses?.title ?? lesModRow?.courses?.title ?? sessionCourseTitle,
      module_title:            modRow?.title ?? lesModRow?.title ?? null,
      submission_id:           sub?.id ?? null,
      submission_status:       sub?.status ?? null,
      submission_score:        sub?.score ?? null,
      submission_submitted_at: sub?.submitted_at ?? null,
      is_late:                 sub?.is_late ?? false,
      public_feedback:         sub?.public_feedback ?? null,
    } satisfies ParentAssignmentItem
  })
}

// ── Semester history (reuses student_course_progress) ────────────────────────

export async function getChildSemesterHistory(
  parentUserId: string,
  studentId:    string
): Promise<StudentCourseProgress[]> {
  if (!(await verifyParentChild(parentUserId, studentId))) return []

  const db = createServiceClient()
  const { data, error } = await db
    .from('student_course_progress')
    .select(`
      *,
      courses!student_course_progress_course_id_fkey(title),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('student_id', studentId)
    .order('last_calculated_at', { ascending: false })

  if (error || !data) return []

  return (data as any[]).map(row => ({
    ...row,
    course_title:  row.courses?.title ?? '',
    semester_name: '',
    group_name:    row.groups?.name   ?? '',
  })) as StudentCourseProgress[]
}

// ── New types for enhanced dashboard ─────────────────────────────────────────

export interface ActivityEvent {
  id:         string
  event_type: 'attendance_marked' | 'homework_submitted' | 'homework_graded' | 'portfolio_uploaded' | 'portfolio_approved' | 'certificate_earned'
  title:      string
  subtitle:   string | null
  date:       string
}

export interface UpcomingClass {
  day_of_week:      string | null
  time:             string | null
  instructor_name:  string | null
  next_session_at:  string | null
}

export interface ChildSessionsProgress {
  completed_sessions: number
  total_sessions:     number
}

export interface ChildDashboardData {
  student_name:       string
  group_name:         string | null
  course_title:       string | null
  instructor_name:    string | null
  attendance_pct:     number | null
  assignment_pct:     number | null
  portfolio_count:    number
  certificate_count:  number
  completed_sessions: number
  total_sessions:     number
  upcoming_class:     UpcomingClass | null
  recent_activity:    ActivityEvent[]
}

// ── Comprehensive dashboard data (single round-trip optimised) ────────────────

export async function getChildDashboardData(
  parentUserId: string,
  studentId:    string
): Promise<ChildDashboardData | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()

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

  const empty: Omit<ChildDashboardData, 'student_name'> = {
    group_name: null, course_title: null, instructor_name: null,
    attendance_pct: null, assignment_pct: null,
    portfolio_count: 0, certificate_count: 0,
    completed_sessions: 0, total_sessions: 0,
    upcoming_class: null, recent_activity: [],
  }

  if (!groupId) return { student_name: studentName, ...empty }

  // Group + course + instructor info
  const [groupRes, gcRes] = await Promise.all([
    db.from('groups').select('name, day_of_week, time').eq('id', groupId).maybeSingle(),
    db.from('group_courses')
      .select('id, instructor_id, total_sessions, courses!group_courses_course_id_fkey(title)')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])

  const gc           = gcRes.data  as any
  const gcId         = gc?.id              ?? null
  const courseTitle  = gc?.courses?.title  ?? null
  const instrId      = gc?.instructor_id   ?? null
  const gRow         = groupRes.data as any

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

  // Sessions (completed count + next upcoming + completed IDs for attendance query)
  let completedSessions = 0
  let nextSessionAt: string | null = null
  let completedSchedIds: string[] = []
  if (gcId) {
    const { data: schedRows } = await db
      .from('schedules')
      .select('id, status, scheduled_at')
      .eq('group_course_id', gcId)
      .order('scheduled_at', { ascending: true })
    for (const s of schedRows ?? []) {
      if ((s as any).status === 'completed') {
        completedSessions++
        completedSchedIds.push((s as any).id as string)
      }
      if (!nextSessionAt && (s as any).status === 'scheduled' && new Date((s as any).scheduled_at) > new Date()) {
        nextSessionAt = (s as any).scheduled_at
      }
    }
  }

  // Progress from student_course_progress
  const { data: progressRow } = await db
    .from('student_course_progress')
    .select('attendance_score, assignment_score')
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .maybeSingle()

  // Portfolio count
  let portfolioCount = 0
  const { data: portRow } = await db
    .from('student_portfolios').select('id').eq('student_id', studentId).maybeSingle()
  if (portRow) {
    const { count } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', (portRow as any).id)
      .eq('is_archived', false)
    portfolioCount = count ?? 0
  }

  // Certificate count
  const { count: certCount } = await db
    .from('certificates')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'active')
  const certificateCount = certCount ?? 0

  // Recent activity (latest 10 events across types)
  const activity: ActivityEvent[] = []

  // Attendance — only from completed sessions (invisible to parents otherwise).
  if (completedSchedIds.length > 0) {
    const { data: attRows } = await db
      .from('attendance_records')
      .select('id, status, recorded_at')
      .eq('student_id', studentId)
      .in('schedule_id', completedSchedIds)
      .order('recorded_at', { ascending: false })
      .limit(5)
    for (const a of (attRows ?? []) as any[]) {
      const label = a.status === 'present' ? 'Attended' : a.status === 'late' ? 'Late' : a.status === 'makeup' ? 'Makeup' : 'Absent'
      activity.push({ id: `att-${a.id}`, event_type: 'attendance_marked', title: 'Attendance marked', subtitle: label, date: a.recorded_at })
    }
  }

  // Homework submitted + graded (last 5)
  const { data: subRows } = await db
    .from('submissions')
    .select('id, status, submitted_at, updated_at, assignments!submissions_assignment_id_fkey(title)')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'under_review', 'resubmitted', 'graded', 'returned'])
    .order('updated_at', { ascending: false })
    .limit(5)
  for (const s of (subRows ?? []) as any[]) {
    const aTitle = (s as any).assignments?.title ?? 'Assignment'
    if (s.status === 'graded') {
      activity.push({ id: `hw-graded-${s.id}`, event_type: 'homework_graded', title: `Homework graded`, subtitle: aTitle, date: s.updated_at })
    } else {
      activity.push({ id: `hw-sub-${s.id}`, event_type: 'homework_submitted', title: `Homework submitted`, subtitle: aTitle, date: s.submitted_at ?? s.updated_at })
    }
  }

  // Portfolio uploads + approvals (last 5)
  if (portRow) {
    const { data: projRows } = await db
      .from('portfolio_projects')
      .select('id, title, status, created_at, updated_at')
      .eq('portfolio_id', (portRow as any).id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(5)
    for (const p of (projRows ?? []) as any[]) {
      activity.push({ id: `proj-up-${p.id}`, event_type: 'portfolio_uploaded', title: 'Portfolio uploaded', subtitle: p.title, date: p.created_at })
      if (p.status === 'approved' || p.status === 'featured') {
        activity.push({ id: `proj-app-${p.id}`, event_type: 'portfolio_approved', title: 'Portfolio approved', subtitle: p.title, date: p.updated_at })
      }
    }
  }

  // Certificates (last 3)
  const { data: certRows } = await db
    .from('certificates')
    .select('id, title, issued_at')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('issued_at', { ascending: false })
    .limit(3)
  for (const c of (certRows ?? []) as any[]) {
    activity.push({ id: `cert-${c.id}`, event_type: 'certificate_earned', title: 'Certificate earned', subtitle: c.title, date: c.issued_at })
  }

  // Sort all events newest-first, keep top 10
  activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recentActivity = activity.slice(0, 10)

  return {
    student_name:       studentName,
    group_name:         gRow?.name ?? null,
    course_title:       courseTitle,
    instructor_name:    instructorName,
    attendance_pct:     (progressRow as any)?.attendance_score ?? null,
    assignment_pct:     (progressRow as any)?.assignment_score ?? null,
    portfolio_count:    portfolioCount,
    certificate_count:  certificateCount,
    completed_sessions: completedSessions,
    total_sessions:     gc?.total_sessions ?? 0,
    upcoming_class: gcId ? {
      day_of_week:     gRow?.day_of_week ?? null,
      time:            gRow?.time        ?? null,
      instructor_name: instructorName,
      next_session_at: nextSessionAt,
    } : null,
    recent_activity: recentActivity,
  }
}

// ── History timeline events ────────────────────────────────────────────────────

export interface TimelineEvent {
  id:         string
  event_type: 'attendance' | 'homework_submitted' | 'homework_graded' | 'portfolio_uploaded' | 'portfolio_approved' | 'certificate_earned'
  title:      string
  subtitle:   string | null
  date:       string
  month_key:  string   // e.g. "May 2026" for grouping
}

export async function getChildHistoryTimeline(
  parentUserId: string,
  studentId:    string
): Promise<TimelineEvent[]> {
  if (!(await verifyParentChild(parentUserId, studentId))) return []

  const db     = createServiceClient()
  const events: TimelineEvent[] = []

  const toMonthKey = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Attendance — only completed sessions are visible to parents.
  // Select schedule status so we can filter out cancelled/postponed entries.
  const { data: attRows } = await db
    .from('attendance_records')
    .select('id, status, recorded_at, schedules!attendance_records_schedule_id_fkey(scheduled_at, status)')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(50)
  for (const a of (attRows ?? []) as any[]) {
    if (a.schedules?.status !== 'completed') continue  // skip non-completed sessions
    const date = a.schedules?.scheduled_at ?? a.recorded_at
    const statusLabel = a.status === 'present' ? 'Present' : a.status === 'late' ? 'Late' : a.status === 'makeup' ? 'Makeup' : 'Absent'
    events.push({
      id:         `att-${a.id}`,
      event_type: 'attendance',
      title:      `Attendance: ${statusLabel}`,
      subtitle:   null,
      date,
      month_key:  toMonthKey(date),
    })
  }

  // Homework submitted + graded
  const { data: subRows } = await db
    .from('submissions')
    .select('id, status, submitted_at, updated_at, assignments!submissions_assignment_id_fkey(title)')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'under_review', 'resubmitted', 'graded', 'returned', 'resubmission_requested'])
    .order('submitted_at', { ascending: false })
    .limit(50)
  for (const s of (subRows ?? []) as any[]) {
    const aTitle = s.assignments?.title ?? 'Assignment'
    const subDate = s.submitted_at ?? s.updated_at
    if (subDate) {
      events.push({ id: `sub-${s.id}`, event_type: 'homework_submitted', title: 'Homework submitted', subtitle: aTitle, date: subDate, month_key: toMonthKey(subDate) })
    }
    if (s.status === 'graded' && s.updated_at) {
      events.push({ id: `graded-${s.id}`, event_type: 'homework_graded', title: 'Homework graded', subtitle: aTitle, date: s.updated_at, month_key: toMonthKey(s.updated_at) })
    }
  }

  // Portfolio
  const { data: portRow } = await db
    .from('student_portfolios').select('id').eq('student_id', studentId).maybeSingle()
  if (portRow) {
    const { data: projRows } = await db
      .from('portfolio_projects')
      .select('id, title, status, created_at, updated_at')
      .eq('portfolio_id', (portRow as any).id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(30)
    for (const p of (projRows ?? []) as any[]) {
      if (p.created_at) events.push({ id: `proj-up-${p.id}`, event_type: 'portfolio_uploaded', title: 'Portfolio uploaded', subtitle: p.title, date: p.created_at, month_key: toMonthKey(p.created_at) })
      if ((p.status === 'approved' || p.status === 'featured') && p.updated_at) {
        events.push({ id: `proj-app-${p.id}`, event_type: 'portfolio_approved', title: 'Portfolio approved', subtitle: p.title, date: p.updated_at, month_key: toMonthKey(p.updated_at) })
      }
    }
  }

  // Certificates
  const { data: certRows } = await db
    .from('certificates')
    .select('id, title, issued_at')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('issued_at', { ascending: false })
  for (const c of (certRows ?? []) as any[]) {
    events.push({ id: `cert-${c.id}`, event_type: 'certificate_earned', title: 'Certificate earned', subtitle: c.title, date: c.issued_at, month_key: toMonthKey(c.issued_at) })
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return events
}

// ── Sessions progress (enrollment-scoped, for certificate eligibility) ─────────
// Returns consumed sessions from the student's active enrollment ledger.
// Field names kept for backward compat: completed_sessions = consumed, total_sessions = enrolled.

export async function getChildSessionsProgress(
  parentUserId: string,
  studentId:    string
): Promise<ChildSessionsProgress | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()

  // Prefer group-linked ACTIVE enrollment; FIFO fallback to any ACTIVE enrollment.
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const groupId = (gsRow as any)?.group_id ?? null

  let enrollmentRow: any = null

  if (groupId) {
    const { data } = await db
      .from('student_enrollments')
      .select('enrolled_sessions, consumed_sessions')
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    enrollmentRow = data
  }

  if (!enrollmentRow) {
    const { data } = await db
      .from('student_enrollments')
      .select('enrolled_sessions, consumed_sessions')
      .eq('student_id', studentId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    enrollmentRow = data
  }

  if (!enrollmentRow) return { completed_sessions: 0, total_sessions: 0 }

  return {
    completed_sessions: enrollmentRow.consumed_sessions  ?? 0,
    total_sessions:     enrollmentRow.enrolled_sessions  ?? 0,
  }
}

// ── Contract-centric view for parent portal ───────────────────────────────────

export interface ParentEnrollmentContract {
  enrollment_id:      string
  contract_code:      string | null
  status:             string
  course_name:        string | null
  group_name:         string | null
  instructor_name:    string | null
  start_date:         string
  end_date:           string | null
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number
  total_amount:       number
  net_amount:         number
  paid_amount:        number
  remaining_amount:   number
  next_due_date:      string | null
  financial_status:   string | null
  attendance_pct:     number
  sessions_attended:  number
  total_sessions_recorded: number
}

export async function getChildEnrollmentContracts(
  parentUserId: string,
  studentId:    string
): Promise<ParentEnrollmentContract[]> {
  if (!(await verifyParentChild(parentUserId, studentId))) return []

  const db = createServiceClient()

  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select(`
      id, status, start_date, end_date, enrollment_type,
      enrolled_sessions, consumed_sessions, remaining_sessions,
      total_amount, discount_amount, net_amount, financial_status,
      contract_code,
      course_name_snapshot, group_name_snapshot, instructor_name_snapshot
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const enrollments = (enrollRows ?? []) as any[]
  if (!enrollments.length) return []

  const enrollIds = enrollments.map(e => e.id as string)

  // Financial accounts
  const { data: accRows } = await db
    .from('student_financial_accounts')
    .select('enrollment_id, student_id, paid_amount, remaining_amount, next_due_date, status')
    .or(`enrollment_id.in.(${enrollIds.join(',')}),student_id.eq.${studentId}`)

  const accByEnroll = new Map<string, any>()
  const fallback    = ((accRows ?? []) as any[]).find((a: any) => !a.enrollment_id) ?? null
  for (const a of (accRows ?? []) as any[]) {
    if (a.enrollment_id) accByEnroll.set(a.enrollment_id, a)
  }

  return enrollments.map(e => {
    const acc = accByEnroll.get(e.id) ?? fallback
    return {
      enrollment_id:      e.id,
      contract_code:      e.contract_code ?? null,
      status:             e.status,
      course_name:        e.course_name_snapshot ?? null,
      group_name:         e.group_name_snapshot  ?? null,
      instructor_name:    e.instructor_name_snapshot ?? null,
      start_date:         e.start_date,
      end_date:           e.end_date ?? null,
      enrolled_sessions:  Number(e.enrolled_sessions  ?? 0),
      consumed_sessions:  Number(e.consumed_sessions  ?? 0),
      remaining_sessions: Number(e.remaining_sessions ?? 0),
      total_amount:       Number(e.total_amount ?? 0),
      net_amount:         Number(e.net_amount   ?? 0),
      paid_amount:        acc ? Number(acc.paid_amount)      : 0,
      remaining_amount:   acc ? Number(acc.remaining_amount) : Number(e.net_amount ?? 0),
      next_due_date:      acc?.next_due_date ?? null,
      financial_status:   e.financial_status ?? acc?.status ?? null,
      attendance_pct:     0,
      sessions_attended:  0,
      total_sessions_recorded: 0,
    }
  })
}
