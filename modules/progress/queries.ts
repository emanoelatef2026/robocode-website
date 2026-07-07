import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyParentChild } from '@/modules/parents/parent-portal-queries'
import type { StudentCourseProgress, ProgressSummary } from './types'

export async function getStudentProgressByUserId(
  userId: string
): Promise<StudentCourseProgress[]> {
  const db = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!studentRow) return []

  const { data, error } = await db
    .from('student_course_progress')
    .select(`
      *,
      courses!student_course_progress_course_id_fkey(title),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('student_id', studentRow.id)
    .order('last_calculated_at', { ascending: false })

  if (error || !data) return []

  return data.map((row: any) => ({
    ...row,
    course_title:  row.courses?.title ?? '',
    semester_name: '',
    group_name:    row.groups?.name   ?? '',
  })) as StudentCourseProgress[]
}

// Session counts per group for the student dashboard.
// Returns a map from group_id → { completed, total }.
export async function getStudentSessionCounts(
  studentId: string
): Promise<Record<string, { completed: number; total: number }>> {
  const db = createServiceClient()

  const { data: gsRows } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (!gsRows?.length) return {}

  const groupIds = (gsRows as any[]).map((r) => r.group_id as string)

  const { data: gcRows } = await db
    .from('group_courses')
    .select('id, group_id')
    .in('group_id', groupIds)
    .eq('status', 'active')

  if (!gcRows?.length) return {}

  const gcIds       = (gcRows as any[]).map((r) => r.id as string)
  const groupByGc: Record<string, string> = {}
  for (const gc of gcRows as any[]) groupByGc[gc.id] = gc.group_id

  const { data: schedRows } = await db
    .from('schedules')
    .select('group_course_id, status')
    .in('group_course_id', gcIds)
    .neq('status', 'cancelled')

  const result: Record<string, { completed: number; total: number }> = {}
  for (const gid of groupIds) result[gid] = { completed: 0, total: 0 }

  for (const s of schedRows ?? []) {
    const gid = groupByGc[(s as any).group_course_id]
    if (!gid) continue
    result[gid].total++
    if ((s as any).status === 'completed') result[gid].completed++
  }

  return result
}

export async function getProgressForChild(
  parentUserId: string,
  studentId:    string
): Promise<ProgressSummary | null> {
  if (!(await verifyParentChild(parentUserId, studentId))) return null

  const db = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select(`
      id,
      users!students_user_id_fkey(
        email,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .eq('id', studentId)
    .maybeSingle()

  if (!studentRow) return null
  const student = studentRow as any

  const { data: progressRows } = await db
    .from('student_course_progress')
    .select(`
      *,
      courses!student_course_progress_course_id_fkey(title),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('student_id', studentId)
    .order('last_calculated_at', { ascending: false })

  const courses: StudentCourseProgress[] = (progressRows ?? []).map((row: any) => ({
    ...row,
    course_title:  row.courses?.title ?? '',
    semester_name: '',
    group_name:    row.groups?.name   ?? '',
  }))

  const overall = courses.length
    ? Math.round(
        (courses.reduce((sum, c) => sum + c.completion_percentage, 0) / courses.length) * 100
      ) / 100
    : 0

  return {
    student_id:         studentId,
    student_name:       [
      student.users?.profiles?.first_name,
      student.users?.profiles?.last_name,
    ].filter(Boolean).join(' ') || 'Student',
    student_email:      student.users?.email ?? '',
    courses,
    overall_percentage: overall,
  }
}

export async function getProgressForGroup(
  groupId: string
): Promise<StudentCourseProgress[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('student_course_progress')
    .select(`
      *,
      courses!student_course_progress_course_id_fkey(title),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('group_id', groupId)
    .order('student_id')

  if (error || !data) return []

  return data.map((row: any) => ({
    ...row,
    course_title:  row.courses?.title ?? '',
    semester_name: '',
    group_name:    row.groups?.name   ?? '',
  })) as StudentCourseProgress[]
}
