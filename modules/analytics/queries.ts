import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { AppUser, PaginatedResult } from '@/types/app'
import type {
  AtRiskStudent,
  StudentCertReadiness,
  CertReadinessStatus,
  MissingAssignmentsStudent,
  GroupPerformance,
  CoursePerformance,
  SemesterOverview,
  SemesterListItem,
} from './types'

// ── Scope resolution ──────────────────────────────────────────────────────────
// Returns group_ids the user may see, or null (admin = all groups, no filter).

export async function resolveGroupFilter(user: AppUser): Promise<string[] | null> {
  if (user.globalRole === 'super_admin') return null

  const db = createServiceClient()

  if (user.globalRole === 'team_leader') {
    if (!user.branchIds.length) return []
    const { data } = await db
      .from('groups')
      .select('id')
      .in('branch_id', user.branchIds)
    return (data ?? []).map((r: any) => r.id)
  }

  if (user.globalRole === 'instructor') {
    // Find instructor rows for this user (may span multiple branches)
    const { data: instructorRows } = await db
      .from('instructors')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
    if (!instructorRows?.length) return []

    const instrIds = (instructorRows as any[]).map((r: any) => r.id as string)

    // Collect groups from group_instructors AND active group_courses across all instructor rows
    const [giRes, gcRes] = await Promise.all([
      db.from('group_instructors').select('group_id').in('instructor_id', instrIds),
      db.from('group_courses').select('group_id').in('instructor_id', instrIds).eq('status', 'active'),
    ])

    const ids = [
      ...(giRes.data ?? []).map((r: any) => r.group_id as string),
      ...(gcRes.data ?? []).map((r: any) => r.group_id as string),
    ]
    return [...new Set(ids)]
  }

  return []
}

// ── Semesters helper ──────────────────────────────────────────────────────────

export async function listSemestersForAnalytics(): Promise<SemesterListItem[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('semesters')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(30)
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name }))
}

// ── Feature 1: At-Risk Students ───────────────────────────────────────────────
// At-risk: completion_percentage < 70 OR attendance_score < 75

export async function listAtRiskStudents(
  groupFilter: string[] | null,
  options: {
    semesterId?: string
    sort?: 'completion' | 'attendance'
    page?: number
    perPage?: number
  } = {}
): Promise<PaginatedResult<AtRiskStudent>> {
  const { page = 1, perPage = 20, semesterId, sort = 'completion' } = options

  if (groupFilter !== null && groupFilter.length === 0) {
    return { data: [], total: 0, page, perPage, totalPages: 0 }
  }

  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('student_course_progress')
    .select(
      `student_id, course_id, semester_id, group_id,
       completion_percentage, attendance_score, assignment_score, portfolio_score,
       last_calculated_at,
       students!student_course_progress_student_id_fkey(
         users!students_user_id_fkey(
           email,
           profiles!profiles_user_id_fkey(first_name, last_name)
         )
       ),
       groups!student_course_progress_group_id_fkey(name),
       courses!student_course_progress_course_id_fkey(title),
       semesters!student_course_progress_semester_id_fkey(name)`,
      { count: 'exact' }
    )
    .or('completion_percentage.lt.70,attendance_score.lt.75')
    .order(sort === 'attendance' ? 'attendance_score' : 'completion_percentage', { ascending: true })
    .range(from, to)

  if (groupFilter !== null) query = (query as any).in('group_id', groupFilter)
  if (semesterId)           query = (query as any).eq('semester_id', semesterId)

  const { data, count, error } = await (query as any)
  if (error || !data) return { data: [], total: 0, page, perPage, totalPages: 0 }

  const items: AtRiskStudent[] = (data as any[]).map(row => {
    const u    = row.students?.users
    const p    = u?.profiles
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || u?.email || '—'

    const reasons: Array<'low_completion' | 'low_attendance'> = []
    if (Number(row.completion_percentage) < 70) reasons.push('low_completion')
    if (Number(row.attendance_score)      < 75) reasons.push('low_attendance')

    return {
      student_id:            row.student_id,
      student_name:          name,
      student_email:         u?.email ?? '',
      group_id:              row.group_id,
      group_name:            row.groups?.name ?? '—',
      course_id:             row.course_id,
      course_title:          row.courses?.title ?? '—',
      semester_id:           row.semester_id,
      semester_name:         row.semesters?.name ?? '—',
      completion_percentage: Number(row.completion_percentage),
      attendance_score:      Number(row.attendance_score),
      assignment_score:      Number(row.assignment_score),
      portfolio_score:       Number(row.portfolio_score),
      last_calculated_at:    row.last_calculated_at,
      risk_reasons:          reasons,
    }
  })

  const total = count ?? items.length
  return { data: items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
}

// ── Feature 2: Certificate Readiness ─────────────────────────────────────────

// Pure classification — thresholds mirror checkCertificateEligibility() defaults.
export function classifyCertReadiness(
  avgAttendance: number,
  avgAssignment: number,
  avgCompletion: number
): { status: CertReadinessStatus; failedThresholds: string[] } {
  const T = { attendance: 75, assignment: 60, overall: 70 }
  const A = { attendance: 65, assignment: 50, overall: 60 } // "almost ready" floor

  const failed: string[] = []
  if (avgAttendance < T.attendance) failed.push('attendance')
  if (avgAssignment < T.assignment) failed.push('assignments')
  if (avgCompletion < T.overall)    failed.push('overall')

  if (failed.length === 0) return { status: 'ready', failedThresholds: [] }

  // "almost_ready" — all failing thresholds are within the grace band
  const outsideGrace = (
    (avgAttendance < T.attendance && avgAttendance < A.attendance) ||
    (avgAssignment < T.assignment && avgAssignment < A.assignment) ||
    (avgCompletion < T.overall    && avgCompletion < A.overall)
  )
  return outsideGrace
    ? { status: 'not_ready',    failedThresholds: failed }
    : { status: 'almost_ready', failedThresholds: failed }
}

export async function listCertificateReadiness(
  groupFilter: string[] | null,
  options: { semesterId?: string } = {}
): Promise<StudentCertReadiness[]> {
  if (groupFilter !== null && groupFilter.length === 0) return []

  const db = createServiceClient()

  let query = db
    .from('student_course_progress')
    .select(
      `student_id, semester_id,
       attendance_score, assignment_score, portfolio_score, completion_percentage,
       students!student_course_progress_student_id_fkey(
         users!students_user_id_fkey(
           email,
           profiles!profiles_user_id_fkey(first_name, last_name)
         )
       ),
       semesters!student_course_progress_semester_id_fkey(name)`
    )

  if (groupFilter !== null) query = (query as any).in('group_id', groupFilter)
  if (options.semesterId)   query = (query as any).eq('semester_id', options.semesterId)

  const { data, error } = await (query as any)
  if (error || !data) return []

  type Accum = {
    name: string; email: string; semesterName: string
    attendance: number[]; assignment: number[]; portfolio: number[]; completion: number[]
  }
  const acc = new Map<string, Accum>()

  for (const row of data as any[]) {
    const key = `${row.student_id}::${row.semester_id}`
    const u   = row.students?.users
    const p   = u?.profiles
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || u?.email || '—'

    if (!acc.has(key)) {
      acc.set(key, {
        name,
        email:        u?.email ?? '',
        semesterName: row.semesters?.name ?? '—',
        attendance: [], assignment: [], portfolio: [], completion: [],
      })
    }
    const e = acc.get(key)!
    e.attendance.push(Number(row.attendance_score))
    e.assignment.push(Number(row.assignment_score))
    e.portfolio.push(Number(row.portfolio_score))
    e.completion.push(Number(row.completion_percentage))
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : 0

  return [...acc.entries()].map(([key, entry]) => {
    const [studentId, semesterId] = key.split('::')
    const avgAttendance = avg(entry.attendance)
    const avgAssignment = avg(entry.assignment)
    const avgCompletion = avg(entry.completion)
    const { status, failedThresholds } = classifyCertReadiness(avgAttendance, avgAssignment, avgCompletion)

    return {
      student_id:        studentId,
      student_name:      entry.name,
      student_email:     entry.email,
      semester_id:       semesterId,
      semester_name:     entry.semesterName,
      avg_attendance:    avgAttendance,
      avg_assignment:    avgAssignment,
      avg_portfolio:     avg(entry.portfolio),
      avg_completion:    avgCompletion,
      courses_evaluated: entry.attendance.length,
      status,
      failed_thresholds: failedThresholds,
    }
  })
}

// ── Feature 3: Missing Assignments ───────────────────────────────────────────

export async function listMissingAssignments(
  groupFilter: string[] | null,
  options: { page?: number; perPage?: number } = {}
): Promise<PaginatedResult<MissingAssignmentsStudent>> {
  const { page = 1, perPage = 20 } = options
  const empty: PaginatedResult<MissingAssignmentsStudent> = {
    data: [], total: 0, page, perPage, totalPages: 0,
  }

  if (groupFilter !== null && groupFilter.length === 0) return empty

  const db = createServiceClient()

  // 1. Resolve group_course_ids in scope
  let gcIds: string[] | null = null
  if (groupFilter !== null) {
    const { data: gcData } = await db
      .from('group_courses')
      .select('id, course_id')
      .in('group_id', groupFilter)
    gcIds = (gcData ?? []).map((r: any) => r.id)
    if (gcIds.length === 0) return empty
  }

  // 2. Query student_grade_summaries with course context and student names
  let summaryQuery = db
    .from('student_grade_summaries')
    .select(
      `student_id, group_course_id, total_assignments, submitted_count,
       group_courses!student_grade_summaries_group_course_id_fkey(course_id),
       students!student_grade_summaries_student_id_fkey(
         users!students_user_id_fkey(
           email,
           profiles!profiles_user_id_fkey(first_name, last_name)
         )
       )`
    )

  if (gcIds !== null) summaryQuery = (summaryQuery as any).in('group_course_id', gcIds)
  const { data: summaries } = await (summaryQuery as any)
  if (!summaries?.length) return empty

  // 3. Aggregate missing count + enrolled courses per student
  type StudentEntry = { name: string; email: string; courseIds: Set<string>; missing: number }
  const studentMap = new Map<string, StudentEntry>()

  for (const row of summaries as any[]) {
    const missing  = Math.max(0, (row.total_assignments ?? 0) - (row.submitted_count ?? 0))
    const courseId = row.group_courses?.course_id as string | undefined
    const u        = row.students?.users
    const p        = u?.profiles
    const name     = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || u?.email || '—'

    const existing = studentMap.get(row.student_id)
    if (existing) {
      existing.missing += missing
      if (courseId) existing.courseIds.add(courseId)
    } else {
      studentMap.set(row.student_id, {
        name,
        email:     u?.email ?? '',
        courseIds: new Set(courseId ? [courseId] : []),
        missing,
      })
    }
  }

  const studentsWithMissing = [...studentMap.entries()].filter(([, v]) => v.missing > 0)
  if (!studentsWithMissing.length) return empty

  // 4. Compute overdue_count via assignment due_at chain
  const overdueCountMap = new Map<string, number>()
  const allCourseIds    = [...new Set([...studentMap.values()].flatMap(v => [...v.courseIds]))]
  const studentIds      = [...studentMap.keys()]

  if (allCourseIds.length > 0 && studentIds.length > 0) {
    const { data: modulesData } = await db
      .from('course_modules')
      .select('id, course_id')
      .in('course_id', allCourseIds)

    const modCourseMap = new Map((modulesData ?? []).map((r: any) => [r.id as string, r.course_id as string]))
    const moduleIds    = [...modCourseMap.keys()]

    const { data: lessonsData } = await db
      .from('lessons')
      .select('id, module_id')
      .in('module_id', moduleIds)

    const lessonModMap = new Map((lessonsData ?? []).map((r: any) => [r.id as string, r.module_id as string]))
    const lessonIds    = [...lessonModMap.keys()]

    const now = new Date().toISOString()
    const overdueAssigns: Array<{ id: string; courseId: string }> = []

    if (moduleIds.length > 0) {
      const { data: d } = await db
        .from('assignments')
        .select('id, module_id')
        .in('module_id', moduleIds)
        .eq('status', 'published')
        .lt('due_at', now)
        .is('deleted_at', null)
      for (const r of d ?? []) {
        const courseId = modCourseMap.get((r as any).module_id)
        if (courseId) overdueAssigns.push({ id: (r as any).id, courseId })
      }
    }

    if (lessonIds.length > 0) {
      const { data: d } = await db
        .from('assignments')
        .select('id, lesson_id')
        .in('lesson_id', lessonIds)
        .eq('status', 'published')
        .lt('due_at', now)
        .is('deleted_at', null)
      for (const r of d ?? []) {
        const modId    = lessonModMap.get((r as any).lesson_id)
        const courseId = modId ? modCourseMap.get(modId) : undefined
        if (courseId) overdueAssigns.push({ id: (r as any).id, courseId })
      }
    }

    if (overdueAssigns.length > 0) {
      const overdueIds = overdueAssigns.map(a => a.id)
      const { data: subs } = await db
        .from('submissions')
        .select('student_id, assignment_id')
        .in('student_id', studentIds)
        .in('assignment_id', overdueIds)

      const submittedSet = new Set(
        (subs ?? []).map((r: any) => `${r.student_id}:${r.assignment_id}`)
      )

      for (const [studentId, { courseIds }] of studentMap) {
        let count = 0
        for (const { id, courseId } of overdueAssigns) {
          if (courseIds.has(courseId) && !submittedSet.has(`${studentId}:${id}`)) count++
        }
        if (count > 0) overdueCountMap.set(studentId, count)
      }
    }
  }

  // 5. Build sorted result
  const result: MissingAssignmentsStudent[] = studentsWithMissing
    .map(([studentId, { name, email, missing }]) => ({
      student_id:    studentId,
      student_name:  name,
      student_email: email,
      missing_count: missing,
      overdue_count: overdueCountMap.get(studentId) ?? 0,
    }))
    .sort((a, b) => b.overdue_count - a.overdue_count || b.missing_count - a.missing_count)

  const total = result.length
  const slice = result.slice((page - 1) * perPage, page * perPage)
  return { data: slice, total, page, perPage, totalPages: Math.ceil(total / perPage) }
}

// ── Feature 4: Group Performance ─────────────────────────────────────────────

export async function listGroupPerformance(
  groupFilter: string[] | null
): Promise<GroupPerformance[]> {
  if (groupFilter !== null && groupFilter.length === 0) return []

  const db = createServiceClient()

  let query = db
    .from('student_course_progress')
    .select(
      `group_id, completion_percentage, attendance_score, assignment_score,
       groups!student_course_progress_group_id_fkey(
         name,
         branches!groups_branch_id_fkey(name)
       )`
    )

  if (groupFilter !== null) query = (query as any).in('group_id', groupFilter)

  const { data, error } = await (query as any)
  if (error || !data) return []

  type Acc = { name: string; branchName: string | null; c: number[]; a: number[]; s: number[] }
  const acc = new Map<string, Acc>()

  for (const row of data as any[]) {
    const g = acc.get(row.group_id)
    const n = Number(row.completion_percentage)
    const a = Number(row.attendance_score)
    const s = Number(row.assignment_score)
    if (g) { g.c.push(n); g.a.push(a); g.s.push(s) }
    else {
      acc.set(row.group_id, {
        name:       row.groups?.name ?? '—',
        branchName: row.groups?.branches?.name ?? null,
        c: [n], a: [a], s: [s],
      })
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((x, v) => x + v, 0) / arr.length) * 100) / 100 : 0

  return [...acc.entries()]
    .map(([id, e]) => ({
      group_id:       id,
      group_name:     e.name,
      branch_name:    e.branchName,
      student_count:  e.c.length,
      avg_completion: avg(e.c),
      avg_attendance: avg(e.a),
      avg_assignment: avg(e.s),
    }))
    .sort((a, b) => b.avg_completion - a.avg_completion)
}

// ── Feature 5: Course Performance ────────────────────────────────────────────

export async function listCoursePerformance(
  groupFilter: string[] | null
): Promise<CoursePerformance[]> {
  if (groupFilter !== null && groupFilter.length === 0) return []

  const db = createServiceClient()

  let query = db
    .from('student_course_progress')
    .select(
      `course_id, completion_percentage, attendance_score, assignment_score,
       courses!student_course_progress_course_id_fkey(title)`
    )

  if (groupFilter !== null) query = (query as any).in('group_id', groupFilter)

  const { data, error } = await (query as any)
  if (error || !data) return []

  type Acc = { title: string; c: number[]; a: number[]; s: number[] }
  const acc = new Map<string, Acc>()

  for (const row of data as any[]) {
    const e = acc.get(row.course_id)
    const n = Number(row.completion_percentage)
    const a = Number(row.attendance_score)
    const s = Number(row.assignment_score)
    if (e) { e.c.push(n); e.a.push(a); e.s.push(s) }
    else acc.set(row.course_id, { title: row.courses?.title ?? '—', c: [n], a: [a], s: [s] })
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((x, v) => x + v, 0) / arr.length) * 100) / 100 : 0

  return [...acc.entries()]
    .map(([id, e]) => ({
      course_id:      id,
      course_title:   e.title,
      student_count:  e.c.length,
      avg_completion: avg(e.c),
      avg_attendance: avg(e.a),
      avg_assignment: avg(e.s),
    }))
    .sort((a, b) => b.avg_completion - a.avg_completion)
}

// ── Feature 6: Semester Overview ─────────────────────────────────────────────

export async function getSemesterOverview(
  semesterId: string,
  groupFilter: string[] | null
): Promise<SemesterOverview | null> {
  if (groupFilter !== null && groupFilter.length === 0) return null

  const db = createServiceClient()

  let query = db
    .from('student_course_progress')
    .select(
      `student_id, status, attendance_score, assignment_score, portfolio_score, completion_percentage,
       semesters!student_course_progress_semester_id_fkey(name)`
    )
    .eq('semester_id', semesterId)

  if (groupFilter !== null) query = (query as any).in('group_id', groupFilter)

  const { data, error } = await (query as any)
  if (error || !data || !(data as any[]).length) return null

  const rows         = data as any[]
  const semesterName = rows[0].semesters?.name ?? '—'

  // Unique students — use "worst" status if a student appears in multiple courses
  const statusPriority: Record<string, number> = { active: 0, completed: 1, failed: 2 }
  const studentStatus  = new Map<string, string>()
  for (const row of rows) {
    const prev    = studentStatus.get(row.student_id)
    const current = row.status as string
    if (!prev || (statusPriority[current] ?? 0) > (statusPriority[prev] ?? 0)) {
      studentStatus.set(row.student_id, current)
    }
  }

  let active = 0, completed = 0, failed = 0
  for (const s of studentStatus.values()) {
    if (s === 'active')    active++
    if (s === 'completed') completed++
    if (s === 'failed')    failed++
  }

  const avg = (key: string) => {
    const vals = rows.map(r => Number(r[key]))
    return vals.length
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
      : 0
  }

  return {
    semester_id:        semesterId,
    semester_name:      semesterName,
    total_students:     studentStatus.size,
    active_students:    active,
    completed_students: completed,
    failed_students:    failed,
    avg_attendance:     avg('attendance_score'),
    avg_assignment:     avg('assignment_score'),
    avg_portfolio:      avg('portfolio_score'),
    avg_completion:     avg('completion_percentage'),
  }
}
