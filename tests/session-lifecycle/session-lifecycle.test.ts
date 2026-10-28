import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('@/modules/instructor-portal/session-changes', () => ({ queueSessionChange: vi.fn().mockResolvedValue(null), assertSessionLead: vi.fn().mockResolvedValue({success:true,data:undefined}) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-test' }),
  requireAuth:       vi.fn().mockResolvedValue({ id: 'user-test' }),
}))

vi.mock('@/modules/instructor-portal/queries', () => ({
  getInstructorByUserId: vi.fn().mockResolvedValue({ id: 'instr-1' }),
}))

vi.mock('@/modules/academic/session-ownership', () => ({
  validateSessionOwnership:       vi.fn().mockResolvedValue({ allowed: true }),
  canInstructorCreateNextSession: vi.fn().mockResolvedValue({ allowed: true }),
  completeInstructorAllocation:   vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/modules/academic/constants', () => ({
  validateAcademicTopic: vi.fn((t: string | null) => (t && t.trim() && t.toLowerCase() !== 'no topic' ? t.trim() : null)),
}))

vi.mock('@/modules/progress/resolve', () => ({
  resolveGroupProgressContext: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/modules/progress/safe-recalc', () => ({
  safeRecalcProgressBatch: vi.fn().mockResolvedValue(undefined),
  buildBatchTuples:        vi.fn().mockReturnValue([]),
}))

vi.mock('@/modules/academic/contract-consumption', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/modules/academic/contract-consumption')>(),
  checkConsumptionEligibility: vi.fn().mockReturnValue({ shouldConsume: false }),
  resolveFifoEnrollment:       vi.fn().mockReturnValue(null),
}))

vi.mock('@/modules/gamification/xp-service', () => ({
  awardXP:    vi.fn().mockResolvedValue({ newTotal: 25, newLevel: 1, leveledUp: false }),
  XP_AWARDS:  { ATTENDANCE_PRESENT: 25, ATTENDANCE_LATE: 10 },
}))

vi.mock('@/modules/gamification/achievement-service', () => ({
  checkAndUnlockAchievements: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/modules/gamification/badge-service', () => ({
  checkAndAwardBadges: vi.fn().mockResolvedValue([]),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { startSession, saveAttendance, saveAndEndSession, endSession, postponeSession, updateSession, startGroupSession } from '@/modules/instructor-portal/actions'
import { SLOT_CONSUMING_STATUSES } from '@/modules/attendance/constants'
import { after } from 'next/server'

// ── Helper ────────────────────────────────────────────────────────────────────

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// Minimal FormData factory for saveAttendance / postponeSession
function makeFormData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [key, val] of Object.entries(fields)) {
    if (Array.isArray(val)) { for (const v of val) fd.append(key, v) }
    else fd.set(key, val)
  }
  return fd
}

// ── TEST 1: Open session → only sets status to 'ongoing', no payroll/counts ──

describe('startSession', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each(['cancelled', 'cancelled_with_makeup', 'postponed', 'completed'])('never starts %s', async status => {
    const db = mockDb({ schedules: [{ data: { status, group_courses: { group_id: 'group' } }, error: null }] })
    expect((await startSession('session', 'group')).success).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it.each(['ongoing', 'scheduled'])('opens %s through the locked shared RPC without writing attendance/payroll directly', async status => {
    const db = mockDb({ schedules: [{ data: { id: 'session', group_course_id: 'course', topic: 'Loops', status, group_courses: { group_id: 'group' } }, error: null }] })
    db.rpc.mockResolvedValue({ data: { sessionId: 'shared-session', groupId: 'group' }, error: null })
    expect(await startSession('session', 'group')).toEqual({ success: true, data: { sessionId: 'shared-session' } })
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('open_shared_instructor_session', {
      p_actor: 'user-test', p_instructor: 'instr-1', p_course: 'course', p_expected_session: 'session', p_expected_previous: null, p_topic: 'Loops',
    })
    expect(db.from).toHaveBeenCalledExactlyOnceWith('schedules')
  })
  it('rejects a forged group before invoking the starter', async () => {
    const db = mockDb({ schedules: [{ data: { status: 'scheduled', group_courses: { group_id: 'actual' } }, error: null }] })
    expect((await startSession('session', 'forged')).success).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('a concurrent cancellation is rejected by the RPC rather than creating the next class', async () => {
    const db = mockDb({ schedules: [{ data: { status: 'scheduled', group_courses: { group_id: 'group' } }, error: null }] })
    db.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Session list changed. Refresh first.' } })
    expect((await startSession('session', 'group')).success).toBe(false)
  })
})

// ── TEST 2: Save attendance → no session_instructors, no consumption ──────────

const sessionId = 'a0000000-0000-4000-8000-000000000001'
const groupId = 'a0000000-0000-4000-8000-000000000010'
const studentId = 'a0000000-0000-4000-8000-000000000030'
function attendanceForm(status: string | null = 'present') {
  const fd = makeFormData({ session_id: sessionId, group_id: groupId, 'student_ids[]': studentId, topic: 'Variables' })
  if (status !== null) fd.set(`status_${studentId}`, status)
  return fd
}

describe('atomic session actions', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('a stale session details save never writes status and cannot reopen a completed session', async () => {
    const db = mockDb({ schedules: [
      { data: { branch_id: 'branch', group_courses: { group_id: groupId } }, error: null },
      { data: { status: 'completed' }, error: null },
      { data: null, error: null },
    ] })
    const original = db.from.getMockImplementation()!
    const writes: unknown[] = []
    db.from.mockImplementation(table => {
      const chain = original(table)
      chain.update = (values: unknown) => { writes.push(values); return chain }
      return chain
    })
    const fd = makeFormData({ session_id: sessionId, group_id: groupId, status: 'ongoing', topic: 'Corrected topic' })
    expect((await updateSession(null, fd)).success).toBe(true)
    expect(writes).toEqual([{ topic: 'Corrected topic' }])
  })
  it('save-only delegates attendance and topic to one RPC without consuming or scheduling effects', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: { status: 'ongoing' }, error: null })
    expect((await saveAttendance(null, attendanceForm())).success).toBe(true)
    expect(db.from).not.toHaveBeenCalled()
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('save_shared_instructor_session', {
      p_actor_id: 'user-test', p_instructor_id: 'instr-1',
      p_session_id: sessionId, p_group_id: groupId, p_complete: false, p_topic: 'Variables',
      p_attendance: [{ student_id: studentId, status: 'present', late_minutes: null, notes: null }], p_expected_revision: null,
    })
    expect(after).not.toHaveBeenCalled()
  })
  it('save-and-end passes attendance with completion in the same RPC then registers after work', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: { status: 'completed' }, error: null })
    expect((await saveAndEndSession(null, attendanceForm('absent'))).success).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith('save_shared_instructor_session', expect.objectContaining({
      p_complete: true, p_attendance: [expect.objectContaining({ status: 'absent' })],
    }))
    expect(after).toHaveBeenCalledOnce()
  })
  it('legacy force cannot bypass finalizer validation', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Every active student needs valid attendance before ending' } })
    expect(await endSession(sessionId, groupId, true)).toEqual({
      success: false, error: { code: 'VALIDATION', message: 'Every active student needs valid attendance before ending' },
    })
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('save_shared_instructor_session', expect.objectContaining({
      p_complete: true, p_attendance: null, p_topic: null,
    }))
    expect(after).not.toHaveBeenCalled()
  })
  it.each([null, '', 'unknown'])('rejects missing/invalid status %s without defaulting it', async status => {
    const db = mockDb({})
    expect((await saveAttendance(null, attendanceForm(status))).success).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('rejects duplicate students before calling the RPC', async () => {
    const db = mockDb({})
    const fd = attendanceForm()
    fd.append('student_ids[]', studentId)
    expect((await saveAttendance(null, fd)).success).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('maps SQL authorization failures and schedules no after work', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Session outside instructor allocation' } })
    expect(await saveAndEndSession(null, attendanceForm())).toEqual({
      success: false, error: { code: 'FORBIDDEN', message: 'Session outside instructor allocation' },
    })
    expect(after).not.toHaveBeenCalled()
  })
  it('unexpected critical write failures return failure, hide raw DB messages and schedule no work', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'sensitive internal constraint' } })
    const result = await saveAndEndSession(null, attendanceForm())
    expect(result).toEqual({ success: false, error: { code: 'DB_ERROR', message: 'Unable to save the session. Please retry.' } })
    expect(after).not.toHaveBeenCalled()
  })
  it('completed allocation retries can return success without replaying attendance from legacy end', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: { status: 'completed', already_completed: true }, error: null })
    expect((await endSession(sessionId, groupId)).success).toBe(true)
    expect(db.from).not.toHaveBeenCalled()
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_attendance: null, p_complete: true })
  })
  it('does not accept an empty RPC success payload', async () => {
    mockDb({})
    expect((await saveAndEndSession(null, attendanceForm())).success).toBe(false)
    expect(after).not.toHaveBeenCalled()
  })
  it('group start ignores client group/branch identifiers and uses authoritative RPC context', async () => {
    const db = mockDb({})
    db.rpc.mockResolvedValue({ data: { sessionId, groupId }, error: null })
    expect(await startGroupSession(sessionId, 'forged-group', 'forged-branch', 'Loops', null, null)).toEqual({ success: true, data: { sessionId } })
    expect(db.from).not.toHaveBeenCalled()
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('open_shared_instructor_session', {
      p_actor: 'user-test', p_instructor: 'instr-1', p_course: sessionId, p_topic: 'Loops', p_expected_session: null, p_expected_previous: null,
    })
  })
})

describe('postponeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReset()
  })

  it('deletes attendance_records and session_instructors when postponing', async () => {
    const db = mockDb({
      schedules: [
        // getSessionAccessContext branch query
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        // status check
        { data: { status: 'ongoing' }, error: null },
        // update to postponed
        { data: null, error: null },
      ],
      attendance_records: [{ data: null, error: null }],
      session_instructors: [{ data: null, error: null }],
    })

    const fd = makeFormData({ session_id: 'a0000000-0000-4000-8000-000000000001', group_id: 'a0000000-0000-4000-8000-000000000010' })
    const result = await postponeSession(null, fd)

    expect(result.success).toBe(true)
    const calledTables = db.from.mock.calls.map((c: any[]) => c[0])
    expect(calledTables).toContain('attendance_records')
    expect(calledTables).toContain('session_instructors')
  })

  it('deletes attendance even when records exist before postponing', async () => {
    const db = mockDb({
      schedules: [
        { data: { branch_id: 'a0000000-0000-4000-8000-000000000020', group_courses: { group_id: 'a0000000-0000-4000-8000-000000000010' } }, error: null },
        { data: { status: 'ongoing' }, error: null },
        { data: null, error: null },
      ],
      attendance_records: [{ data: null, error: null }],
      session_instructors: [{ data: null, error: null }],
    })

    const fd = makeFormData({ session_id: 'a0000000-0000-4000-8000-000000000002', group_id: 'a0000000-0000-4000-8000-000000000010', reason: 'Instructor unavailable' })
    const result = await postponeSession(null, fd)

    expect(result.success).toBe(true)
    const calledTables = db.from.mock.calls.map((c: any[]) => c[0])
    expect(calledTables).toContain('attendance_records')
  })
})

// ── TEST 6: Completed session cannot be postponed ─────────────────────────────

describe('postponeSession — completed session', () => {
  it('returns VALIDATION error when session is already completed', async () => {
    mockDb({
      schedules: [
        // getSessionAccessContext
        { data: { branch_id: 'a0000000-0000-4000-8000-000000000020', group_courses: { group_id: 'a0000000-0000-4000-8000-000000000010' } }, error: null },
        // status check → completed
        { data: { status: 'completed' }, error: null },
      ],
    })

    const fd = makeFormData({ session_id: 'a0000000-0000-4000-8000-000000000003', group_id: 'a0000000-0000-4000-8000-000000000010' })
    const result = await postponeSession(null, fd)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.message).toMatch(/cannot be postponed/i)
    }
  })
})

// ── TEST 7: Late attendance counts (presence for XP) ─────────────────────────

describe('SLOT_CONSUMING_STATUSES', () => {
  it('present, late, makeup all consume enrollment slots', () => {
    expect(SLOT_CONSUMING_STATUSES.has('present')).toBe(true)
    expect(SLOT_CONSUMING_STATUSES.has('late')).toBe(true)
    expect(SLOT_CONSUMING_STATUSES.has('makeup')).toBe(true)
  })
})
