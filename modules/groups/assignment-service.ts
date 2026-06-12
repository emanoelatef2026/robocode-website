import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

type DB = ReturnType<typeof createServiceClient>

export interface GroupCourseRow {
  id:            string
  group_id:      string
  course_id:     string
  instructor_id: string | null
  status:        string
  started_at:    string | null
}

export type AssignAction = 'noop' | 'inserted' | 'updated' | 'transitioned' | 'deactivated'

export type AssignResult =
  | { action: Exclude<AssignAction, 'deactivated'>; row: GroupCourseRow }
  | { action: 'deactivated' }

// ─── Canonical assignment entry point ────────────────────────────────────────
//
// Five cases handled:
//  A  No active row for this group          → INSERT fresh row
//  B  Same course + same instructor         → no-op, return existing
//  C  Same course + different instructor    → UPDATE instructor only
//  D  Different course                      → end old row, INSERT or reactivate new
//  E  Same course found in history          → reactivate prior row
//
// assignedBy is stored for audit purposes; pass null when the caller
// does not have a user ID handy (e.g. from group-create modal).
//
// Pass db to reuse an existing service client; omit to create one.

export async function assignGroupCourseService(
  groupId:     string,
  courseId:    string | null,
  instructorId: string | null,
  assignedBy:  string | null = null,
  db?:         DB,
): Promise<AssignResult> {
  const client = db ?? createServiceClient()
  const now    = new Date().toISOString()

  // Fetch the single active assignment for this group (at most one by constraint)
  const { data: active } = await client
    .from('group_courses')
    .select('id, group_id, course_id, instructor_id, status, started_at')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  // ── No course → deactivate whatever is active ──────────────────────────────
  if (!courseId) {
    if (active) {
      await client
        .from('group_courses')
        .update({ status: 'inactive', ended_at: now, updated_at: now })
        .eq('id', active.id)
    }
    return { action: 'deactivated' }
  }

  // ── Case B: same course, same instructor → nothing to change ───────────────
  if (active?.course_id === courseId && active.instructor_id === (instructorId ?? null)) {
    return { action: 'noop', row: active as GroupCourseRow }
  }

  // ── Case C: same course, different instructor → update instructor only ─────
  if (active?.course_id === courseId) {
    const { data: updated, error } = await client
      .from('group_courses')
      .update({ instructor_id: instructorId ?? null, updated_at: now })
      .eq('id', active.id)
      .select('id, group_id, course_id, instructor_id, status, started_at')
      .single()
    if (error) throw new Error(error.message)
    return { action: 'updated', row: updated as GroupCourseRow }
  }

  // ── Cases D + E: course is changing ───────────────────────────────────────
  // End the current active assignment first
  if (active) {
    await client
      .from('group_courses')
      .update({ status: 'inactive', ended_at: now, updated_at: now })
      .eq('id', active.id)
  }

  // Case E: look for the most recent prior inactive/cancelled row for this course
  const { data: prior } = await client
    .from('group_courses')
    .select('id, group_id, course_id, instructor_id, status, started_at')
    .eq('group_id', groupId)
    .eq('course_id', courseId)
    .in('status', ['inactive', 'cancelled'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prior) {
    const { data: reactivated, error } = await client
      .from('group_courses')
      .update({
        status:        'active',
        instructor_id: instructorId ?? null,
        started_at:    now,
        ended_at:      null,
        assigned_by:   assignedBy,
        updated_at:    now,
      })
      .eq('id', prior.id)
      .select('id, group_id, course_id, instructor_id, status, started_at')
      .single()
    if (error) throw new Error(error.message)
    return { action: 'transitioned', row: reactivated as GroupCourseRow }
  }

  // Case A: no prior row for this course → fresh INSERT
  const insertPayload: Record<string, unknown> = {
    group_id:      groupId,
    course_id:     courseId,
    instructor_id: instructorId ?? null,
    status:        'active',
    started_at:    now,
    assigned_by:   assignedBy,
    total_sessions: 24,
  }

  const { data: inserted, error: insertErr } = await client
    .from('group_courses')
    .insert(insertPayload)
    .select('id, group_id, course_id, instructor_id, status, started_at')
    .single()

  if (insertErr) {
    // Fallback: retry without total_sessions (column may not exist on older DBs)
    const { total_sessions: _ts, ...withoutSessions } = insertPayload
    const { data: inserted2, error: err2 } = await client
      .from('group_courses')
      .insert(withoutSessions)
      .select('id, group_id, course_id, instructor_id, status, started_at')
      .single()
    if (err2) throw new Error(err2.message)
    return { action: 'inserted', row: inserted2 as GroupCourseRow }
  }

  return { action: 'inserted', row: inserted as GroupCourseRow }
}
