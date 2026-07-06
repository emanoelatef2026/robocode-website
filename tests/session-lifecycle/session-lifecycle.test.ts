import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
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

vi.mock('@/modules/academic/contract-consumption', () => ({
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
import { startSession, saveAttendance, endSession, postponeSession } from '@/modules/instructor-portal/actions'
import { SLOT_CONSUMING_STATUSES } from '@/modules/attendance/constants'
import { awardXP } from '@/modules/gamification/xp-service'

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
  it('sets session status to ongoing and returns success', async () => {
    const db = mockDb({
      schedules: [
        { data: { id: 'a0000000-0000-4000-8000-000000000001', status: 'scheduled' }, error: null }, // initial status fetch
        { data: { branch_id: 'a0000000-0000-4000-8000-000000000020', group_courses: { group_id: 'a0000000-0000-4000-8000-000000000010' } }, error: null }, // getSessionAccessContext
        { data: null, error: null },                                                                  // update to ongoing
      ],
    })

    const result = await startSession('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010')

    expect(result.success).toBe(true)

    // Check that the schedules table was updated (ongoing) — NOT completed
    const calls = db.from.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('schedules')
    // session_instructors must NOT be touched
    expect(calls).not.toContain('session_instructors')
    // attendance_records must NOT be touched
    expect(calls).not.toContain('attendance_records')
  })
})

// ── TEST 2: Save attendance → no session_instructors, no consumption ──────────

describe('saveAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReset()
  })

  it('saves attendance records but does NOT touch session_instructors or run consumption', async () => {
    const db = mockDb({
      schedules: [
        // getSessionAccessContext: branch_id query
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        // saveAttendance: status/topic query
        { data: { status: 'ongoing', topic: null, scheduled_at: '2026-06-28T10:00:00Z' }, error: null },
      ],
      group_students:     [{ data: [{ student_id: 'stu-1' }], error: null }],
      attendance_records: [{ data: null, error: null }],
    })

    const fd = makeFormData({
      session_id:        'sess-1',
      group_id:          'grp-1',
      'student_ids[]':   'stu-1',
      topic:             'Variables',
      status_stu_1:      'present',
      'notes_stu-1':     '',
    })
    // Override status key with correct suffix
    fd.set('status_stu-1', 'present')

    const result = await saveAttendance(null, fd)

    const calledTables = db.from.mock.calls.map((c: any[]) => c[0])
    expect(calledTables).not.toContain('session_instructors')
    expect(db.rpc).not.toHaveBeenCalledWith('consume_attendance_sessions_batch', expect.anything())

    // Result should succeed (attendance written)
    expect(result?.success ?? true).toBeTruthy()
  })
})

// ── TEST 3: End session → session_instructors created, consumption runs ───────

describe('endSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReset()
  })

  it('upserts session_instructors and triggers consumption on end', async () => {
    const db = mockDb({
      schedules: [
        // fetch for status/validation check (force=true skips count checks)
        { data: { id: 'sess-1', status: 'ongoing', topic: 'Loops', notes: null, branch_id: 'br-1', scheduled_at: '2026-06-28T10:00:00Z', group_courses: { group_id: 'grp-1' } }, error: null },
        // getSessionAccessContext branch query
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        // update to completed
        { data: null, error: null },
        // session_number query
        { data: { session_number: 3 }, error: null },
      ],
      session_instructors: [{ data: null, error: null }],
      attendance_records: [
        { data: [{ id: 'att-1', student_id: 'stu-1', status: 'present' }], error: null },
      ],
      student_enrollments: [{ data: [], error: null }],
      group_instructors:   [{ data: null, error: null }],
    })

    const result = await endSession('sess-1', 'grp-1', true)

    expect(result.success).toBe(true)
    const calledTables = db.from.mock.calls.map((c: any[]) => c[0])
    expect(calledTables).toContain('session_instructors')
    expect(calledTables).toContain('attendance_records')
  })
})

// ── TEST 4 & 5: Postpone → attendance_records deleted ─────────────────────────

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

describe('Attendance status rules — ATTENDANCE_PRESENCE_STATUSES', () => {
  it('late counts as attending (present for XP purposes)', async () => {
    const db = mockDb({
      schedules: [
        { data: { id: 'sess-4', status: 'ongoing', topic: 'Loops', notes: null, branch_id: 'br-1', scheduled_at: '2026-06-28T10:00:00Z', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: null, error: null },
        { data: { session_number: 1 }, error: null },
      ],
      session_instructors: [{ data: null, error: null }],
      attendance_records: [
        { data: [{ id: 'att-2', student_id: 'stu-2', status: 'late' }], error: null },
      ],
      student_enrollments: [{ data: [], error: null }],
      group_instructors:   [{ data: null, error: null }],
    })

    await endSession('sess-4', 'grp-1', true)

    expect(awardXP).toHaveBeenCalledWith('stu-2', 10, true) // ATTENDANCE_LATE = 10
  })
})

// ── TEST 8: Excused attendance does NOT count for XP ─────────────────────────

describe('Attendance status rules — excused not counted', () => {
  it('excused does NOT trigger XP award', async () => {
    const db = mockDb({
      schedules: [
        { data: { id: 'sess-5', status: 'ongoing', topic: 'Loops', notes: null, branch_id: 'br-1', scheduled_at: '2026-06-28T10:00:00Z', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: null, error: null },
        { data: { session_number: 1 }, error: null },
      ],
      session_instructors: [{ data: null, error: null }],
      attendance_records: [
        { data: [{ id: 'att-3', student_id: 'stu-3', status: 'excused' }], error: null },
      ],
      student_enrollments: [{ data: [], error: null }],
      group_instructors:   [{ data: null, error: null }],
    })

    await endSession('sess-5', 'grp-1', true)

    expect(awardXP).not.toHaveBeenCalledWith('stu-3', expect.anything(), expect.anything())
  })
})

// ── TEST 9: Makeup attendance counts for XP ───────────────────────────────────

describe('Attendance status rules — makeup counted', () => {
  it('makeup triggers XP award (same as late)', async () => {
    const db = mockDb({
      schedules: [
        { data: { id: 'sess-6', status: 'ongoing', topic: 'Loops', notes: null, branch_id: 'br-1', scheduled_at: '2026-06-28T10:00:00Z', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: { branch_id: 'br-1', group_courses: { group_id: 'grp-1' } }, error: null },
        { data: null, error: null },
        { data: { session_number: 1 }, error: null },
      ],
      session_instructors: [{ data: null, error: null }],
      attendance_records: [
        { data: [{ id: 'att-4', student_id: 'stu-4', status: 'makeup' }], error: null },
      ],
      student_enrollments: [{ data: [], error: null }],
      group_instructors:   [{ data: null, error: null }],
    })

    await endSession('sess-6', 'grp-1', true)

    expect(awardXP).toHaveBeenCalledWith('stu-4', expect.any(Number), true)
  })
})

// ── SLOT_CONSUMING_STATUSES constants sanity check ────────────────────────────

describe('SLOT_CONSUMING_STATUSES', () => {
  it('present, late, makeup all consume enrollment slots', () => {
    expect(SLOT_CONSUMING_STATUSES.has('present')).toBe(true)
    expect(SLOT_CONSUMING_STATUSES.has('late')).toBe(true)
    expect(SLOT_CONSUMING_STATUSES.has('makeup')).toBe(true)
  })
})
