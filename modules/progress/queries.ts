import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
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
      semesters!student_course_progress_semester_id_fkey(name),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('student_id', studentRow.id)
    .order('last_calculated_at', { ascending: false })

  if (error || !data) return []

  return data.map((row: any) => ({
    ...row,
    course_title:  row.courses?.title  ?? '',
    semester_name: row.semesters?.name ?? '',
    group_name:    row.groups?.name    ?? '',
  })) as StudentCourseProgress[]
}

export async function getProgressForParent(
  userId: string
): Promise<ProgressSummary[]> {
  const db = createServiceClient()

  const { data: parentRow } = await db
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!parentRow) return []

  const { data: linkedStudents } = await db
    .from('parent_students')
    .select(`
      student_id,
      students!parent_students_student_id_fkey(
        id,
        users!students_user_id_fkey(
          email,
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .eq('parent_id', parentRow.id)

  if (!linkedStudents?.length) return []

  const summaries: ProgressSummary[] = []

  for (const link of linkedStudents) {
    const student = (link as any).students
    if (!student) continue

    const { data: progressRows } = await db
      .from('student_course_progress')
      .select(`
        *,
        courses!student_course_progress_course_id_fkey(title),
        semesters!student_course_progress_semester_id_fkey(name),
        groups!student_course_progress_group_id_fkey(name)
      `)
      .eq('student_id', student.id)
      .order('last_calculated_at', { ascending: false })

    const courses: StudentCourseProgress[] = (progressRows ?? []).map((row: any) => ({
      ...row,
      course_title:  row.courses?.title  ?? '',
      semester_name: row.semesters?.name ?? '',
      group_name:    row.groups?.name    ?? '',
    }))

    const overall = courses.length
      ? Math.round(
          (courses.reduce((sum, c) => sum + c.completion_percentage, 0) / courses.length) * 100
        ) / 100
      : 0

    summaries.push({
      student_id:         student.id,
      student_name:       [
        student.users?.profiles?.first_name,
        student.users?.profiles?.last_name,
      ].filter(Boolean).join(' ') || 'Student',
      student_email:      student.users?.email ?? '',
      courses,
      overall_percentage: overall,
    })
  }

  return summaries
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
      semesters!student_course_progress_semester_id_fkey(name),
      groups!student_course_progress_group_id_fkey(name)
    `)
    .eq('group_id', groupId)
    .order('student_id')

  if (error || !data) return []

  return data.map((row: any) => ({
    ...row,
    course_title:  row.courses?.title  ?? '',
    semester_name: row.semesters?.name ?? '',
    group_name:    row.groups?.name    ?? '',
  })) as StudentCourseProgress[]
}
