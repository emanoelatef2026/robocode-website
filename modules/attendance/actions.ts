'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { getOrCreateGroupCourse } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import { SLOT_CONSUMING_STATUSES } from './constants'
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

  if (!isBranchAccessible(user, branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const studentIds = formData.getAll('student_ids[]') as string[]
  if (studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No students selected.' } }
  }

  // Validate student IDs against actual group membership (injection guard)
  const { data: validMembers, error: memberError } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', group_id)
    .eq('status', 'active')
    .in('student_id', studentIds)

  if (memberError) {
    return { success: false, error: { code: 'DB_ERROR', message: memberError.message } }
  }

  const validSet       = new Set((validMembers ?? []).map((m: { student_id: string }) => m.student_id))
  const safeStudentIds = studentIds.filter((sid) => validSet.has(sid))

  if (safeStudentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No valid group members found in submission.' } }
  }

  const groupCourseId = await getOrCreateGroupCourse(group_id, branch_id)
  if (!groupCourseId) {
    return { success: false, error: { code: 'DB_ERROR', message: 'Failed to initialize course for this group.' } }
  }

  // ── Parallel: FIFO enrollment lookup + session snapshot data ─────────────────
  const [
    { data: allEnrollRows },
    { data: gcSnap },
    { data: groupSnap },
    { data: branchSnap },
  ] = await Promise.all([
    db.from('student_enrollments')
      .select('id, student_id, remaining_sessions, allow_overdraft_sessions, enrolled_sessions')
      .eq('status', 'ACTIVE')
      .in('student_id', safeStudentIds)
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true }),

    db.from('group_courses')
      .select(`
        courses(title),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('id', groupCourseId)
      .maybeSingle(),

    db.from('groups').select('name').eq('id', group_id).maybeSingle(),
    db.from('branches').select('name').eq('id', branch_id).maybeSingle(),
  ])

  // Extract snapshot values (best-effort; null if join unavailable)
  const courseName = (gcSnap as any)?.courses?.title ?? null
  const instrProf  = (gcSnap as any)?.instructors?.users?.profiles
  const instrName  = instrProf
    ? ([instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null)
    : null
  const groupName  = (groupSnap as any)?.name ?? null
  const branchName = (branchSnap as any)?.name ?? null

  // ── FIFO enrollment map (oldest active enrollment per student) ────────────────
  const enrollMap   = new Map<string, { id: string; remaining: number; allow: boolean; enrolled: number }>()
  const fallbackMap = new Map<string, { id: string; remaining: number; allow: boolean; enrolled: number }>()

  for (const e of (allEnrollRows ?? []) as any[]) {
    const sid   = e.student_id as string
    const entry = {
      id:        e.id as string,
      remaining: Number(e.remaining_sessions ?? 0),
      allow:     Boolean(e.allow_overdraft_sessions),
      enrolled:  Number(e.enrolled_sessions ?? 0),
    }
    fallbackMap.set(sid, entry)
    if (!enrollMap.has(sid) && (entry.enrolled === 0 || entry.remaining > 0)) enrollMap.set(sid, entry)
  }
  for (const [sid, fb] of fallbackMap) {
    if (!enrollMap.has(sid)) enrollMap.set(sid, { ...fb, remaining: 0 })
  }

  // ── Overdraft enforcement ─────────────────────────────────────────────────────
  const overdraftBlocked: string[] = []
  const overdraftGranted: string[] = []

  for (const sid of safeStudentIds) {
    const status = (formData.get(`status_${sid}`) ?? 'present') as string
    if (!SLOT_CONSUMING_STATUSES.has(status as AttendanceStatus)) continue

    const enroll = enrollMap.get(sid)
    if (!enroll || enroll.enrolled === 0) continue  // 0 = unlimited, skip check
    if (enroll.remaining <= 0) {
      if (enroll.allow) overdraftGranted.push(sid)
      else              overdraftBlocked.push(sid)
    }
  }

  const recordableIds = safeStudentIds.filter(sid => !overdraftBlocked.includes(sid))

  if (recordableIds.length === 0) {
    return { success: false, error: { code: 'OVERDRAFT_BLOCKED', message: 'All students have exhausted their session packages. Enable overdraft or renew packages.' } }
  }

  // ── Create schedule entry ─────────────────────────────────────────────────────
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

  // ── Insert attendance records with historical snapshots ───────────────────────
  const records = recordableIds.map((sid) => ({
    schedule_id:               schedule.id,
    student_id:                sid,
    status:                    (formData.get(`status_${sid}`) ?? 'present') as AttendanceStatus,
    notes:                     (formData.get(`notes_${sid}`) as string | null) || null,
    recorded_by:               user.id,
    group_name_snapshot:       groupName,
    course_name_snapshot:      courseName,
    instructor_name_snapshot:  instrName,
    branch_name_snapshot:      branchName,
  }))

  // Select IDs back for ledger attribution
  const { data: insertedRecords, error: insertError } = await db
    .from('attendance_records')
    .insert(records)
    .select('id, student_id, status')

  if (insertError) {
    return { success: false, error: { code: 'DB_ERROR', message: insertError.message } }
  }

  // ── Idempotent session consumption via ledger ─────────────────────────────────
  // consume_attendance_sessions_batch: inserts into attendance_consumptions
  // (UNIQUE on attendance_record_id) then increments consumed_sessions.
  // Safe to retry: ON CONFLICT DO NOTHING prevents double-counting.
  const p_record_ids:     string[] = []
  const p_enrollment_ids: string[] = []
  const p_student_ids:    string[] = []

  for (const rec of (insertedRecords ?? []) as any[]) {
    if (!SLOT_CONSUMING_STATUSES.has(rec.status as AttendanceStatus)) continue
    const enroll = enrollMap.get(rec.student_id as string)
    if (enroll && enroll.enrolled > 0) {
      p_record_ids.push(rec.id)
      p_enrollment_ids.push(enroll.id)
      p_student_ids.push(rec.student_id)
    }
  }

  if (p_record_ids.length > 0) {
    await db.rpc('consume_attendance_sessions_batch', {
      p_record_ids,
      p_enrollment_ids,
      p_student_ids,
    })
  }

  // Log overdraft-granted timeline events (non-fatal)
  if (overdraftGranted.length > 0) {
    const overdraftEvents = overdraftGranted.map(sid => ({
      student_id:  sid,
      schedule_id: schedule.id,
      event_type:  'OVERDRAFT_GRANTED',
      notes:       'Session recorded past package limit (overdraft enabled)',
      created_by:  user.id,
      branch_id,
    }))
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
