import { describe, it, expect, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const { TL_USER } = vi.hoisted(() => ({
  TL_USER: { id: 'user-tl', globalRole: 'team_leader', branchIds: ['br-1'], permissions: [] },
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission:  vi.fn().mockResolvedValue(TL_USER),
  isBranchAccessible: vi.fn().mockReturnValue(true),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import {
  recommendDecision, allDecided, buildGraduationRpcPayload, decisionCountsSummary,
} from '@/modules/groups/actions/graduation-helpers'
import type { CommitGraduationInput } from '@/modules/groups/actions/graduation-helpers'
import { validateCohortGraduation, commitCohortGraduation } from '@/modules/groups/actions/graduation'

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// ── recommendDecision (display-only, never auto-applied) ─────────────────────

describe('recommendDecision', () => {
  it('recommends continue when the student already has a certificate', () => {
    expect(recommendDecision({ has_certificate: true, outstanding_balance: 500, attendance_pct: 10 })).toBe('continue')
  })

  it('recommends repeat when no certificate and low attendance', () => {
    expect(recommendDecision({ has_certificate: false, outstanding_balance: 0, attendance_pct: 40 })).toBe('repeat')
  })

  it('recommends continue when no certificate but attendance is healthy', () => {
    expect(recommendDecision({ has_certificate: false, outstanding_balance: 0, attendance_pct: 85 })).toBe('continue')
  })

  it('outstanding balance never changes the recommendation (finance is a warning, never a blocker)', () => {
    const withBalance    = recommendDecision({ has_certificate: true, outstanding_balance: 10000, attendance_pct: 90 })
    const withoutBalance = recommendDecision({ has_certificate: true, outstanding_balance: 0, attendance_pct: 90 })
    expect(withBalance).toBe(withoutBalance)
  })
})

// ── allDecided — the Step 3 exit gate ─────────────────────────────────────────

describe('allDecided', () => {
  it('is true for an empty active roster', () => {
    expect(allDecided({}, [])).toBe(true)
  })

  it('is false when any active student is undecided or missing', () => {
    expect(allDecided({ 's1': 'continue' }, ['s1', 's2'])).toBe(false)
    expect(allDecided({ 's1': 'continue', 's2': 'undecided' }, ['s1', 's2'])).toBe(false)
  })

  it('is true only once every active student has a real decision', () => {
    expect(allDecided({ s1: 'continue', s2: 'drop' }, ['s1', 's2'])).toBe(true)
  })
})

// ── buildGraduationRpcPayload — the TS↔SQL contract boundary ─────────────────

describe('buildGraduationRpcPayload', () => {
  const baseInput: CommitGraduationInput = {
    old_group_id: 'old-1',
    request_id:   'req-1',
    draft_id:     'draft-1',
    new_group: {
      branch_id: 'br-1', series_id: 'series-1', semester_id: 'sem-1', name: 'Robotics B',
      code: null, type: 'class', capacity: 12, waitlist_capacity: 2, day_of_week: 'saturday',
      time: '10:00', start_date: '2026-09-01', room: 'Room 3', course_id: 'course-1',
      instructor_id: 'instr-1', asst_instructor_id: 'instr-2', robocode_share_percent: 100,
      planned_sessions: 24, open_ended: false,
    },
    decisions: [
      { student_id: 'stu-1', old_enrollment_id: 'enr-1', old_group_student_id: 'gs-1', decision: 'continue' },
      { student_id: 'stu-2', old_enrollment_id: null,      old_group_student_id: 'gs-2', decision: 'transfer', transfer_group_id: 'other-group' },
    ],
  }

  it('never sends instructor_id/room/planned_sessions/open_ended to the RPC (round 3 adjustment #4)', () => {
    const payload = buildGraduationRpcPayload(baseInput)
    expect(payload.new_group).not.toHaveProperty('instructor_id')
    expect(payload.new_group).not.toHaveProperty('asst_instructor_id')
    expect(payload.new_group).not.toHaveProperty('room')
    expect(payload.new_group).not.toHaveProperty('planned_sessions')
    expect(payload.new_group).not.toHaveProperty('open_ended')
  })

  it('still stamps course_id (advisory metadata on the new enrollment, not a group_courses write)', () => {
    const payload = buildGraduationRpcPayload(baseInput)
    expect(payload.new_group.course_id).toBe('course-1')
  })

  it('carries every bare cohort field the RPC needs', () => {
    const payload = buildGraduationRpcPayload(baseInput)
    expect(payload.old_group_id).toBe('old-1')
    expect(payload.new_group).toMatchObject({
      branch_id: 'br-1', series_id: 'series-1', semester_id: 'sem-1', name: 'Robotics B',
      day_of_week: 'saturday', time: '10:00', start_date: '2026-09-01', robocode_share_percent: 100,
    })
  })

  it('only includes transfer_group_id for transfer decisions', () => {
    const payload = buildGraduationRpcPayload(baseInput)
    expect(payload.decisions[0]).not.toHaveProperty('transfer_group_id')
    expect(payload.decisions[1].transfer_group_id).toBe('other-group')
  })

  it('preserves a null old_enrollment_id rather than coercing to an empty string', () => {
    const payload = buildGraduationRpcPayload(baseInput)
    expect(payload.decisions[1].old_enrollment_id).toBeNull()
  })
})

// ── decisionCountsSummary ─────────────────────────────────────────────────────

describe('decisionCountsSummary', () => {
  it('formats non-zero counts only, in canonical order', () => {
    expect(decisionCountsSummary({ continue: 3, drop: 1 })).toBe('3 continuing · 1 dropped')
  })

  it('reports "No students" for an all-zero summary', () => {
    expect(decisionCountsSummary({})).toBe('No students')
  })
})

// ── validateCohortGraduation ───────────────────────────────────────────────────

describe('validateCohortGraduation', () => {
  it('blocks when the cohort is not found', async () => {
    mockDb({ groups: [{ data: null, error: null }] })
    const res = await validateCohortGraduation('missing')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.blockers).toEqual(['Cohort not found.'])
  })

  it('blocks when already graduated', async () => {
    mockDb({ groups: [{ data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: '2026-07-01T00:00:00Z' }, error: null }] })
    const res = await validateCohortGraduation('g1')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.blockers).toEqual(['This cohort has already been graduated.'])
  })

  it('blocks when the cohort is not yet Completed', async () => {
    mockDb({ groups: [{ data: { id: 'g1', branch_id: 'br-1', status: 'active', graduated_at: null }, error: null }] })
    const res = await validateCohortGraduation('g1')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.blockers).toEqual(['Cohort must be Completed before it can be graduated.'])
  })

  it('passes through health-check warnings for a clean, Completed, ungraduated cohort', async () => {
    mockDb({
      groups:                     [{ data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null }],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students:             [{ data: [], error: null }],
    })
    const res = await validateCohortGraduation('g1')
    expect(res.success).toBe(true)
    if (res.success) { expect(res.data.blockers).toEqual([]); expect(res.data.warnings).toEqual([]) }
  })
})

// ── commitCohortGraduation ────────────────────────────────────────────────────

function baseCommitInput(): CommitGraduationInput {
  return {
    old_group_id: 'g1',
    request_id:   'req-abc',
    new_group: {
      branch_id: 'br-1', series_id: null, semester_id: null, name: 'Robotics B', code: null,
      type: 'class', capacity: 12, waitlist_capacity: 0, day_of_week: 'saturday', time: '10:00',
      start_date: '2026-09-01', room: null, course_id: null, instructor_id: null, asst_instructor_id: null,
      robocode_share_percent: 100, planned_sessions: null, open_ended: false,
    },
    decisions: [
      { student_id: 'stu-1', old_enrollment_id: 'enr-1', old_group_student_id: 'gs-1', decision: 'continue' },
    ],
  }
}

describe('commitCohortGraduation', () => {
  it('calls requirePermission with the new cohort branch', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null }, // loadOldCohort
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null }, // validateCohortGraduation's own lookup
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      // Two queue entries: one consumed inside validateCohortGraduation's
      // health-check (computeCohortHealthWarnings always queries
      // group_students, independent of certificate-check gating), one
      // consumed by commitCohortGraduation's own active-roster fetch.
      group_students: [
        { data: [{ student_id: 'stu-1' }], error: null },
        { data: [{ student_id: 'stu-1' }], error: null },
      ],
    })
    db.rpc.mockResolvedValueOnce({ data: { new_group_id: 'new-g1', decision_counts: { continue: 1 }, replayed: false }, error: null })
    await commitCohortGraduation(baseCommitInput())
    expect(requirePermission).toHaveBeenCalledWith('graduate_cohort', { branchId: 'br-1' })
  })

  it('rejects when an active student is left undecided, without ever calling the RPC', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      // Two active students, but the input only decides one of them.
      group_students: [
        { data: [{ student_id: 'stu-1' }, { student_id: 'stu-2' }], error: null }, // validateCohortGraduation's health-check
        { data: [{ student_id: 'stu-1' }, { student_id: 'stu-2' }], error: null }, // commitCohortGraduation's active-roster fetch
      ],
    })

    const res = await commitCohortGraduation(baseCommitInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.message).toContain('explicit decision')
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('rejects with VALIDATION and never calls the RPC when the cohort is not Completed', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'active', graduated_at: null }, error: null },
        { data: { id: 'g1', branch_id: 'br-1', status: 'active', graduated_at: null }, error: null },
      ],
    })
    const res = await commitCohortGraduation(baseCommitInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('VALIDATION')
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('calls the RPC with the exact payload shape and idempotency key on the happy path', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students: [
        { data: [{ student_id: 'stu-1' }], error: null },
        { data: [{ student_id: 'stu-1' }], error: null },
      ],
    })
    db.rpc.mockResolvedValueOnce({ data: { new_group_id: 'new-g1', decision_counts: { continue: 1 }, replayed: false }, error: null })

    const res = await commitCohortGraduation(baseCommitInput())

    expect(db.rpc).toHaveBeenCalledWith('commit_cohort_graduation', expect.objectContaining({
      p_performed_by: TL_USER.id,
      p_request_id:   'req-abc',
      p_draft_id:     null,
      p_payload: expect.objectContaining({ old_group_id: 'g1' }),
    }))
    expect(res).toEqual({ success: true, data: { new_group_id: 'new-g1', decision_counts: { continue: 1 }, replayed: false } })
  })

  it('surfaces the RPC error message verbatim (e.g. "already graduated")', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students: [
        { data: [{ student_id: 'stu-1' }], error: null },
        { data: [{ student_id: 'stu-1' }], error: null },
      ],
    })
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Cohort has already been graduated at 2026-07-14T00:00:00Z.' } })

    const res = await commitCohortGraduation(baseCommitInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.message).toContain('already been graduated')
  })

  it('propagates replayed:true from the RPC (a safe retry, not a fresh graduation)', async () => {
    const db = mockDb({
      groups: [
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
        { data: { id: 'g1', branch_id: 'br-1', status: 'completed', graduated_at: null }, error: null },
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students: [
        { data: [{ student_id: 'stu-1' }], error: null },
        { data: [{ student_id: 'stu-1' }], error: null },
      ],
    })
    db.rpc.mockResolvedValueOnce({ data: { new_group_id: 'new-g1', decision_counts: { continue: 1 }, replayed: true }, error: null })

    const res = await commitCohortGraduation(baseCommitInput())
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.replayed).toBe(true)
  })

  it('rejects a cross-branch caller (isBranchAccessible false)', async () => {
    const guards = await import('@/modules/rbac/guards')
    ;(guards.isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)
    const db = mockDb({
      groups: [{ data: { id: 'g1', branch_id: 'br-2', status: 'completed', graduated_at: null }, error: null }],
    })
    const res = await commitCohortGraduation(baseCommitInput())
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
    expect(db.rpc).not.toHaveBeenCalled()
  })
})
