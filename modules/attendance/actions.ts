'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { getOrCreateGroupCourse } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import type { ActionResult } from '@/types/app'
import type { AttendanceStatus } from '@/types/enums'

export async function recordAttendanceSession(formData: FormData): Promise<ActionResult<{ scheduleId: string }>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const group_id         = formData.get('group_id') as string
  const branch_id        = formData.get('branch_id') as string
  const session_date     = formData.get('session_date') as string
  const duration_minutes = Number(formData.get('duration_minutes') ?? 60)
  const delivery         = (formData.get('delivery') ?? 'offline') as string

  if (!group_id || !branch_id || !session_date) {
    return { success: false, error: { code: 'VALIDATION', message: 'Group, branch, and session date are required.' } }
  }

  const studentIds = formData.getAll('student_ids[]') as string[]
  if (studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No students selected.' } }
  }

  // CRITICAL-05: validate student IDs against actual group membership to prevent injection
  const { data: validMembers, error: memberError } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', group_id)
    .eq('status', 'active')
    .in('student_id', studentIds)

  if (memberError) {
    return { success: false, error: { code: 'DB_ERROR', message: memberError.message } }
  }

  const validSet = new Set((validMembers ?? []).map((m: { student_id: string }) => m.student_id))
  const safeStudentIds = studentIds.filter((sid) => validSet.has(sid))

  if (safeStudentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No valid group members found in submission.' } }
  }

  // Ensure a group_course exists for this group
  const groupCourseId = await getOrCreateGroupCourse(group_id, branch_id)
  if (!groupCourseId) {
    return { success: false, error: { code: 'DB_ERROR', message: 'Failed to initialize course for this group.' } }
  }

  // Create the schedule entry
  const { data: schedule, error: scheduleError } = await db
    .from('schedules')
    .insert({
      group_course_id:  groupCourseId,
      branch_id,
      scheduled_at:     new Date(session_date).toISOString(),
      duration_minutes,
      delivery,
      status:           'completed',
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (scheduleError || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: scheduleError?.message ?? 'Failed to create schedule.' } }
  }

  // Build attendance records from validated student IDs only
  const records = safeStudentIds.map((sid) => ({
    schedule_id:  schedule.id,
    student_id:   sid,
    status:       (formData.get(`status_${sid}`) ?? 'present') as AttendanceStatus,
    notes:        (formData.get(`notes_${sid}`) as string | null) || null,
    recorded_by:  user.id,
  }))

  const { error: insertError } = await db.from('attendance_records').insert(records)
  if (insertError) {
    return { success: false, error: { code: 'DB_ERROR', message: insertError.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'record_attendance',
    p_entity_type:  'schedule',
    p_entity_id:    schedule.id,
    p_new_values:   { group_id, session_date, student_count: records.length },
    p_branch_id:    branch_id,
  })

  // Recalculate progress for every student whose attendance was just recorded.
  // Resolves group context once (same courses/semester for all students in the group),
  // then fires all recalculations concurrently via Promise.all.
  const contexts = await resolveGroupProgressContext(group_id)
  if (contexts.length > 0) {
    await safeRecalcProgressBatch(
      buildBatchTuples(safeStudentIds, contexts),
      'recordAttendanceSession'
    )
  }

  revalidatePath('/admin/attendance')
  return { success: true, data: { scheduleId: schedule.id } }
}
