import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof createServiceClient>

// ── Course-lineage guard ────────────────────────────────────────────────────
// A student may legitimately hold more than one concurrent active membership
// (e.g. Python + Robotics — two different courses). What is never legitimate
// is two concurrent active rows for the SAME course (e.g. Python Spring +
// Python Summer) — that reflects a move or a duplicate write that should have
// closed the earlier row. `course_id` (backfilled onto both group_students and
// student_enrollments — see supabase/migrations/20260713134320_*) is the
// available lineage signal today; `group_series` will supersede it once slot
// linking begins (see docs/GROUP_SERIES_RULES.md), but nothing links groups
// to a series yet, so course_id is the correct signal to build on now.

/** The course a group is currently teaching (its one active group_courses row), or null. */
export async function resolveGroupCourseId(db: Db, groupId: string): Promise<string | null> {
  const { data } = await db
    .from('group_courses')
    .select('course_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()
  return (data as any)?.course_id ?? null
}

// ── group_students ──────────────────────────────────────────────────────────

/**
 * Before adding a student to a group teaching `courseId`, close any OTHER
 * active `group_students` row this student holds for the SAME course (a
 * different group). Rows for a different course are left completely alone —
 * that's the valid concurrent-enrollment case and must keep working.
 *
 * Returns the ids of any rows closed, so callers can log/audit what happened.
 */
export async function closeSameCourseGroupMemberships(
  db: Db,
  params: { studentId: string; courseId: string | null; excludeGroupId: string; reason: string }
): Promise<string[]> {
  if (!params.courseId) return []

  const { data: rows } = await db
    .from('group_students')
    .select('id, notes')
    .eq('student_id', params.studentId)
    .eq('status', 'active')
    .eq('course_id', params.courseId)
    .neq('group_id', params.excludeGroupId)

  const conflicting = (rows ?? []) as Array<{ id: string; notes: string | null }>
  if (!conflicting.length) return []

  const now = new Date().toISOString()
  await Promise.all(
    conflicting.map(row =>
      db.from('group_students').update({
        status:  'dropped',
        left_at: now,
        notes:   row.notes ? `${row.notes} | ${params.reason}` : params.reason,
      }).eq('id', row.id)
    )
  )

  return conflicting.map(r => r.id)
}

// ── student_enrollments ─────────────────────────────────────────────────────

/**
 * Finds this student's existing ACTIVE student_enrollments row for the given
 * course, if any — regardless of which group it's linked to (or none).
 * Callers use this to make enrollment creation idempotent: if a row already
 * exists for this student+course, reuse it instead of inserting a duplicate.
 * Oldest-first, matching the FIFO convention already used in
 * modules/academic/enrollment-ledger.ts.
 */
export async function findActiveEnrollmentForCourse(
  db: Db,
  studentId: string,
  courseId: string | null
): Promise<{ id: string } | null> {
  if (!courseId) return null
  const { data } = await db
    .from('student_enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as any) ?? null
}

// ── "Current group" resolver (deterministic replacement for joined_at DESC) ─

/**
 * Resolves "the" active group for a student, for call sites that assume
 * exactly one exists (a single-course dashboard, notification target, etc).
 *
 * Deterministic FIFO tiebreak — oldest `joined_at` first, then `id` — matching
 * the convention already used for student_enrollments in
 * modules/academic/enrollment-ledger.ts. This deliberately replaces the
 * previous `order('joined_at', {ascending:false}).limit(1)` ("most recently
 * joined") pattern repeated across the codebase: that ordering could silently
 * return the WRONG course for a student with valid concurrent memberships
 * (e.g. Python + Robotics — see docs/DUPLICATE_MEMBERSHIP_DIAGNOSTIC.md,
 * STU-000072). FIFO doesn't make multi-course ambiguity disappear — a
 * student in two courses at once still only gets one group back from this
 * function — but it is at least deterministic and stable across calls,
 * rather than silently flipping based on whichever group was joined most
 * recently. Call sites that need to be course-aware should resolve by
 * `course_id` explicitly (see `findActiveEnrollmentForCourse` above) instead
 * of using this generic resolver.
 */
export async function resolvePrimaryActiveGroupId(
  db: Db,
  studentId: string
): Promise<string | null> {
  const { data } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
    .order('id',        { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as any)?.group_id ?? null
}
