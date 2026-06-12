'use server'

import { createServiceClient } from '@/lib/supabase/service'
import type { StudentAttendanceHistoryRecord } from './types'

interface AttendanceRow {
  id:      string
  status:  string
  schedules?: {
    scheduled_at?: string | null
    topic?:        string | null
    group_courses?: {
      groups?:       { name?: string | null } | null
      instructors?:  {
        profiles?: { first_name?: string | null; last_name?: string | null } | null
      } | null
    } | null
  } | null
}

export async function getStudentAttendanceHistoryAction(
  studentId: string,
): Promise<StudentAttendanceHistoryRecord[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('attendance_records')
    .select(`
      id, status,
      schedules!attendance_records_schedule_id_fkey(
        scheduled_at, topic,
        group_courses!schedules_group_course_id_fkey(
          groups!group_courses_group_id_fkey(name),
          instructors!group_courses_instructor_id_fkey(
            profiles!instructors_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .eq('student_id', studentId)
    .order('id', { ascending: false })
    .limit(5)

  if (!data) return []

  return (data as AttendanceRow[]).map(r => {
    const sched = r.schedules ?? {}
    const gc    = sched.group_courses ?? {}
    const prof  = gc.instructors?.profiles ?? {}
    const instrName = prof.first_name
      ? [prof.first_name, prof.last_name].filter(Boolean).join(' ')
      : null

    return {
      id:              r.id,
      scheduled_at:    sched.scheduled_at ?? '',
      topic:           sched.topic        ?? null,
      group_name:      gc.groups?.name    ?? null,
      instructor_name: instrName,
      status:          r.status,
    }
  })
}
