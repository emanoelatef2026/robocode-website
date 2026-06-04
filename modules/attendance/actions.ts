'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
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

  // CRITICAL: verify the caller owns the branch being written to before any DB write
  if (!isBranchAccessible(user, branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
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

  // ── Phase 14: Overdraft enforcement ───────────────────────────────────────
  // Slot-consuming statuses: present, late, makeup (absent/excused don't consume a session)
  const SLOT_CONSUMING = new Set(['present', 'late', 'makeup'])

  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select('student_id, remaining_sessions, allow_overdraft_sessions, enrolled_sessions')
    .eq('group_id', group_id)
    .eq('status', 'ACTIVE')
    .in('student_id', safeStudentIds)

  const enrollMap = new Map<string, { remaining: number; allow: boolean; enrolled: number }>()
  for (const e of (enrollRows ?? []) as any[]) {
    enrollMap.set(e.student_id, {
      remaining: Number(e.remaining_sessions ?? 0),
      allow:     Boolean(e.allow_overdraft_sessions),
      enrolled:  Number(e.enrolled_sessions ?? 0),
    })
  }

  // Identify overdraft students (attending but sessions exhausted + not allowed)
  const overdraftBlocked: string[] = []
  const overdraftGranted: string[] = []

  for (const sid of safeStudentIds) {
    const status = (formData.get(`status_${sid}`) ?? 'present') as string
    if (!SLOT_CONSUMING.has(status)) continue

    const enroll = enrollMap.get(sid)
    if (!enroll || enroll.enrolled === 0) continue  // 0 = unlimited, skip check
    if (enroll.remaining <= 0) {
      if (enroll.allow) {
        overdraftGranted.push(sid)
      } else {
        overdraftBlocked.push(sid)
      }
    }
  }

  // Allow overdraft-granted students through but remove blocked ones
  const recordableIds = safeStudentIds.filter(sid => !overdraftBlocked.includes(sid))

  // Build attendance records from recordable IDs only
  const records = recordableIds.map((sid) => ({
    schedule_id:  schedule.id,
    student_id:   sid,
    status:       (formData.get(`status_${sid}`) ?? 'present') as AttendanceStatus,
    notes:        (formData.get(`notes_${sid}`) as string | null) || null,
    recorded_by:  user.id,
  }))

  if (records.length === 0) {
    return { success: false, error: { code: 'OVERDRAFT_BLOCKED', message: `All students have exhausted their session packages. Enable overdraft in their enrollment or renew packages.` } }
  }

  const { error: insertError } = await db.from('attendance_records').insert(records)
  if (insertError) {
    return { success: false, error: { code: 'DB_ERROR', message: insertError.message } }
  }

  // Log OVERDRAFT_GRANTED timeline events for students who attended past their limit
  if (overdraftGranted.length > 0) {
    const overdraftEvents = overdraftGranted.map(sid => ({
      student_id:    sid,
      schedule_id:   schedule.id,
      event_type:    'OVERDRAFT_GRANTED',
      notes:         'Session recorded past package limit (overdraft enabled)',
      created_by:    user.id,
      branch_id,
    }))
    // Non-fatal: insert timeline events if table exists
    try { await db.from('student_timeline_events').insert(overdraftEvents) } catch { /* table may not exist yet */ }
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
