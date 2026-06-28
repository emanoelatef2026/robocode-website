import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-test' }),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  editGroupAllocationRangeAction,
  removeGroupAllocationAction,
} from '@/modules/groups/allocation-actions'
import { getLiveInstructorFinance } from '@/modules/staff-finance/queries'

// ── Helper ────────────────────────────────────────────────────────────────────

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// ── 1. Remove allocation after attendance exists ──────────────────────────────

describe('removeGroupAllocationAction — with historical attendance', () => {
  it('succeeds even when session_instructors records exist for this instructor', async () => {
    // The guard that blocked deletion when sessions_completed_in_range > 0 is removed.
    // session_instructors rows are on a separate FK chain (schedules + instructors)
    // and are NOT cascade-deleted when group_instructors is removed.
    mockDb({
      group_instructors: [{ data: null, error: null }], // delete succeeds
    })

    const result = await removeGroupAllocationAction('grp-1', 'instr-1')

    expect(result.success).toBe(true)
  })

  it('returns DB_ERROR when the delete itself fails', async () => {
    mockDb({
      group_instructors: [{ data: null, error: { message: 'FK violation', code: '23503' } }],
    })

    const result = await removeGroupAllocationAction('grp-1', 'instr-1')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('DB_ERROR')
  })
})

// ── 2. Edit allocation after attendance exists ────────────────────────────────

describe('editGroupAllocationRangeAction — shrink below attended sessions', () => {
  // Scenario: instructor has allocation 1–10, has attended sessions 6–7 (session_number > 5).
  // Attempt to shrink to 5 sessions (newToSession = 5) → must be blocked.

  function setupEdit(
    siRows: MockResult,       // response for session_instructors
    futureScheds: MockResult, // response for schedules (sessions beyond newToSession)
  ) {
    mockDb({
      group_instructors: [
        { data: { from_session: 1, to_session: 10, allocated_sessions: 10, allocation_status: 'active' }, error: null },
      ],
      v_instructor_allocation_summary: [
        { data: { sessions_completed_in_range: 5, highest_consumed_session: 5 }, error: null },
      ],
      group_courses: [
        { data: { id: 'gc-1', total_sessions: 20, open_ended: false }, error: null },
      ],
      schedules:           [futureScheds],
      session_instructors: [siRows],
    })
  }

  it('blocks shrink when instructor has attendance records beyond new range', async () => {
    setupEdit(
      { data: [{ id: 'si-1' }], error: null },          // attendance exists for sessions > 5
      { data: [{ id: 'sched-6' }, { id: 'sched-7' }], error: null },
    )

    const result = await editGroupAllocationRangeAction('grp-1', 'instr-1', 5)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('HAS_ATTENDANCE_BEYOND_RANGE')
  })

  it('allows shrink when no session_instructors records exist beyond the new range', async () => {
    // Instructor can shrink from 10 → 8 because no attendance beyond session 8
    mockDb({
      group_instructors: [
        { data: { from_session: 1, to_session: 10, allocated_sessions: 10, allocation_status: 'active' }, error: null },
        // second call is the update
        { data: null, error: null },
      ],
      v_instructor_allocation_summary: [
        { data: { sessions_completed_in_range: 3, highest_consumed_session: 3 }, error: null },
      ],
      group_courses: [
        { data: { id: 'gc-1', total_sessions: 20, open_ended: false }, error: null },
      ],
      schedules: [
        { data: [{ id: 'sched-9' }, { id: 'sched-10' }], error: null },
      ],
      session_instructors: [
        { data: [], error: null }, // no attendance beyond session 8
      ],
    })

    const result = await editGroupAllocationRangeAction('grp-1', 'instr-1', 8)

    expect(result.success).toBe(true)
  })

  it('allows expanding allocation range with no check needed', async () => {
    // Expanding from 10 → 12: isShrinking = false, no session_instructors query
    mockDb({
      group_instructors: [
        { data: { from_session: 1, to_session: 10, allocated_sessions: 10, allocation_status: 'active' }, error: null },
        { data: null, error: null },
      ],
      v_instructor_allocation_summary: [
        { data: { sessions_completed_in_range: 5, highest_consumed_session: 5 }, error: null },
      ],
      group_courses: [
        { data: { id: 'gc-1', total_sessions: 20, open_ended: false }, error: null },
      ],
      // No schedules/session_instructors queued — they should not be called for an expansion
    })

    const result = await editGroupAllocationRangeAction('grp-1', 'instr-1', 12)

    expect(result.success).toBe(true)
  })
})

// ── 3. Payroll after allocation deletion ──────────────────────────────────────

describe('getLiveInstructorFinance — after allocation deletion', () => {
  it('still attributes sessions to instructor via session_instructors even with no group_instructors row', async () => {
    // Allocation for instr-1 has been deleted from group_instructors.
    // But session_instructors still has a record linking instr-1 to sched-1.
    // Payroll must still count that session for instr-1.
    mockDb({
      schedules: [
        { data: [{ id: 'sched-1', branch_id: 'br-1', group_course_id: 'gc-1' }], error: null },
      ],
      group_courses: [
        { data: [{ id: 'gc-1', group_id: 'grp-1', instructor_id: null }], error: null },
      ],
      group_instructors: [
        { data: [], error: null }, // allocation deleted — no rows
      ],
      payroll_session_overrides: [
        { data: [], error: null },
      ],
      session_instructors: [
        { data: [{ session_id: 'sched-1', instructor_id: 'instr-1' }], error: null },
      ],
      instructors: [
        {
          data: [{
            id: 'instr-1', user_id: 'usr-1',
            salary_per_session: 200, currency: 'EGP',
            instapay_number: null, payment_notes: null, payment_method: null,
          }],
          error: null,
        },
      ],
      profiles: [
        { data: [{ user_id: 'usr-1', first_name: 'Alice', last_name: 'Smith' }], error: null },
      ],
      branches: [
        { data: [{ id: 'br-1', name: 'Main Branch' }], error: null },
      ],
      finance_adjustments: [
        { data: [], error: null },
      ],
    })

    const rows = await getLiveInstructorFinance(['br-1'], '2026-06-01', '2026-06-30')

    expect(rows).toHaveLength(1)
    expect(rows[0].instructor_id).toBe('instr-1')
    expect(rows[0].sessions_count).toBe(1)
    expect(rows[0].session_earnings).toBe(200)
    expect(rows[0].display_name).toBe('Alice Smith')
  })
})

// ── 4. Historical analytics after allocation deletion ─────────────────────────

describe('getLiveInstructorFinance — historical sessions preserved after allocation deletion', () => {
  it('counts all historical session_instructors records regardless of group_instructors state', async () => {
    // Two sessions, both attended by instr-1 (per session_instructors).
    // group_instructors has NO rows (allocation deleted).
    // Both sessions must still be counted in payroll.
    mockDb({
      schedules: [
        {
          data: [
            { id: 'sched-a', branch_id: 'br-1', group_course_id: 'gc-1' },
            { id: 'sched-b', branch_id: 'br-1', group_course_id: 'gc-1' },
          ],
          error: null,
        },
      ],
      group_courses: [
        { data: [{ id: 'gc-1', group_id: 'grp-1', instructor_id: null }], error: null },
      ],
      group_instructors: [
        { data: [], error: null },
      ],
      payroll_session_overrides: [
        { data: [], error: null },
      ],
      session_instructors: [
        {
          data: [
            { session_id: 'sched-a', instructor_id: 'instr-1' },
            { session_id: 'sched-b', instructor_id: 'instr-1' },
          ],
          error: null,
        },
      ],
      instructors: [
        {
          data: [{
            id: 'instr-1', user_id: 'usr-1',
            salary_per_session: 150, currency: 'EGP',
            instapay_number: null, payment_notes: null, payment_method: null,
          }],
          error: null,
        },
      ],
      profiles: [
        { data: [{ user_id: 'usr-1', first_name: 'Bob', last_name: 'Jones' }], error: null },
      ],
      branches: [
        { data: [{ id: 'br-1', name: 'Main Branch' }], error: null },
      ],
      finance_adjustments: [
        { data: [], error: null },
      ],
    })

    const rows = await getLiveInstructorFinance(['br-1'], '2026-06-01', '2026-06-30')

    expect(rows).toHaveLength(1)
    expect(rows[0].instructor_id).toBe('instr-1')
    expect(rows[0].sessions_count).toBe(2)
    expect(rows[0].session_earnings).toBe(300) // 2 × 150
  })
})
