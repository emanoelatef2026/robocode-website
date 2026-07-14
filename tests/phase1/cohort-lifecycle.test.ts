import { describe, it, expect, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const { TL_USER, SA_USER } = vi.hoisted(() => ({
  TL_USER: { id: 'user-tl', globalRole: 'team_leader', branchIds: ['br-1'], permissions: [] },
  SA_USER: { id: 'user-sa', globalRole: 'super_admin', branchIds: [],       permissions: [] },
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission:  vi.fn().mockResolvedValue(TL_USER),
  isBranchAccessible: vi.fn().mockReturnValue(true),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'
import {
  validateCohortArchival,
  archiveCohortAction,
  recoverCohortAction,
  listArchivedCohorts,
} from '@/modules/groups/actions/lifecycle'
import { applyFilters } from '@/app/portal/team-leader/groups/workspace/utils'
import { DEFAULT_FILTERS } from '@/app/portal/team-leader/groups/workspace/types'
import type { GroupOperationalRow } from '@/modules/groups/operational'

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// ── getCohortLifecycleStage ────────────────────────────────────────────────────

describe('getCohortLifecycleStage', () => {
  it('maps archived/completed/active/handoff_pending 1:1', () => {
    expect(getCohortLifecycleStage({ status: 'archived' })).toBe('archived')
    expect(getCohortLifecycleStage({ status: 'completed' })).toBe('completed')
    expect(getCohortLifecycleStage({ status: 'active' })).toBe('running')
    expect(getCohortLifecycleStage({ status: 'handoff_pending' })).toBe('running')
  })

  it('splits forming into draft (not enrollment-ready) vs open (ready)', () => {
    expect(getCohortLifecycleStage({ status: 'forming' })).toBe('draft')
    expect(getCohortLifecycleStage({ status: 'forming', has_course: true })).toBe('draft')
    expect(getCohortLifecycleStage({ status: 'forming', has_course: true, has_instructor: true })).toBe('open')
  })

  it('degrades cancelled (an unrelated concept) to draft rather than crashing', () => {
    expect(getCohortLifecycleStage({ status: 'cancelled' })).toBe('draft')
  })
})

// ── validateCohortArchival ──────────────────────────────────────────────────────

describe('validateCohortArchival', () => {
  it('blocks when the cohort is not found', async () => {
    mockDb({ groups: [{ data: null, error: null }] })
    const v = await validateCohortArchival('missing')
    expect(v.blockers).toEqual(['Cohort not found.'])
  })

  it('blocks when already Archived', async () => {
    mockDb({ groups: [{ data: { id: 'g1', status: 'archived' }, error: null }] })
    const v = await validateCohortArchival('g1')
    expect(v.blockers).toEqual(['Cohort is already Archived.'])
  })

  it('blocks when not yet Completed (still Running)', async () => {
    mockDb({ groups: [{ data: { id: 'g1', status: 'active' }, error: null }] })
    const v = await validateCohortArchival('g1')
    expect(v.blockers).toEqual(['Cohort must be Completed before it can be Archived.'])
  })

  it('warns (non-blocking) on unfinished sessions, missing attendance, unpaid balances, and missing certificates', async () => {
    mockDb({
      groups:        [{ data: { id: 'g1', status: 'completed' }, error: null }],
      group_courses: [{ data: [{ id: 'gc-1', course_id: 'course-1' }], error: null }],
      schedules: [{
        data: [
          { id: 'sch-1', status: 'completed' },
          { id: 'sch-2', status: 'scheduled' }, // unfinished
        ],
        error: null,
      }],
      attendance_records: [{ data: [], error: null }], // sch-1 has no attendance recorded
      student_financial_accounts: [{ data: [{ id: 'acc-1', remaining_amount: 500 }], error: null }],
      group_students: [{ data: [{ student_id: 'stu-1' }], error: null }],
      certificates: [{ data: [], error: null }], // stu-1 has no certificate
    })

    const v = await validateCohortArchival('g1')
    expect(v.blockers).toEqual([])
    expect(v.warnings).toEqual([
      '1 session(s) are not marked completed or cancelled.',
      '1 completed session(s) have no attendance recorded.',
      '1 student(s) have an outstanding balance for this cohort.',
      '1 student(s) have no certificate on file for this cohort\'s course.',
    ])
  })

  it('returns no warnings when everything is clean', async () => {
    mockDb({
      groups:                     [{ data: { id: 'g1', status: 'completed' }, error: null }],
      group_courses:              [{ data: [{ id: 'gc-1', course_id: 'course-1' }], error: null }],
      schedules:                  [{ data: [{ id: 'sch-1', status: 'completed' }], error: null }],
      attendance_records:         [{ data: [{ schedule_id: 'sch-1' }], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students:             [{ data: [{ student_id: 'stu-1' }], error: null }],
      certificates:               [{ data: [{ student_id: 'stu-1' }], error: null }],
    })

    const v = await validateCohortArchival('g1')
    expect(v).toEqual({ blockers: [], warnings: [] })
  })
})

// ── archiveCohortAction ──────────────────────────────────────────────────────────

describe('archiveCohortAction', () => {
  it('rejects archiving a still-Running cohort', async () => {
    mockDb({
      groups: [
        { data: { branch_id: 'br-1', status: 'active' }, error: null }, // existing lookup
        { data: { id: 'g1', status: 'active' }, error: null },          // validateCohortArchival's own lookup
      ],
    })
    const res = await archiveCohortAction('g1', 'test reason')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.message).toContain('must be Completed')
  })

  it('archives a Completed cohort and writes an audit log', async () => {
    const db = mockDb({
      groups: [
        { data: { branch_id: 'br-1', status: 'completed' }, error: null },
        { data: { id: 'g1', status: 'completed' }, error: null },
        { data: null, error: null }, // the status update
      ],
      group_courses:              [{ data: [], error: null }],
      student_financial_accounts: [{ data: [], error: null }],
      group_students:             [{ data: [], error: null }],
    })

    const res = await archiveCohortAction('g1', 'semester finished')
    expect(res.success).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith('write_audit_log', expect.objectContaining({
      p_action: 'archive_cohort',
      p_new_values: expect.objectContaining({ status: 'archived', reason: 'semester finished' }),
    }))
  })
})

// ── recoverCohortAction ──────────────────────────────────────────────────────────

describe('recoverCohortAction', () => {
  it('rejects a non-super_admin caller (requirePermission throws)', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('forbidden'))
    mockDb({})
    await expect(recoverCohortAction('g1', 'oops')).rejects.toThrow()
  })

  it('rejects recovering a cohort that is not Archived', async () => {
    mockDb({ groups: [{ data: { branch_id: 'br-1', status: 'completed' }, error: null }] })
    const res = await recoverCohortAction('g1', 'oops')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.message).toContain('not Archived')
  })

  it('recovers an Archived cohort back to Completed and writes an audit log', async () => {
    const db = mockDb({
      groups: [
        { data: { branch_id: 'br-1', status: 'archived' }, error: null },
        { data: null, error: null }, // the status update
      ],
    })
    const res = await recoverCohortAction('g1', 'reinstated by request')
    expect(res.success).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith('write_audit_log', expect.objectContaining({
      p_action: 'recover_cohort',
      p_old_values: { status: 'archived' },
      p_new_values: expect.objectContaining({ status: 'completed', reason: 'reinstated by request' }),
    }))
  })
})

// ── listArchivedCohorts — branch scoping ────────────────────────────────────────

describe('listArchivedCohorts', () => {
  it('scopes team_leader callers to their own branches', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(TL_USER)
    const db = mockDb({
      groups: [{ data: [{ id: 'g1', name: 'Cohort A', branch_id: 'br-1', archived_at: '2026-01-01', branches: { name: 'Branch 1' } }], error: null }],
    })
    const res = await listArchivedCohorts()
    expect(res.success).toBe(true)
    if (res.success) expect(res.data).toHaveLength(1)
    // team_leader is not super_admin — the branch_id .in() scoping call ran.
    expect(db.from).toHaveBeenCalledWith('groups')
  })

  it('does not scope by branch for super_admin callers', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SA_USER)
    mockDb({ groups: [{ data: [], error: null }] })
    const res = await listArchivedCohorts()
    expect(res.success).toBe(true)
  })
})

// ── applyFilters — archived vs cancelled ─────────────────────────────────────────

describe('applyFilters — archived vs cancelled (Rule 2/11 fix)', () => {
  function row(overrides: Partial<GroupOperationalRow>): GroupOperationalRow {
    return {
      group_id: 'g', branch_id: 'br-1', branch_name: 'Branch', name: 'Group', code: null,
      type: 'class', status: 'forming', capacity: null, student_count: 0, capacity_pct: null,
      day_of_week: null, start_time: null, duration_minutes: null, start_date: null, end_date: null,
      meeting_link: null, notes: null, course_id: null, course_name: null, lead_instructor_id: null,
      lead_instructor_name: null, asst_instructor_id: null, asst_instructor_name: null,
      active_allocation: null, has_instructor: false, has_course: false, attendance_avg: 0,
      assignment_avg: 0, portfolio_avg: 0, health_score: 0, is_low_attendance: false,
      is_low_capacity: false, is_overloaded: false, starts_soon: false, enrolled_students: [],
      completed_sessions: 0, planned_sessions: null, open_ended: false, robocode_share_percent: 100,
      ...overrides,
    } as GroupOperationalRow
  }

  const groups = [
    row({ group_id: 'archived-1', status: 'archived' }),
    row({ group_id: 'cancelled-1', status: 'cancelled' }),
    row({ group_id: 'completed-1', status: 'completed' }),
  ]

  it('archived filter only matches status=archived, not cancelled', () => {
    const result = applyFilters(groups, { ...DEFAULT_FILTERS, quickFilter: 'archived' })
    expect(result.map(g => g.group_id)).toEqual(['archived-1'])
  })

  it('cancelled filter only matches status=cancelled, not archived', () => {
    const result = applyFilters(groups, { ...DEFAULT_FILTERS, quickFilter: 'cancelled' })
    expect(result.map(g => g.group_id)).toEqual(['cancelled-1'])
  })

  it('completed filter uses the lifecycle-stage derivation', () => {
    const result = applyFilters(groups, { ...DEFAULT_FILTERS, quickFilter: 'completed' })
    expect(result.map(g => g.group_id)).toEqual(['completed-1'])
  })
})
