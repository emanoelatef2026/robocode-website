'use server'

import { revalidatePath }          from 'next/cache'
import { createServiceClient }     from '@/lib/supabase/service'
import { requirePermission }       from '@/modules/rbac/guards'
import { computeNextAllocationStart } from '@/modules/academic/session-ownership'
import type { ActionResult }       from '@/types/app'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AllocationLockState = 'unlocked' | 'partially_locked' | 'fully_locked'

export interface AllocationRow {
  instructor_id:             string
  instructor_name:           string
  role:                      string
  from_session:              number
  to_session:                number | null
  allocated_sessions:        number | null
  allocation_status:         string
  assigned_at:               string
  released_at:               string | null
  handoff_notes:             string | null
  sessions_completed:        number
  highest_consumed_session:  number   // MAX session_number of completed sessions in range (0 = none)
  lock_state:                AllocationLockState
  is_locked:                 boolean  // true when lock_state !== 'unlocked' (backward compat)
}

export interface GroupAllocationContext {
  group_id:          string
  total_sessions:    number | null
  open_ended:        boolean
  next_from_session: number
  allocations:       AllocationRow[]
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

export async function getGroupAllocationsAction(
  groupId: string
): Promise<ActionResult<GroupAllocationContext>> {
  await requirePermission('manage_groups')
  const db = createServiceClient()

  const [giRes, gcRes] = await Promise.all([
    db.from('group_instructors')
      .select(`
        instructor_id, role, from_session, to_session, allocated_sessions,
        allocation_status, assigned_at, released_at, handoff_notes,
        instructors!group_instructors_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('group_id', groupId)
      .order('from_session', { ascending: true }),
    db.from('group_courses')
      .select('total_sessions, open_ended')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const rows          = (giRes.data ?? []) as any[]
  const gcRow         = gcRes.data as any
  const totalSessions = gcRow?.total_sessions as number | null ?? null
  const openEnded     = (gcRow?.open_ended as boolean) ?? false

  // Load allocation summary view once — avoids N+1
  const { data: summaryRows } = await db
    .from('v_instructor_allocation_summary')
    .select('instructor_id, sessions_completed_in_range, highest_consumed_session')
    .eq('group_id', groupId)

  const summaryMap = new Map<string, { done: number; highestConsumed: number }>()
  for (const s of (summaryRows ?? []) as any[]) {
    summaryMap.set(s.instructor_id as string, {
      done:            s.sessions_completed_in_range as number,
      highestConsumed: s.highest_consumed_session    as number,
    })
  }

  const allocations: AllocationRow[] = rows.map((gi: any): AllocationRow => {
    const prof             = gi.instructors?.users?.profiles ?? {}
    const name             = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    const summary          = summaryMap.get(gi.instructor_id)
    const done             = summary?.done            ?? 0
    const highestConsumed  = summary?.highestConsumed ?? 0
    const toSess           = gi.to_session as number | null

    let lockState: AllocationLockState
    if (done === 0) {
      lockState = 'unlocked'
    } else if (toSess !== null && highestConsumed >= toSess) {
      lockState = 'fully_locked'
    } else {
      lockState = 'partially_locked'
    }

    return {
      instructor_id:            gi.instructor_id,
      instructor_name:          name,
      role:                     gi.role,
      from_session:             gi.from_session,
      to_session:               toSess,
      allocated_sessions:       gi.allocated_sessions,
      allocation_status:        gi.allocation_status,
      assigned_at:              gi.assigned_at,
      released_at:              gi.released_at,
      handoff_notes:            gi.handoff_notes,
      sessions_completed:       done,
      highest_consumed_session: highestConsumed,
      lock_state:               lockState,
      is_locked:                lockState !== 'unlocked',
    }
  })

  const nextFromSession = await computeNextAllocationStart(groupId, db)

  return {
    success: true,
    data: {
      group_id:          groupId,
      total_sessions:    totalSessions,
      open_ended:        openEnded,
      next_from_session: nextFromSession,
      allocations,
    },
  }
}

// ── Add allocation ─────────────────────────────────────────────────────────────

export async function addGroupAllocationAction(
  groupId:           string,
  instructorId:      string,
  allocatedSessions: number | null,
  notes?:            string,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  // Prevent duplicate allocation for same instructor+group
  const { data: existing } = await db
    .from('group_instructors')
    .select('instructor_id')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: {
        code:    'DUPLICATE',
        message: 'This instructor already has an allocation for this group. Edit the existing one instead.',
      },
    }
  }

  const canonicalFrom = await computeNextAllocationStart(groupId, db)

  // Overlap check (only when we know to_session)
  if (allocatedSessions != null) {
    const toSession = canonicalFrom + allocatedSessions - 1
    const { data: conflicts } = await db
      .from('group_instructors')
      .select('instructor_id, from_session, to_session')
      .eq('group_id', groupId)
      .not('to_session', 'is', null)

    for (const c of (conflicts ?? []) as any[]) {
      if (canonicalFrom <= (c.to_session as number) && toSession >= (c.from_session as number)) {
        return {
          success: false,
          error: {
            code:    'OVERLAP',
            message: `Allocation would overlap with an existing range (sessions ${c.from_session}–${c.to_session}).`,
          },
        }
      }
    }
  }

  // Cross-branch entry so the instructor can be fetched by group's branch
  const { data: grp } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (grp) {
    await db.from('instructor_branches').upsert(
      { instructor_id: instructorId, branch_id: (grp as any).branch_id, is_primary: false },
      { onConflict: 'instructor_id,branch_id', ignoreDuplicates: true },
    )
  }

  const payload: Record<string, unknown> = {
    group_id:          groupId,
    instructor_id:     instructorId,
    role:              'lead',
    from_session:      canonicalFrom,
    allocation_status: 'active',
    assigned_at:       new Date().toISOString(),
    handoff_notes:     notes || null,
    released_at:       null,
  }
  if (allocatedSessions != null) {
    payload.allocated_sessions = allocatedSessions
    payload.to_session         = canonicalFrom + allocatedSessions - 1
  }

  const { error } = await db.from('group_instructors').insert(payload)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Sync group_courses.instructor_id when it's unset (first instructor for this group)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id, instructor_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  if (gcRow && !(gcRow as any).instructor_id) {
    await db.from('group_courses').update({ instructor_id: instructorId }).eq('id', (gcRow as any).id)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'add_allocation',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   { instructor_id: instructorId, from_session: canonicalFrom, allocated_sessions: allocatedSessions },
  })

  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Update allocation status / notes ──────────────────────────────────────────

export async function updateGroupAllocationAction(
  groupId:      string,
  instructorId: string,
  status:       string,
  notes?:       string,
): Promise<ActionResult<void>> {
  await requirePermission('manage_groups')
  const db = createServiceClient()

  const updates: Record<string, unknown> = {
    allocation_status: status,
    handoff_notes:     notes ?? null,
  }
  if (status === 'released' || status === 'completed') {
    updates.released_at = new Date().toISOString()
  }

  const { error } = await db
    .from('group_instructors')
    .update(updates)
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Edit allocation range (partial locking) ───────────────────────────────────

export async function editGroupAllocationRangeAction(
  groupId:             string,
  instructorId:        string,
  newAllocatedSessions: number,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  // Fetch the current allocation
  const { data: giRow } = await db
    .from('group_instructors')
    .select('from_session, to_session, allocated_sessions, allocation_status')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  if (!giRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Allocation not found.' } }
  }

  const gi = giRow as { from_session: number; to_session: number | null; allocated_sessions: number | null; allocation_status: string }

  if (gi.allocation_status === 'released' || gi.allocation_status === 'completed') {
    return {
      success: false,
      error: {
        code:    'IMMUTABLE',
        message: `Cannot edit a ${gi.allocation_status} allocation.`,
      },
    }
  }

  // Fetch consumption boundary
  const { data: summRow } = await db
    .from('v_instructor_allocation_summary')
    .select('sessions_completed_in_range, highest_consumed_session')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  const highestConsumed = (summRow as any)?.highest_consumed_session ?? 0
  const newToSession    = gi.from_session + newAllocatedSessions - 1

  // Cannot reduce below consumed boundary
  if (highestConsumed > 0 && newToSession < highestConsumed) {
    return {
      success: false,
      error: {
        code:    'BELOW_CONSUMED',
        message: `Cannot set to_session (${newToSession}) below the highest consumed session (${highestConsumed}). Minimum: ${highestConsumed - gi.from_session + 1} sessions.`,
      },
    }
  }

  // Cannot exceed group total_sessions (skipped for open-ended groups)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('total_sessions, open_ended')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  const totalSessions = (gcRow as any)?.total_sessions as number | null ?? null
  const isOpenEnded   = (gcRow as any)?.open_ended as boolean ?? false
  if (!isOpenEnded && totalSessions !== null && newToSession > totalSessions) {
    return {
      success: false,
      error: {
        code:    'EXCEEDS_TOTAL',
        message: `New range (1–${newToSession}) exceeds the group's planned sessions (${totalSessions}).`,
      },
    }
  }

  // Cannot overlap with other allocations (excluding this instructor's own row)
  const { data: others } = await db
    .from('group_instructors')
    .select('instructor_id, from_session, to_session')
    .eq('group_id', groupId)
    .neq('instructor_id', instructorId)
    .not('to_session', 'is', null)

  for (const other of (others ?? []) as any[]) {
    const oFrom = other.from_session as number
    const oTo   = other.to_session   as number
    if (gi.from_session <= oTo && newToSession >= oFrom) {
      return {
        success: false,
        error: {
          code:    'OVERLAP',
          message: `New range (${gi.from_session}–${newToSession}) overlaps with another allocation (sessions ${oFrom}–${oTo}).`,
        },
      }
    }
  }

  const { error } = await db
    .from('group_instructors')
    .update({
      allocated_sessions: newAllocatedSessions,
      to_session:         newToSession,
    })
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'edit_allocation_range',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_new_values:   {
      instructor_id:        instructorId,
      new_allocated_sessions: newAllocatedSessions,
      new_to_session:       newToSession,
      highest_consumed:     highestConsumed,
    },
  })

  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Remove allocation ──────────────────────────────────────────────────────────

export async function removeGroupAllocationAction(
  groupId:      string,
  instructorId: string,
): Promise<ActionResult<void>> {
  await requirePermission('manage_groups')
  const db = createServiceClient()

  // Safety: block if any completed sessions in range
  const { data: summRow } = await db
    .from('v_instructor_allocation_summary')
    .select('sessions_completed_in_range')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  const done = (summRow as any)?.sessions_completed_in_range ?? 0
  if (done > 0) {
    return {
      success: false,
      error: {
        code:    'BLOCKED',
        message: `Cannot remove: ${done} completed session(s) in this instructor's range. Change status to "released" instead.`,
      },
    }
  }

  const { error } = await db
    .from('group_instructors')
    .delete()
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}
