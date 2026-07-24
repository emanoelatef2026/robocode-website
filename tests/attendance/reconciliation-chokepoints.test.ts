import { describe, it, expect, vi, beforeEach } from 'vitest'

// reconcileGroupJoin is the one chokepoint every enrollment entry point
// (createEnrollment, transferEnrollment, enrollStudent, bulkEnrollStudents,
// applyStudentChanges, assignLeadToGroup, assignStudentToGroup,
// applyGroupAssignments, createStudent) calls after its own group_students /
// student_enrollments write. These tests verify the chokepoint's own
// contract directly — "does every caller get non-fatal, correctly-branched
// behavior" — rather than re-mocking each of those 9 action files' large,
// unrelated dependency graphs (auth user creation, parent identity
// resolution, progress recalculation, ...) just to reach one shared call.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/timeline', () => ({ logTimelineEvents: vi.fn().mockResolvedValue(undefined), logTimelineEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/notifications/queries', () => ({ getParentUserIdsForStudent: vi.fn().mockResolvedValue([]) }))
vi.mock('@/modules/notifications/actions', () => ({ seedAttendanceRecordedNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn().mockResolvedValue({ id: 'user-1' }) }))
vi.mock('@/modules/academic/enrollment-integrity', () => ({ findActiveEnrollmentForCourse: vi.fn().mockResolvedValue(null) }))

import { logTimelineEvents } from '@/lib/timeline'
import { findActiveEnrollmentForCourse } from '@/modules/academic/enrollment-integrity'
import { reconcileGroupJoin } from '@/modules/enrollments/historical-reconciliation'

function makeDb(responses: Record<string, { data: any; error: any }>) {
  function chain(resp: { data: any; error: any }) {
    const c: any = {
      select: () => c, eq: () => c, in: () => c, gt: () => c, neq: () => c, order: () => c,
      maybeSingle: () => Promise.resolve(resp),
      single: () => Promise.resolve(resp),
      then: (resolve: any) => resolve(resp),
    }
    return c
  }
  const from = vi.fn((table: string) => chain(responses[table] ?? { data: null, error: null }))
  const rpc  = vi.fn((name: string) => Promise.resolve(responses[`rpc:${name}`] ?? { data: null, error: null }))
  return { from, rpc } as any
}

const S = (id: string, n: number, date: string) => ({ id, session_number: n, topic: `Lesson ${n}`, scheduled_at: date })

beforeEach(() => {
  vi.clearAllMocks()
  ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null)
})

describe('reconcileGroupJoin — the shared chokepoint every enrollment entry point calls', () => {
  it('is a no-op when the group has no completed sessions (join before first session)', async () => {
    const db = makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules:     { data: [], error: null },
    })

    await reconcileGroupJoin({ db, studentId: 's1', groupId: 'g1', performedBy: 'user-1' })

    expect(logTimelineEvents).not.toHaveBeenCalled()
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('flags (timeline + audit) but never auto-consumes when no `choice` is provided (server-only entry points)', async () => {
    const db = makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: { data: [S('sch-1', 1, '2026-01-01'), S('sch-2', 2, '2026-01-08')], error: null },
      attendance_records: { data: [], error: null },
    })
    ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'enr-1' })

    await reconcileGroupJoin({ db, studentId: 's1', groupId: 'g1', courseId: 'course-1', performedBy: 'user-1' })

    expect(logTimelineEvents).toHaveBeenCalledTimes(1)
    const [events] = (logTimelineEvents as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(events[0]).toMatchObject({ student_id: 's1', enrollment_id: 'enr-1', event_type: 'HISTORICAL_RECONCILIATION' })
    // Never calls the consumption RPC on the flag-only path.
    expect(db.rpc).toHaveBeenCalledWith('write_audit_log', expect.objectContaining({ p_action: 'historical_enrollment_reconciliation_flagged' }))
    expect(db.rpc).not.toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.anything())
  })

  it('skips silently (no flag) when there is no enrollment to attribute anything to', async () => {
    const db = makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: { data: [S('sch-1', 1, '2026-01-01')], error: null },
      attendance_records: { data: [], error: null },
    })
    ;(findActiveEnrollmentForCourse as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await reconcileGroupJoin({ db, studentId: 's1', groupId: 'g1', performedBy: 'user-1' })

    // Still flags — staff need to know sessions are pending even with no contract yet.
    expect(logTimelineEvents).toHaveBeenCalledTimes(1)
    expect(db.rpc).not.toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.anything())
  })

  it('applies the resolved choice for real when a dialog already ran (choice provided)', async () => {
    const db = makeDb({
      group_courses: { data: [{ id: 'gc-1', course_id: 'course-1' }], error: null },
      schedules: { data: [S('sch-1', 1, '2026-01-01')], error: null },
      attendance_records: { data: [], error: null },
      student_enrollments: { data: { id: 'enr-1', enrolled_sessions: 10, consumed_sessions: 0, remaining_sessions: 10, allow_overdraft_sessions: false, net_amount: 1000 }, error: null },
      'rpc:apply_historical_reconciliation_records': {
        data: [{ attendance_record_id: 'ar-1', schedule_id: 'sch-1', funded: true }],
        error: null,
      },
    })

    await reconcileGroupJoin({
      db, studentId: 's1', groupId: 'g1', courseId: 'course-1', enrollmentId: 'enr-1',
      performedBy: 'user-1', choice: { mode: 'ALL' },
    })

    expect(db.rpc).toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.objectContaining({
      p_schedule_ids: ['sch-1'], p_student_id: 's1', p_enrollment_id: 'enr-1',
    }))
  })

  it('a choice of NEXT_ONLY never calls the consumption RPC', async () => {
    const db = makeDb({})
    await reconcileGroupJoin({
      db, studentId: 's1', groupId: 'g1', enrollmentId: 'enr-1',
      performedBy: 'user-1', choice: { mode: 'NEXT_ONLY' },
    })
    expect(db.rpc).not.toHaveBeenCalledWith('apply_historical_reconciliation_records', expect.anything())
  })

  it('never throws — a DB error is swallowed so the caller\'s already-committed enrollment write is never rolled back by this', async () => {
    const db = {
      from: vi.fn(() => { throw new Error('boom') }),
      rpc: vi.fn(),
    } as any

    await expect(
      reconcileGroupJoin({ db, studentId: 's1', groupId: 'g1', performedBy: 'user-1' })
    ).resolves.toBeUndefined()
  })
})
