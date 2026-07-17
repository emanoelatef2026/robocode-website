import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InstructorAllocation {
  instructor_id:      string
  group_id:           string
  role:               string
  from_session:       number
  to_session:         number | null
  allocated_sessions: number | null
  allocation_status:  string
  assigned_at:        string
  handoff_notes:      string | null
}

export interface OwnershipCheckResult {
  allowed:    boolean
  reason?:    string
  allocation: InstructorAllocation | null
}

// ── Core resolution ───────────────────────────────────────────────────────────

// Get the instructor's active allocation record for a group.
export async function resolveInstructorSessionOwnership(
  instructorId: string,
  groupId:      string,
  db:           ReturnType<typeof createServiceClient>
): Promise<InstructorAllocation | null> {
  const { data } = await db
    .from('group_instructors')
    .select('instructor_id, group_id, role, from_session, to_session, allocated_sessions, allocation_status, assigned_at, handoff_notes')
    .eq('instructor_id', instructorId)
    .eq('group_id', groupId)
    .maybeSingle()

  return (data ?? null) as InstructorAllocation | null
}

// Validate whether an instructor can operate on a specific schedule.
// Checks:
//   1. Instructor is a member of the group.
//   2. Allocation is not completed/released.
//   3. Session's session_number is within [from_session, to_session].
// If session_number is null (before migration or retroactive insert), only group
// membership is checked — range enforcement activates once numbers exist.
export async function validateSessionOwnership(
  instructorId: string,
  scheduleId:   string,
  db:           ReturnType<typeof createServiceClient>
): Promise<OwnershipCheckResult> {
  const { data: sessRow } = await db
    .from('schedules')
    .select('session_number, group_courses!schedules_group_course_id_fkey(group_id, instructor_id)')
    .eq('id', scheduleId)
    .maybeSingle()

  if (!sessRow) return { allowed: false, reason: 'Session not found.', allocation: null }

  const gc            = (sessRow as any).group_courses
  const groupId       = gc?.group_id as string | undefined
  const sessionNumber = (sessRow as any).session_number as number | null

  if (!groupId) return { allowed: false, reason: 'Session has no group context.', allocation: null }

  // ── Step 1: group membership ──────────────────────────────────────────────
  const isPrimary = gc?.instructor_id === instructorId
  if (!isPrimary) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('instructor_id')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .maybeSingle()

    if (!giRow) return { allowed: false, reason: 'You are not assigned to this group.', allocation: null }
  }

  // ── Step 2: allocation range enforcement ──────────────────────────────────
  const alloc = await resolveInstructorSessionOwnership(instructorId, groupId, db)

  if (alloc) {
    if (alloc.allocation_status === 'completed') {
      return {
        allowed:    false,
        reason:     `Your session allocation (sessions ${alloc.from_session}–${alloc.to_session ?? '∞'}) is already completed.`,
        allocation: alloc,
      }
    }
    if (alloc.allocation_status === 'released') {
      return {
        allowed:    false,
        reason:     'Your assignment to this group has been released.',
        allocation: alloc,
      }
    }

    if (sessionNumber != null) {
      const aboveFrom = sessionNumber >= alloc.from_session
      const belowTo   = alloc.to_session == null || sessionNumber <= alloc.to_session

      if (!aboveFrom || !belowTo) {
        return {
          allowed:    false,
          reason:     `Session #${sessionNumber} is outside your allocated range (sessions ${alloc.from_session}–${alloc.to_session ?? '∞'}).`,
          allocation: alloc,
        }
      }
    }
  }

  return { allowed: true, allocation: alloc }
}

// Compute the next safe from_session for a new instructor assignment.
// Uses MAX(to_session) across all existing allocations — immune to cancelled/deleted schedules.
export async function computeNextAllocationStart(
  groupId: string,
  db:      ReturnType<typeof createServiceClient>
): Promise<number> {
  const { data } = await db
    .from('group_instructors')
    .select('to_session')
    .eq('group_id', groupId)
    .not('to_session', 'is', null)
    .order('to_session', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return 1
  return ((data as any).to_session as number) + 1
}

// What session_number would the NEXT new session get for this group_course?
// Mirrors assign_session_number() (migration 20260702101548): cancelled rows
// are excluded from the MAX() lookup so a cancellation doesn't permanently
// push the group's numbering — and therefore the instructor's allocation
// ceiling — past what was actually delivered or planned.
export async function peekNextSessionNumber(
  groupCourseId: string,
  db:            ReturnType<typeof createServiceClient>
): Promise<number> {
  const { data } = await db
    .from('schedules')
    .select('session_number')
    .eq('group_course_id', groupCourseId)
    .not('session_number', 'is', null)
    .neq('status', 'cancelled')
    .order('session_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? ((data as any).session_number as number) + 1 : 1
}

// Check if the instructor can create the next session (allocation range not exhausted).
export async function canInstructorCreateNextSession(
  instructorId:  string,
  groupCourseId: string,
  db:            ReturnType<typeof createServiceClient>
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: gcRow } = await db
    .from('group_courses')
    .select('group_id')
    .eq('id', groupCourseId)
    .maybeSingle()

  if (!gcRow) return { allowed: false, reason: 'Group course not found.' }
  const groupId = (gcRow as any).group_id as string

  const alloc = await resolveInstructorSessionOwnership(instructorId, groupId, db)
  if (!alloc) return { allowed: true }  // No allocation record — unrestricted

  if (alloc.allocation_status !== 'active') {
    return { allowed: false, reason: `Your allocation for this group is ${alloc.allocation_status}.` }
  }

  if (alloc.to_session != null) {
    const next = await peekNextSessionNumber(groupCourseId, db)
    if (next > alloc.to_session) {
      return {
        allowed: false,
        reason:  `Session #${next} would exceed your allocation limit (sessions ${alloc.from_session}–${alloc.to_session}).`,
      }
    }
  }

  return { allowed: true }
}

// Mark an instructor's allocation as completed and drive group lifecycle.
// Called automatically when the instructor ends their last allocated session.
export async function completeInstructorAllocation(
  instructorId: string,
  groupId:      string,
  db:           ReturnType<typeof createServiceClient>
): Promise<void> {
  const now = new Date().toISOString()

  await db
    .from('group_instructors')
    .update({ allocation_status: 'completed', released_at: now })
    .eq('instructor_id', instructorId)
    .eq('group_id', groupId)
    .eq('allocation_status', 'active')

  // Are there any remaining active allocations for this group?
  const { count: activeCount } = await db
    .from('group_instructors')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('allocation_status', 'active')

  if ((activeCount ?? 0) > 0) return  // Another instructor still has an active range — nothing to do.

  // All allocations are done. Determine what comes next.
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id, total_sessions')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  const totalSessions = (gcRow as any)?.total_sessions as number | null

  // Highest to_session across all completed allocations
  const [maxToResult, groupResult] = await Promise.all([
    db.from('group_instructors')
      .select('to_session')
      .eq('group_id', groupId)
      .not('to_session', 'is', null)
      .order('to_session', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('groups')
      .select('completed_sessions')
      .eq('id', groupId)
      .maybeSingle(),
  ])

  const highestTo        = (maxToResult.data as any)?.to_session as number | null
  const completedSessions = (groupResult.data as any)?.completed_sessions as number ?? 0

  // Auto-complete only if allocation coverage AND actual delivered sessions both satisfy total.
  // If sessions were cancelled, completedSessions < totalSessions and the group must stay open
  // for makeup sessions rather than being prematurely marked complete.
  const allocationCovered  = totalSessions != null && highestTo != null && highestTo >= totalSessions
  const sessionsDelivered  = totalSessions != null && completedSessions >= totalSessions

  if (allocationCovered && sessionsDelivered) {
    // All teaching sessions covered and delivered → auto-complete the group
    await db.from('groups').update({ status: 'completed' })
      .eq('id', groupId)
      .in('status', ['active', 'handoff_pending'])

    if (gcRow) {
      await db.from('group_courses')
        .update({ status: 'completed', ended_at: now })
        .eq('id', (gcRow as any).id)
    }
  } else {
    // Instructor done but group has remaining or undelivered sessions — needs next instructor or makeups
    await db.from('groups').update({ status: 'handoff_pending' })
      .eq('id', groupId)
      .in('status', ['active', 'forming'])
  }
}
