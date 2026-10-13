'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { isBranchAccessible, requirePermission } from '@/modules/rbac/guards'
import { isContractAttendanceStatus } from '@/modules/attendance/status-options'
import type { ContractAttendanceStatus } from '@/modules/attendance/status-options'

export async function updateStudentAttendanceStatusAction(input: {
  studentId: string
  attendanceRecordId: string
  status: ContractAttendanceStatus
}): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requirePermission('manage_attendance')
  if (!isContractAttendanceStatus(input.status)) return { success: false, error: 'Choose a valid attendance status.' }
  const db = createServiceClient()
  const [{ data: student, error: studentError }, { data: record, error: recordError }] = await Promise.all([
    db.from('students').select('branch_id').eq('id', input.studentId).is('deleted_at', null).maybeSingle(),
    db.from('attendance_records').select('id, schedule_id, status')
      .eq('id', input.attendanceRecordId).eq('student_id', input.studentId).is('invalidated_at', null).maybeSingle(),
  ])
  if (studentError || recordError) return { success: false, error: 'Could not load the attendance record.' }
  if (!student || !record || !isBranchAccessible(user, student.branch_id)) return { success: false, error: 'Attendance not found or access denied.' }
  const { data: schedule, error: scheduleError } = await db.from('schedules')
    .select('branch_id, status').eq('id', record.schedule_id).maybeSingle()
  if (scheduleError || !schedule || !isBranchAccessible(user, schedule.branch_id)) return { success: false, error: 'No access to this session.' }
  if (schedule.status === 'cancelled') return { success: false, error: 'Cancelled sessions cannot be edited.' }

  // Keep the existing ledger attribution. Every offered status consumes the
  // same reserved slot; a Present -> Absent edit never charges a second slot.
  const { data: updated, error } = await db.from('attendance_records')
    .update({ status: input.status }).eq('id', record.id).eq('student_id', input.studentId)
    .eq('status', record.status).is('invalidated_at', null).select('id').maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!updated) return { success: false, error: 'Attendance changed since you opened it. Refresh and try again.' }

  try {
    await db.rpc('write_audit_log', {
      p_performed_by: user.id, p_action: 'update', p_entity_type: 'attendance_records', p_entity_id: record.id,
      p_old_values: { status: record.status }, p_new_values: { status: input.status }, p_branch_id: schedule.branch_id,
    })
  } catch (auditError) { console.error('Attendance status audit failed', auditError) }
  for (const path of ['/admin/groups', '/admin/attendance', '/portal/team-leader/groups', '/portal/team-leader/attendance']) revalidatePath(path)
  for (const path of ['/portal/instructor', '/portal/student', '/portal/parent']) revalidatePath(path, 'layout')
  return { success: true }
}
