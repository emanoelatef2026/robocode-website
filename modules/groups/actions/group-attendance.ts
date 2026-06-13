'use server'

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

// ── Edit session metadata (topic / duration) ──────────────────────────────────
// Updates topic and duration for a completed session.
// Does NOT change attendance statuses or the session date (use add+delete for
// date changes — they require full reconciliation).

export async function editGroupSessionAction(
  scheduleId: string,
  patch: { topic?: string; duration_minutes?: number },
): Promise<{ success: boolean; error?: string }> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const update: Record<string, unknown> = {}
  if (patch.topic           != null) update.topic            = patch.topic
  if (patch.duration_minutes != null) update.duration_minutes = patch.duration_minutes

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await db
    .from('schedules')
    .update(update)
    .eq('id', scheduleId)

  if (error) return { success: false, error: error.message }
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

  return { fixed_enrollments: fixed }
}
