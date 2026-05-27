import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ProgressTuple, GroupProgressContext } from './types'

export type { ProgressTuple, GroupProgressContext }

// ── Internal: course + student → tuple ───────────────────────────────────────
// Finds the student's active group enrollment for a course and its semester.
async function resolveProgressFromCourse(
  studentId: string,
  courseId:  string
): Promise<ProgressTuple | null> {
  const db = createServiceClient()

  // 1. All active group_courses for this course
  const { data: gcRows } = await db
    .from('group_courses')
    .select('group_id')
    .eq('course_id', courseId)
    .eq('status', 'active')

  const groupIds = (gcRows ?? []).map((r: any) => r.group_id as string)
  if (!groupIds.length) return null

  // 2. The student's active membership in one of those groups
  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .in('group_id', groupIds)
    .limit(1)
    .maybeSingle()

  if (!gsRow) return null
  const groupId = (gsRow as any).group_id as string

  // 3. Semester from the group
  const { data: groupRow } = await db
    .from('groups')
    .select('semester_id')
    .eq('id', groupId)
    .single()

  const semesterId = (groupRow as any)?.semester_id as string | null
  if (!semesterId) return null

  return { studentId, courseId, semesterId, groupId }
}

// ── Public: resolve from an assignment ───────────────────────────────────────
// Used after submitAssignment and (via resolveProgressFromSubmission) gradeSubmission.
export async function resolveProgressFromAssignment(
  studentId:    string,
  assignmentId: string
): Promise<ProgressTuple | null> {
  const db = createServiceClient()

  const { data: asgn } = await db
    .from('assignments')
    .select(`
      module_id,
      lesson_id,
      course_modules!assignments_module_id_fkey(course_id),
      lessons!assignments_lesson_id_fkey(
        course_modules!lessons_module_id_fkey(course_id)
      )
    `)
    .eq('id', assignmentId)
    .single()

  if (!asgn) return null

  const courseId: string | undefined =
    (asgn as any).course_modules?.course_id ??
    (asgn as any).lessons?.course_modules?.course_id

  if (!courseId) return null

  return resolveProgressFromCourse(studentId, courseId)
}

// ── Public: resolve from a submission id ─────────────────────────────────────
// Bridges submission → assignment → course → tuple.
export async function resolveProgressFromSubmission(
  submissionId: string
): Promise<ProgressTuple | null> {
  const db = createServiceClient()

  const { data: sub } = await db
    .from('submissions')
    .select('student_id, assignment_id')
    .eq('id', submissionId)
    .single()

  if (!sub) return null

  return resolveProgressFromAssignment(
    (sub as any).student_id as string,
    (sub as any).assignment_id as string
  )
}

// ── Public: resolve from a portfolio project id ───────────────────────────────
// Used after createProject, promoteSubmission, updateProject, archiveProject.
// Returns null when the project has no course_id or semester_id (can't scope to a row).
export async function resolveProgressFromPortfolioProject(
  projectId: string
): Promise<ProgressTuple | null> {
  const db = createServiceClient()

  const { data: project } = await db
    .from('portfolio_projects')
    .select('student_id, course_id, semester_id')
    .eq('id', projectId)
    .single()

  if (!project) return null

  const { student_id, course_id, semester_id } = project as any

  if (!course_id || !semester_id) return null

  // Find the student's active group for this course
  const { data: gcRows } = await db
    .from('group_courses')
    .select('group_id')
    .eq('course_id', course_id)
    .eq('status', 'active')

  const gcGroupIds = (gcRows ?? []).map((r: any) => r.group_id as string)
  if (!gcGroupIds.length) return null

  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', student_id)
    .eq('status', 'active')
    .in('group_id', gcGroupIds)
    .limit(1)
    .maybeSingle()

  if (!gsRow) return null

  return {
    studentId:  student_id as string,
    courseId:   course_id as string,
    semesterId: semester_id as string,
    groupId:    (gsRow as any).group_id as string,
  }
}

// ── Public: resolve all course contexts for a group ──────────────────────────
// Returns one GroupProgressContext per active group_course.
// Used for attendance sessions, enrollStudent, and unenrollStudent
// where the student set is passed separately.
export async function resolveGroupProgressContext(
  groupId: string
): Promise<GroupProgressContext[]> {
  const db = createServiceClient()

  const { data: gcRows } = await db
    .from('group_courses')
    .select('course_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const courseIds = (gcRows ?? []).map((r: any) => r.course_id as string)
  if (!courseIds.length) return []

  const { data: groupRow } = await db
    .from('groups')
    .select('semester_id')
    .eq('id', groupId)
    .single()

  const semesterId = (groupRow as any)?.semester_id as string | null
  if (!semesterId) return []

  return courseIds.map(courseId => ({ courseId, semesterId, groupId }))
}
