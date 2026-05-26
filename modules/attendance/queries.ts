import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { AttendanceListItem, SessionStudent } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listAttendanceRecords({
  page = 1,
  perPage = 30,
  branchId,
  groupId,
}: {
  page?: number
  perPage?: number
  branchId?: string
  groupId?: string
} = {}): Promise<PaginatedResult<AttendanceListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('attendance_records')
    .select(
      `id, schedule_id, student_id, status, recorded_at, notes,
       students!attendance_records_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       schedules!attendance_records_schedule_id_fkey(
         scheduled_at, branch_id,
         branches!schedules_branch_id_fkey(name),
         group_courses!schedules_group_course_id_fkey(
           groups!group_courses_group_id_fkey(name)
         )
       )`,
      { count: 'exact' }
    )
    .order('recorded_at', { ascending: false })
    .range(from, to)

  if (branchId) {
    query = query.eq('schedules.branch_id', branchId)
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: AttendanceListItem[] = (data ?? []).map((row: any) => ({
    id:                 row.id,
    schedule_id:        row.schedule_id,
    student_id:         row.student_id,
    status:             row.status,
    recorded_at:        row.recorded_at,
    notes:              row.notes,
    student_email:      row.students?.users?.email ?? '',
    student_first_name: row.students?.users?.profiles?.first_name ?? null,
    student_last_name:  row.students?.users?.profiles?.last_name ?? null,
    group_name:         row.schedules?.group_courses?.groups?.name ?? '',
    scheduled_at:       row.schedules?.scheduled_at ?? '',
    branch_name:        row.schedules?.branches?.name ?? '',
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getGroupStudentsForSession(groupId: string): Promise<SessionStudent[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('group_students')
    .select(
      `student_id,
       students!group_students_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (error) return []

  return (data ?? []).map((row: any) => ({
    student_id:    row.student_id,
    student_email: row.students?.users?.email ?? '',
    first_name:    row.students?.users?.profiles?.first_name ?? null,
    last_name:     row.students?.users?.profiles?.last_name ?? null,
  }))
}

export async function getOrCreateGroupCourse(groupId: string, branchId: string): Promise<string | null> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return existing.id

  let courseId: string
  const { data: existingCourse } = await db
    .from('courses')
    .select('id')
    .eq('branch_id', branchId)
    .eq('title', 'General Sessions')
    .maybeSingle()

  if (existingCourse) {
    courseId = existingCourse.id
  } else {
    const { data: newCourse, error: courseError } = await db
      .from('courses')
      .insert({ branch_id: branchId, title: 'General Sessions', scope: 'branch', is_published: true })
      .select('id')
      .single()
    if (courseError || !newCourse) return null
    courseId = newCourse.id
  }

  const { data: newGC, error: gcError } = await db
    .from('group_courses')
    .insert({ group_id: groupId, course_id: courseId, status: 'active' })
    .select('id')
    .single()

  if (gcError || !newGC) return null
  return newGC.id
}
