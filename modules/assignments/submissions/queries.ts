import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Submission, SubmissionListItem } from './types'
import type { Assignment } from '@/modules/assignments/types'

export interface StudentAssignmentItem {
  id: string
  title: string
  type: string
  submission_type: string
  due_at: string | null
  max_score: number
  course_title: string | null
  module_title: string | null
  submission_id:       string | null
  submission_status:   string | null
  submission_score:    number | null
  submission_submitted_at: string | null
  is_late: boolean
}

export interface StudentAssignmentDetail extends Assignment {
  submission: Submission | null
}

export async function listSubmissions(
  assignmentId: string
): Promise<SubmissionListItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, status, score, is_late, resubmission_count,
       students!submissions_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:                 row.id,
    assignment_id:      row.assignment_id,
    student_id:         row.student_id,
    submitted_at:       row.submitted_at,
    status:             row.status,
    score:              row.score ?? null,
    is_late:            row.is_late,
    resubmission_count: row.resubmission_count,
    student_email:      row.students?.users?.email ?? '',
    student_name:       [
      row.students?.users?.profiles?.first_name,
      row.students?.users?.profiles?.last_name,
    ].filter(Boolean).join(' ') || 'Unknown',
  }))
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('submissions')
    .select(
      `*,
       students!submissions_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       assignments!submissions_assignment_id_fkey(title)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as any
  return {
    ...row,
    student_email:    row.students?.users?.email ?? '',
    student_name:     [
      row.students?.users?.profiles?.first_name,
      row.students?.users?.profiles?.last_name,
    ].filter(Boolean).join(' ') || 'Unknown',
    assignment_title: row.assignments?.title ?? '',
    rubric_scores:    row.rubric_scores ?? {},
    image_urls:       row.image_urls ?? [],
    file_keys:        row.file_keys ?? [],
  } as Submission
}

// ── Student-facing queries ────────────────────────────────────────────────────

export async function listStudentAssignments(
  userId: string
): Promise<StudentAssignmentItem[]> {
  const db = createServiceClient()

  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', userId).single()
  if (!studentRow) return []
  const studentId = (studentRow as any).id as string

  // Active group memberships
  const { data: groupRows } = await db
    .from('group_students').select('group_id').eq('student_id', studentId).eq('status', 'active')
  const groupIds = (groupRows ?? []).map((g: any) => g.group_id as string)
  if (!groupIds.length) return []

  // Active group_courses (need id for schedule lookup, course_id for title resolution)
  const { data: gcRows } = await db
    .from('group_courses').select('id, course_id').in('group_id', groupIds).eq('status', 'active')
  const gcIds     = (gcRows ?? []).map((gc: any) => gc.id       as string)
  const courseIds = [...new Set((gcRows ?? []).map((gc: any) => gc.course_id as string))]

  // Lookup maps for resolving course titles on session-direct assignments
  const gcIdToCourseId:  Record<string, string> = {}
  const courseIdToTitle: Record<string, string> = {}
  const schedIdToGcId:   Record<string, string> = {}

  for (const gc of gcRows ?? []) gcIdToCourseId[(gc as any).id] = (gc as any).course_id

  if (courseIds.length > 0) {
    const { data: courseRows } = await db.from('courses').select('id, title').in('id', courseIds)
    for (const c of courseRows ?? []) courseIdToTitle[(c as any).id] = (c as any).title
  }

  // Collect all assignment IDs from two paths (no early exit — groups may use either or both)
  const allAssignmentIds = new Set<string>()

  // ── Path A: module/lesson-linked assignments (legacy curriculum model) ────────
  if (courseIds.length > 0) {
    const { data: moduleRows } = await db
      .from('course_modules').select('id').in('course_id', courseIds).is('deleted_at', null)
    const moduleIds = (moduleRows ?? []).map((m: any) => m.id as string)

    if (moduleIds.length > 0) {
      const { data: lessonRows } = await db
        .from('lessons').select('id').in('module_id', moduleIds).is('deleted_at', null)
      const lessonIds = (lessonRows ?? []).map((l: any) => l.id as string)

      const orParts = [`module_id.in.(${moduleIds.join(',')})`]
      if (lessonIds.length > 0) orParts.push(`lesson_id.in.(${lessonIds.join(',')})`)

      const { data: rows } = await db
        .from('assignments').select('id').eq('status', 'published').is('deleted_at', null)
        .or(orParts.join(','))
      for (const a of rows ?? []) allAssignmentIds.add((a as any).id as string)
    }
  }

  // ── Path B: session-direct assignments (schedule_id only, no module/lesson) ──
  // Created by instructors inside sessions. Enabled by migration 0043.
  if (gcIds.length > 0) {
    const { data: schedRows } = await db
      .from('schedules').select('id, group_course_id').in('group_course_id', gcIds)

    for (const s of schedRows ?? []) schedIdToGcId[(s as any).id] = (s as any).group_course_id

    const schedIds = (schedRows ?? []).map((s: any) => s.id as string)
    if (schedIds.length > 0) {
      const { data: rows } = await db
        .from('assignments').select('id')
        .in('schedule_id', schedIds)
        .is('module_id', null)
        .is('lesson_id', null)
        .eq('status', 'published')
        .is('deleted_at', null)
      for (const a of rows ?? []) allAssignmentIds.add((a as any).id as string)
    }
  }

  if (allAssignmentIds.size === 0) return []

  // ── Fetch full assignment data ────────────────────────────────────────────────
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
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (!assignmentRows?.length) return []

  // ── Fetch submissions for this student ───────────────────────────────────────
  const assignmentIds = (assignmentRows as any[]).map(a => a.id as string)
  const { data: submissionRows } = await db
    .from('submissions')
    .select('id, assignment_id, status, score, submitted_at, is_late')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds)

  const subMap = new Map((submissionRows ?? []).map((s: any) => [s.assignment_id as string, s]))

  return (assignmentRows as any[]).map(row => {
    const sub       = subMap.get(row.id) ?? null
    const modRow    = row.course_modules
    const lesRow    = row.lessons
    const lesModRow = lesRow?.course_modules

    // Resolve course title for session-direct assignments via pre-built maps
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
    } as StudentAssignmentItem
  })
}

export async function getStudentAssignmentWithSubmission(
  userId: string,
  assignmentId: string
): Promise<StudentAssignmentDetail | null> {
  const db = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!studentRow) return null

  const { data: asgn, error: asgnErr } = await db
    .from('assignments')
    .select(`
      *,
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
      ),
      submissions!submissions_assignment_id_fkey(count)
    `)
    .eq('id', assignmentId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (asgnErr || !asgn) return null

  const row      = asgn as any
  const modRow   = row.course_modules
  const lesRow   = row.lessons
  const lesModRow = lesRow?.course_modules

  const assignment: Assignment = {
    ...row,
    lesson_title:    lesRow?.title  ?? null,
    module_title:    modRow?.title  ?? lesModRow?.title  ?? null,
    course_title:    modRow?.courses?.title ?? lesModRow?.courses?.title ?? null,
    rubric:          row.rubric ?? [],
    submission_count: row.submissions?.[0]?.count ?? 0,
  }

  const { data: subRow } = await db
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const submission: Submission | null = subRow
    ? {
        ...(subRow as any),
        student_email:    '',
        student_name:     '',
        assignment_title: assignment.title,
        rubric_scores:    (subRow as any).rubric_scores ?? {},
        image_urls:       (subRow as any).image_urls    ?? [],
        file_keys:        (subRow as any).file_keys     ?? [],
      }
    : null

  return { ...assignment, submission }
}
