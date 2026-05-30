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
        scheduled_at,
        group_courses!schedules_group_course_id_fkey(
          courses!group_courses_course_id_fkey(title)
        )
      )
    `)
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })

  const rows = (data ?? []) as any[]

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
