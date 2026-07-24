import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/timeline', () => ({ logTimelineEvents: vi.fn().mockResolvedValue(undefined), logTimelineEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/notifications/queries', () => ({ getParentUserIdsForStudent: vi.fn().mockResolvedValue([]) }))
vi.mock('@/modules/notifications/actions', () => ({ seedAttendanceRecordedNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn().mockResolvedValue({ id: 'user-tl-1', globalRole: 'team_leader', branchIds: ['branch-1'] }) }))
vi.mock('@/modules/academic/enrollment-integrity', () => ({ findActiveEnrollmentForCourse: vi.fn().mockResolvedValue(null) }))

import { createServiceClient } from '@/lib/supabase/service'
import { findActiveEnrollmentForCourse } from '@/modules/academic/enrollment-integrity'
import {
  previewHistoricalReconciliation,
  applyHistoricalReconciliation,
} from '@/modules/enrollments/historical-reconciliation'
import {
  computeReconciliationImpact,
  type EnrollmentSummary,
} from '@/modules/enrollments/historical-reconciliation-shared'

// ── Fake Supabase client ──────────────────────────────────────────────────────
// Each `.from(table)` call resolves to a single canned response for that
// table (sufficient here — every code path under test queries each table at
// most once per preview/apply call). `.rpc(name)` resolves per-name.

function makeDb(responses: Record<string, { data: any; error: any }>) {
  function chain(resp: { data: any; error: any }) {
    const c: any = {
      select: () => c,
      eq: () => c,
      in: () => c,
      gt: () => c,
      neq: () => c,
      order: () => c,
      maybeSingle: () => Promise.resolve(resp),
      single: () => Promise.resolve(resp),
      then: (resolve: any) => resolve(resp),
    }
    return c
  }
  const from = vi.fn((table: string) => chain(responses[table] ?? { data: null, error: null }))
  const rpc  = vi.fn((name: string) => Promise.resolve(responses[`rpc:${name}`] ?? { data: null, error: null }))
  return { from, rpc }
}

function enrollment(overrides: Partial<EnrollmentSummary> = {}): EnrollmentSummary {
  return {
    id: 'enr-1',
    enrolled_sessions: 10,
    consumed_sessions: 2,
    remaining_sessions: 8,
    allow_overdraft_sessions: false,
    net_amount: 1000,
    ...overrides,
  }
}

const S = (id: string, n: number, date: string) => ({ id, session_number: n, topic: `Lesson ${n}`, scheduled_at: date })

beforeEach(() => {
  vi.clearAllMocks()
  ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null)
})

// ── computeReconciliationImpact ───────────────────────────────────────────────

describe('computeReconciliationImpact', () => {
  it('flags no-contract with a shortfall equal to the full selection', () => {
    const impact = computeReconciliationImpact(5, 5, null)
    expect(impact.contract_remaining).toBe(0)
    expect(impact.sessions_to_consume).toBe(0)
    expect(impact.shortfall).toBe(5)
    expect(impact.requires_additional_payment).toBe(true)
    expect(impact.warnings[0]).toMatch(/no active contract/i)
  })

  it('reports no shortfall and no additional payment when selection fits inside remaining sessions', () => {
    const impact = computeReconciliationImpact(6, 6, enrollment({ remaining_sessions: 8 }))
    expect(impact.sessions_to_consume).toBe(6)
    expect(impact.remaining_after).toBe(2)
    expect(impact.shortfall).toBe(0)
    expect(impact.requires_additional_payment).toBe(false)
  })

  it('caps consumption and reports shortfall when selection exceeds remaining sessions', () => {
    const impact = computeReconciliationImpact(8, 8, enrollment({ enrolled_sessions: 10, consumed_sessions: 5, remaining_sessions: 5 }))
    expect(impact.sessions_to_consume).toBe(5)
    expect(impact.shortfall).toBe(3)
    expect(impact.remaining_after).toBe(0)
    expect(impact.requires_additional_payment).toBe(true)
  })

  it('never reports a shortfall when overdraft is allowed', () => {
    const impact = computeReconciliationImpact(20, 20, enrollment({ remaining_sessions: 2, allow_overdraft_sessions: true }))
    expect(impact.shortfall).toBe(0)
    expect(impact.sessions_to_consume).toBe(20)
  })

  it('treats an open-ended (enrolled_sessions = 0) contract as unlimited with no financial impact', () => {
    const impact = computeReconciliationImpact(4, 4, enrollment({ enrolled_sessions: 0, consumed_sessions: 0, remaining_sessions: 0 }))
    expect(impact.shortfall).toBe(0)
    expect(impact.financial_impact).toBeNull()
    expect(impact.warnings.some(w => /open-ended/i.test(w))).toBe(true)
  })

  it('computes financial impact as (net_amount / enrolled_sessions) * sessions consumed', () => {
    const impact = computeReconciliationImpact(4, 4, enrollment({ enrolled_sessions: 10, net_amount: 1000, remaining_sessions: 8 }))
    expect(impact.amount_per_session).toBe(100)
    expect(impact.financial_impact).toBe(400)
  })
})

// ── previewHistoricalReconciliation ───────────────────────────────────────────

describe('previewHistoricalReconciliation', () => {
  it('returns no sessions when the group has no completed schedules (join before first session)', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules:     { data: [], error: null },
    }))
    const res = await previewHistoricalReconciliation({ studentId: 's1', groupId: 'g1' })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.sessions).toHaveLength(0)
  })

  it('excludes sessions the student already has attendance for (join after 1 of 5 sessions)', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: {
        data: [S('sch-1', 1, '2026-01-01'), S('sch-2', 2, '2026-01-08'), S('sch-3', 3, '2026-01-15'),
                S('sch-4', 4, '2026-01-22'), S('sch-5', 5, '2026-01-29')],
        error: null,
      },
      attendance_records: { data: [{ schedule_id: 'sch-1' }], error: null },
      student_enrollments: { data: enrollment({ remaining_sessions: 8 }), error: null },
    }))
    ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'enr-1' })

    const res = await previewHistoricalReconciliation({ studentId: 's1', groupId: 'g1' })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.sessions.map(s => s.schedule_id)).toEqual(['sch-2', 'sch-3', 'sch-4', 'sch-5'])
    expect(res.data.impactAll.completed_count).toBe(4)
  })

  it('reports 20 missing sessions and no contract when the student joins after 20 sessions with no active enrollment', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => S(`sch-${i + 1}`, i + 1, `2026-01-${String(i + 1).padStart(2, '0')}`))
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: { data: twenty, error: null },
      attendance_records: { data: [], error: null },
    }))
    ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await previewHistoricalReconciliation({ studentId: 's1', groupId: 'g1' })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.sessions).toHaveLength(20)
    expect(res.data.enrollment).toBeNull()
    expect(res.data.impactAll.warnings[0]).toMatch(/no active contract/i)
  })

  it('excludes a session with any prior attendance regardless of status (makeup/transfer/re-enrollment dedup)', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: { data: [S('sch-1', 1, '2026-01-01'), S('sch-2', 2, '2026-01-08')], error: null },
      // sch-1 has a 'makeup' record from a PRIOR enrollment — must still be excluded.
      attendance_records: { data: [{ schedule_id: 'sch-1' }], error: null },
    }))
    const res = await previewHistoricalReconciliation({ studentId: 's1', groupId: 'g1' })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.sessions.map(s => s.schedule_id)).toEqual(['sch-2'])
  })
})

// ── applyHistoricalReconciliation ─────────────────────────────────────────────

describe('applyHistoricalReconciliation', () => {
  const previewTables = {
    group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
    schedules: {
      data: [S('sch-1', 1, '2026-01-01'), S('sch-2', 2, '2026-01-08'), S('sch-3', 3, '2026-01-15')],
      error: null,
    },
    attendance_records: { data: [], error: null },
  }

  it('NEXT_ONLY never creates or consumes anything', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({}))
    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'NEXT_ONLY' }, performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toEqual({ created: 0, consumed: 0, unfunded: 0, cancelled: false })
  })

  it('ALL applies every missing session and funds all of them when the contract covers it', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ remaining_sessions: 8 }), error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [
          { attendance_record_id: 'ar-1', schedule_id: 'sch-1', funded: true },
          { attendance_record_id: 'ar-2', schedule_id: 'sch-2', funded: true },
          { attendance_record_id: 'ar-3', schedule_id: 'sch-3', funded: true },
        ],
        error: null,
      },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'ALL' }, performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toEqual({ created: 3, consumed: 3, unfunded: 0, cancelled: false })

    const rpcCall = db.rpc.mock.calls.find((c: any) => c[0] === 'apply_historical_reconciliation_records') as any[] | undefined
    expect(rpcCall![1]).toMatchObject({
      p_schedule_ids: ['sch-1', 'sch-2', 'sch-3'],
      p_funded_count: 3,
      p_student_id: 's1',
      p_enrollment_id: 'enr-1',
    })
  })

  it('MANUAL only applies the selected, still-missing sessions (ignores ids not in the missing set)', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ remaining_sessions: 8 }), error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [{ attendance_record_id: 'ar-2', schedule_id: 'sch-2', funded: true }],
        error: null,
      },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'MANUAL', scheduleIds: ['sch-2', 'sch-does-not-exist'] },
      performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(1)

    const rpcCall = db.rpc.mock.calls.find((c: any) => c[0] === 'apply_historical_reconciliation_records') as any[] | undefined
    expect(rpcCall![1].p_schedule_ids).toEqual(['sch-2'])
  })

  it('CONSUME_WHAT_FITS caps the applied set at the remaining contract balance', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ enrolled_sessions: 10, consumed_sessions: 8, remaining_sessions: 2 }), error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [
          { attendance_record_id: 'ar-1', schedule_id: 'sch-1', funded: true },
          { attendance_record_id: 'ar-2', schedule_id: 'sch-2', funded: true },
        ],
        error: null,
      },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'ALL' }, shortfallResolution: 'CONSUME_WHAT_FITS', performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.created).toBe(2)

    const rpcCall = db.rpc.mock.calls.find((c: any) => c[0] === 'apply_historical_reconciliation_records') as any[] | undefined
    expect(rpcCall![1].p_schedule_ids).toEqual(['sch-1', 'sch-2'])
    expect(rpcCall![1].p_funded_count).toBe(2)
  })

  it('UNPAID_PENDING creates attendance for the full selection but funds only what the contract covers', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ enrolled_sessions: 10, consumed_sessions: 8, remaining_sessions: 2 }), error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [
          { attendance_record_id: 'ar-1', schedule_id: 'sch-1', funded: true },
          { attendance_record_id: 'ar-2', schedule_id: 'sch-2', funded: true },
          { attendance_record_id: 'ar-3', schedule_id: 'sch-3', funded: false },
        ],
        error: null,
      },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'ALL' }, shortfallResolution: 'UNPAID_PENDING', performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toEqual({ created: 3, consumed: 2, unfunded: 1, cancelled: false })

    const rpcCall = db.rpc.mock.calls.find((c: any) => c[0] === 'apply_historical_reconciliation_records') as any[] | undefined
    expect(rpcCall![1].p_schedule_ids).toEqual(['sch-1', 'sch-2', 'sch-3'])
    expect(rpcCall![1].p_funded_count).toBe(2)
  })

  it('CANCEL performs no writes at all — the RPC is never called', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ enrolled_sessions: 10, consumed_sessions: 9, remaining_sessions: 1 }), error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'ALL' }, shortfallResolution: 'CANCEL', performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toEqual({ created: 0, consumed: 0, unfunded: 0, cancelled: true })
    expect(db.rpc).not.toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.anything())
  })

  it('defaults an unresolved shortfall to CANCEL rather than silently over-consuming', async () => {
    const db = makeDb({
      ...previewTables,
      student_enrollments: { data: enrollment({ enrolled_sessions: 10, consumed_sessions: 9, remaining_sessions: 1 }), error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      choice: { mode: 'ALL' }, performedBy: 'user-1', // no shortfallResolution supplied
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.cancelled).toBe(true)
    expect(db.rpc).not.toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.anything())
  })

  it('fails clearly when no active contract exists and the choice is not NEXT_ONLY (no contract case)', async () => {
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb({ ...previewTables }))
    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', // no enrollmentId, none resolvable
      choice: { mode: 'ALL' }, performedBy: 'user-1',
    })
    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.message).toMatch(/no active contract/i)
  })

  it('resolves an enrollment via findActiveEnrollmentForCourse when none is passed explicitly (bulk-add path)', async () => {
    const db = makeDb({
      ...previewTables,
      // A real query filters `.eq('id', enrollmentId)`, so the row returned
      // always carries the id it was resolved by — mirror that here.
      student_enrollments: { data: enrollment({ id: 'enr-resolved', remaining_sessions: 8 }), error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [{ attendance_record_id: 'ar-1', schedule_id: 'sch-1', funded: true }],
        error: null,
      },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
    ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'enr-resolved' })

    const res = await applyHistoricalReconciliation({
      studentId: 's1', groupId: 'g1', courseId: 'course-1',
      choice: { mode: 'MANUAL', scheduleIds: ['sch-1'] }, performedBy: 'user-1',
    })
    expect(res.success).toBe(true)
    const rpcCall = db.rpc.mock.calls.find((c: any) => c[0] === 'apply_historical_reconciliation_records') as any[] | undefined
    expect(rpcCall![1].p_enrollment_id).toBe('enr-resolved')
  })
})
