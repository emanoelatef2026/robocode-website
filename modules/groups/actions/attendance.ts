'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import type { StudentAttendanceHistoryRecord } from './types'

// Flat row — enrichment done via separate queries to avoid PostgREST nested-FK issues
interface AttendanceRow {
  id:          string
  status:      string
  schedule_id: string
}

export async function getStudentAttendanceHistoryAction(
  studentId: string,
  enrollmentId?: string | null,
): Promise<StudentAttendanceHistoryRecord[]> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  // Use a flat query to avoid broken nested-FK paths that PostgREST rejects
  // (instructors → profiles directly via instructors_user_id_fkey is wrong;
  //  the correct path is instructors → users → profiles).
  // We fetch schedules and group_courses separately to keep the join simple.
  const consumptionQuery = db
    .from('attendance_consumptions')
    .select('attendance_record_id')
    .eq('student_id', studentId)

  if (enrollmentId) consumptionQuery.eq('enrollment_id', enrollmentId)
  const { data: consumptionRows } = await consumptionQuery
  const consumedIds = new Set(
    ((consumptionRows ?? []) as Array<{ attendance_record_id: string }>)
      .map(row => row.attendance_record_id)
  )

  // Contract-scoped attendance is intentionally read through the consumption
  // ledger. This prevents an old group or an old contract appearing under a
  // newly created package in the student quick view.
  if (enrollmentId && consumedIds.size === 0) return []

  let attendanceQuery = db
    .from('attendance_records')
    .select('id, status, schedule_id, group_name_snapshot, instructor_name_snapshot')
    .eq('student_id', studentId)
    .is('invalidated_at', null)
    .order('recorded_at', { ascending: false })
    .limit(10)

  if (enrollmentId) attendanceQuery = attendanceQuery.in('id', [...consumedIds])
  const { data: attendanceRows } = await attendanceQuery
  const attRes = { data: attendanceRows }

  if (!attRes.data || attRes.data.length === 0) return []

  // Enrich with schedule → group_course → group + instructor data
  const schedIds = (attRes.data as any[]).map((r: any) => r.schedule_id as string)

  const { data: schedRows } = await db
    .from('schedules')
    .select('id, scheduled_at, topic, group_course_id')
    .in('id', schedIds)

  const gcIds = [...new Set((schedRows ?? []).map((s: any) => s.group_course_id as string))]

  const { data: gcRows } = gcIds.length > 0
    ? await db
        .from('group_courses')
        .select(`
          id,
          groups!group_courses_group_id_fkey(name),
          instructors!group_courses_instructor_id_fkey(
            users!instructors_user_id_fkey(
              profiles!profiles_user_id_fkey(first_name, last_name)
            )
          )
        `)
        .in('id', gcIds)
    : { data: [] as any[] }

  const schedMap = new Map((schedRows ?? []).map((s: any) => [s.id as string, s]))
  const gcMap    = new Map((gcRows   ?? []).map((gc: any) => [gc.id as string, gc]))

  return (attRes.data as any[]).map(r => {
    const sched    = schedMap.get(r.schedule_id) ?? {}
    const gc       = gcMap.get((sched as any).group_course_id) ?? {}
    const instrProf = (gc as any).instructors?.users?.profiles ?? {}
    const instrName = instrProf.first_name
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ')
      : null

    return {
      id:              r.id,
      scheduled_at:    (sched as any).scheduled_at ?? '',
      topic:           (sched as any).topic        ?? null,
      group_name:      (gc    as any).groups?.name ?? r.group_name_snapshot ?? null,
      instructor_name: instrName ?? r.instructor_name_snapshot ?? null,
      status:          r.status,
      is_consumed:     consumedIds.has(r.id),
    }
  })
}
