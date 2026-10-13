'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { isBranchAccessible, requirePermission } from '@/modules/rbac/guards'
import type { StudentAttendanceBrowserData } from '../attendance-browser'

type QueryResult<T> = { data: T[] | null; error: { message: string } | null }

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

// PostgREST caps individual responses. Read every page so totals and old
// contracts do not silently disappear for students with a long history.
async function readPages<T>(query: (from: number, to: number) => PromiseLike<QueryResult<T>>): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset, offset + 499)
    if (error) throw new Error(error.message)
    result.push(...(data ?? []))
    if (!data || data.length < 500) return result
  }
}

export async function getStudentAttendanceBrowserAction(studentId: string): Promise<StudentAttendanceBrowserData> {
  const user = await requirePermission('manage_attendance')
  const db = createServiceClient()
  const { data: student, error } = await db.from('students').select('id, branch_id')
    .eq('id', studentId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  if (!student || !isBranchAccessible(user, student.branch_id)) throw new Error('Student not found or access denied.')

  const [enrollments, attendance, consumptions] = await Promise.all([
    readPages((from, to) => db.from('student_enrollments')
      .select('id, contract_code, course_id, course_name_snapshot, group_name_snapshot, start_date, status, enrolled_sessions, consumed_sessions, remaining_sessions')
      .eq('student_id', studentId).order('created_at', { ascending: false }).order('id').range(from, to)),
    readPages((from, to) => db.from('attendance_records')
      .select('id, status, schedule_id, recorded_at, group_name_snapshot, course_name_snapshot, instructor_name_snapshot')
      .eq('student_id', studentId).is('invalidated_at', null).order('id').range(from, to)),
    readPages((from, to) => db.from('attendance_consumptions')
      .select('attendance_record_id, enrollment_id').eq('student_id', studentId).order('id').range(from, to)),
  ])

  const scheduleIds = [...new Set(attendance.map(row => row.schedule_id).filter(Boolean))]
  const schedules = []
  for (let offset = 0; offset < scheduleIds.length; offset += 200) {
    const { data, error } = await db.from('schedules').select('id, scheduled_at, topic, group_course_id')
      .in('id', scheduleIds.slice(offset, offset + 200))
    if (error) throw new Error(error.message)
    schedules.push(...(data ?? []))
  }
  const groupCourseIds = [...new Set(schedules.map(row => row.group_course_id).filter(Boolean))]
  const groupCourses = []
  for (let offset = 0; offset < groupCourseIds.length; offset += 200) {
    const { data, error } = await db.from('group_courses')
      .select('id, course_id, groups!group_courses_group_id_fkey(name), instructors!group_courses_instructor_id_fkey(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))')
      .in('id', groupCourseIds.slice(offset, offset + 200))
    if (error) throw new Error(error.message)
    groupCourses.push(...(data ?? []))
  }
  const courseIds = [...new Set([...enrollments, ...groupCourses].map(row => row.course_id).filter(Boolean))]
  const courses = []
  for (let offset = 0; offset < courseIds.length; offset += 200) {
    const { data, error } = await db.from('courses').select('id, title').in('id', courseIds.slice(offset, offset + 200))
    if (error) throw new Error(error.message)
    courses.push(...(data ?? []))
  }
  const courseMap = new Map(courses.map(row => [row.id, row.title]))
  const enrollmentMap = new Map(enrollments.map(row => [row.id, row]))
  const consumptionMap = new Map(consumptions.map(row => [row.attendance_record_id, row.enrollment_id]))
  const scheduleMap = new Map(schedules.map(row => [row.id, row]))
  const groupCourseMap = new Map(groupCourses.map(row => [row.id, row]))

  return {
    contracts: enrollments.map(row => ({
      id: row.id, code: row.contract_code, course_id: row.course_id,
      course_name: row.course_name_snapshot ?? courseMap.get(row.course_id) ?? 'General sessions',
      group_name: row.group_name_snapshot, start_date: row.start_date, status: row.status,
      enrolled_sessions: Number(row.enrolled_sessions ?? 0),
      consumed_sessions: Number(row.consumed_sessions ?? 0),
      remaining_sessions: Number(row.remaining_sessions ?? 0),
    })),
    records: attendance.map(row => {
      const enrollmentId = consumptionMap.get(row.id) ?? null
      const enrollment = enrollmentId ? enrollmentMap.get(enrollmentId) : undefined
      const schedule = scheduleMap.get(row.schedule_id)
      const groupCourse = schedule?.group_course_id ? groupCourseMap.get(schedule.group_course_id) : undefined
      // Course follows the actual lesson. Standalone/manual lessons fall back
      // to their explicitly linked contract, never to the student's current group.
      const courseId = groupCourse?.course_id ?? enrollment?.course_id ?? null
      const profile = one(one(one(groupCourse?.instructors)?.users)?.profiles)
      const instructorName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : null
      return {
        id: row.id, status: row.status, enrollment_id: enrollmentId,
        scheduled_at: schedule?.scheduled_at ?? row.recorded_at,
        topic: schedule?.topic ?? null,
        group_name: row.group_name_snapshot ?? one(groupCourse?.groups)?.name ?? null,
        instructor_name: row.instructor_name_snapshot ?? instructorName,
        course_id: courseId,
        course_name: row.course_name_snapshot ?? courseMap.get(courseId) ?? enrollment?.course_name_snapshot ?? 'General sessions',
        is_consumed: Boolean(enrollmentId),
      }
    }),
  }
}
