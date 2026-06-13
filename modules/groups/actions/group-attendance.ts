'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { recordAttendanceSession } from '@/modules/attendance/actions'

// ── Add a new attendance session from the TL group panel ─────────────────────
// Thin wrapper over recordAttendanceSession that accepts typed params instead
// of FormData.  Creates the canonical schedule + attendance records + runs
// package consumption.  Calling again with the same date/group upserts.

export async function addGroupSessionAction(params: {
  groupId:         string
  branchId:        string
  sessionDatetime: string    // ISO or 'YYYY-MM-DDTHH:mm' from datetime-local input
  topic:           string
  durationMinutes: number
  delivery:        'online' | 'offline'
  students:        { student_id: string; status: string }[]
}): Promise<{ success: boolean; error?: string; scheduleId?: string }> {
  // Permission check happens inside recordAttendanceSession; calling here first
  // for a fast fail before building FormData.
  await requirePermission('manage_attendance')

  const fd = new FormData()
  fd.set('group_id',         params.groupId)
  fd.set('branch_id',        params.branchId)
  fd.set('session_date',     params.sessionDatetime)
  fd.set('topic',            params.topic)
  fd.set('duration_minutes', String(params.durationMinutes))
  fd.set('delivery',         params.delivery)

  for (const s of params.students) {
    fd.append('student_ids[]', s.student_id)
    fd.set(`status_${s.student_id}`, s.status)
  }

  const result = await recordAttendanceSession(fd)
  if (!result.success) return { success: false, error: (result.error as { message: string }).message }
  return { success: true, scheduleId: (result.data as { scheduleId: string }).scheduleId }
}

// ── Edit session — full canonical update ─────────────────────────────────────
// Handles any combination of:
//   • topic / duration_minutes / delivery — metadata-only changes
//   • scheduled_at — date/time change; triggers per-student enrollment re-evaluation
//   • student_statuses — per-student attendance status changes
//
// After any change the function calls recompute_schedule_consumptions() which:
//   1. Re-evaluates each student's enrollment window against the session date
//   2. Adds or removes attendance_consumptions entries accordingly
//   3. Recomputes consumed_sessions for all affected enrollments
//
// This ensures instructor history, student attendance, package consumption,
// remaining sessions, progress bars and analytics all reflect the edit without
// any stale data.

export async function editGroupSessionAction(
  scheduleId: string,
  patch: {
    topic?:            string
    duration_minutes?: number
    scheduled_at?:     string   // ISO datetime string; re-evaluates consumption windows
    delivery?:         'online' | 'offline'
    student_statuses?: { student_id: string; status: string }[]
  },
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  // ── 1. Update schedule metadata ───────────────────────────────────────────
  const schedUpdate: Record<string, unknown> = {}
  if (patch.topic            != null) schedUpdate.topic            = patch.topic
  if (patch.duration_minutes != null) schedUpdate.duration_minutes = patch.duration_minutes
  if (patch.delivery         != null) schedUpdate.delivery         = patch.delivery
  if (patch.scheduled_at     != null) schedUpdate.scheduled_at     = new Date(patch.scheduled_at).toISOString()

  if (Object.keys(schedUpdate).length > 0) {
    const { error } = await db
      .from('schedules')
      .update(schedUpdate)
      .eq('id', scheduleId)
    if (error) return { success: false, error: error.message }
  }

  // ── 2. Update per-student attendance statuses ─────────────────────────────
  if (patch.student_statuses && patch.student_statuses.length > 0) {
    for (const s of patch.student_statuses) {
      const { error } = await db
        .from('attendance_records')
        .update({ status: s.status })
        .eq('schedule_id', scheduleId)
        .eq('student_id', s.student_id)
        .is('invalidated_at', null)
      if (error) return { success: false, error: error.message }
    }
  }

  // ── 3. Re-evaluate consumption for every student in this session ──────────
  // recompute_schedule_consumptions() is idempotent — safe to call even when
  // only topic/duration changed (no-ops in that case).
  const { error: rpcErr } = await db.rpc('recompute_schedule_consumptions', {
    p_schedule_id: scheduleId,
  })
  if (rpcErr) return { success: false, error: rpcErr.message }

  // ── 4. Revalidate all affected portal paths ───────────────────────────────
  revalidatePath('/admin/attendance')
  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/instructor', 'layout')
  revalidatePath('/portal/student', 'layout')

  return { success: true }
}

// ── Delete a session with full cascade ────────────────────────────────────────
// Calls cancel_schedule_with_cascade() which:
//   1. Invalidates all attendance_records for the session
//   2. Removes their attendance_consumptions entries
//   3. Recomputes consumed_sessions for affected enrollments
//   4. Marks the schedule as 'cancelled'

export async function deleteGroupSessionAction(
  scheduleId: string,
): Promise<{
  invalidated_records:    number
  deleted_consumptions:   number
  recomputed_enrollments: number
}> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data, error } = await db.rpc('cancel_schedule_with_cascade', {
    p_schedule_id: scheduleId,
  })

  if (error) throw new Error(error.message)

  // Revalidate all portals so instructor history, student attendance, and
  // package consumption reflect the deletion immediately.
  revalidatePath('/admin/attendance')
  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/instructor', 'layout')
  revalidatePath('/portal/student', 'layout')

  return data as {
    invalidated_records:    number
    deleted_consumptions:   number
    recomputed_enrollments: number
  }
}

// ── Rebuild attendance consumption for all students in a group ────────────────
// Re-runs the full consumption reconciliation for every active enrollment whose
// student is in the group.  Safe to call at any time — idempotent.

export async function rebuildGroupAttendanceAction(
  groupId: string,
): Promise<{ fixed_enrollments: number }> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data: gsRows } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const studentIds = ((gsRows ?? []) as { student_id: string }[]).map(r => r.student_id)
  if (studentIds.length === 0) return { fixed_enrollments: 0 }

  const { data: results } = await db.rpc('recompute_session_consumption')
  const allResults = (results ?? []) as { enrollment_id: string; fixed: boolean }[]

  const { data: enrollRows } = await db
    .from('student_enrollments')
    .select('id')
    .in('student_id', studentIds)
    .eq('status', 'ACTIVE')

  const enrollIds = new Set(((enrollRows ?? []) as { id: string }[]).map(r => r.id))
  const fixed = allResults.filter(r => r.fixed && enrollIds.has(r.enrollment_id)).length

  revalidatePath('/admin/attendance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/instructor', 'layout')
  revalidatePath('/portal/student', 'layout')

  return { fixed_enrollments: fixed }
}
