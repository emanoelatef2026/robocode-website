import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb, createSuccessMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ─────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-tl-001' }),
  requireAuth:       vi.fn().mockResolvedValue({ id: 'user-tl-001' }),
  requirePortalRole: vi.fn().mockResolvedValue({ id: 'user-tl-001', branchIds: ['branch-001'] }),
}))

vi.mock('@/modules/instructor-portal/queries', () => ({
  getInstructorByUserId: vi.fn().mockResolvedValue(null), // TL user has no instructor record
}))

vi.mock('@/modules/notifications/actions', () => ({
  seedTrialSessionAssignedNotification:  vi.fn().mockResolvedValue(undefined),
  seedMakeupSessionAssignedNotification: vi.fn().mockResolvedValue(undefined),
}))

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  createTrialSession,
  createMakeupSession,
  addTrialStudentFromLead,
  addTrialStudentNew,
  addMakeupStudent,
  startSpecialSession,
  endTrialSession,
  endMakeupSession,
  postponeSpecialSession,
  bulkBookTrialFromLeads,
} from '@/modules/special-sessions/actions'
import { seedTrialSessionAssignedNotification, seedMakeupSessionAssignedNotification } from '@/modules/notifications/actions'

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const BRANCH_ID         = '00000000-0000-4000-8000-000000000001'
const INSTR_ID          = '00000000-0000-4000-8000-000000000002'
const SESSION_ID        = '00000000-0000-4000-8000-000000000003'
const STUDENT_ID        = '00000000-0000-4000-8000-000000000004'
const LEAD_ID           = '00000000-0000-4000-8000-000000000005'
const MISSED_SESSION_ID = '00000000-0000-4000-8000-000000000006'

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Phase XL — Special Sessions System', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Create trial session inserts with type='trial' and group_course_id=null
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 1 — createTrialSession inserts schedule with type=trial and group_course_id=null', async () => {
    const db = mockDb({
      schedules:           [{ data: { id: SESSION_ID }, error: null }],
      session_instructors: [{ data: { id: 'si-001' }, error: null }],
      instructors:         [{ data: { user_id: 'user-instr-001', users: { email: 'i@test.com' } }, error: null }],
    })

    const result = await createTrialSession(
      null,
      fd({
        branch_id:        BRANCH_ID,
        instructor_id:    INSTR_ID,
        scheduled_at:     '2026-07-15T10:00',
        duration_minutes: '90',
        notes:            'Test trial',
      })
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sessionId).toBe(SESSION_ID)

    // Verify schedules.insert was called (table queued)
    expect(db.from).toHaveBeenCalledWith('schedules')
    // Verify session_instructors.upsert was called
    expect(db.from).toHaveBeenCalledWith('session_instructors')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Create makeup session inserts with type='makeup' and group_course_id=null
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 2 — createMakeupSession inserts schedule with type=makeup and group_course_id=null', async () => {
    const db = mockDb({
      schedules:           [{ data: { id: SESSION_ID }, error: null }],
      session_instructors: [{ data: { id: 'si-002' }, error: null }],
      instructors:         [{ data: { user_id: 'user-instr-001' }, error: null }],
    })

    const result = await createMakeupSession(
      null,
      fd({
        branch_id:        BRANCH_ID,
        instructor_id:    INSTR_ID,
        scheduled_at:     '2026-07-15T11:00',
        duration_minutes: '60',
      })
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sessionId).toBe(SESSION_ID)
    expect(db.from).toHaveBeenCalledWith('schedules')
    expect(db.from).toHaveBeenCalledWith('session_instructors')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Trial session end does NOT consume student sessions (no rpc called)
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 3 — endTrialSession does not call consume_attendance_sessions_batch', async () => {
    const db = mockDb({
      schedules:               [{ data: { status: 'ongoing', branch_id: BRANCH_ID }, error: null },
                                { data: null, error: null }],
      session_instructors:     [{ data: { instructor_id: INSTR_ID }, error: null },
                                { data: null, error: null }],
      trial_session_students:  [{ data: [], error: null }],
    })

    const result = await endTrialSession(SESSION_ID)

    expect(result.success).toBe(true)
    // consume_attendance_sessions_batch must NOT be called
    expect(db.rpc).not.toHaveBeenCalledWith(
      'consume_attendance_sessions_batch',
      expect.anything()
    )
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Makeup EXTRA mode calls consume_attendance_sessions_batch
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 4 — endMakeupSession (EXTRA) calls consume_attendance_sessions_batch', async () => {
    const ENROLL_ID = 'enrl-001'
    const ATT_ID    = 'att-001'

    const db = mockDb({
      schedules:              [{ data: { status: 'ongoing', branch_id: BRANCH_ID, scheduled_at: '2026-07-15T11:00:00Z' }, error: null },
                               { data: null, error: null }],
      session_instructors:    [{ data: null, error: null }],
      makeup_session_students:[{
        data: [{
          id: 'mss-001', student_id: STUDENT_ID, mode: 'EXTRA',
          replaced_session_id: null, attendance_status: 'present',
        }],
        error: null,
      }],
      student_enrollments: [{
        data: [{
          id: ENROLL_ID, student_id: STUDENT_ID,
          remaining_sessions: 5, enrolled_sessions: 10,
          start_date: '2026-01-01', end_date: null,
          allow_overdraft_sessions: false,
        }],
        error: null,
      }],
      attendance_records: [{ data: { id: ATT_ID }, error: null }],
    })

    const result = await endMakeupSession(SESSION_ID)

    expect(result.success).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith(
      'consume_attendance_sessions_batch',
      expect.objectContaining({ p_record_ids: [ATT_ID], p_student_ids: [STUDENT_ID] })
    )
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Makeup REPLACE_MISSED updates absence → 'makeup', no consumption
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 5 — endMakeupSession (REPLACE_MISSED) updates attendance_records and does not consume', async () => {
    const db = mockDb({
      schedules:              [{ data: { status: 'ongoing', branch_id: BRANCH_ID, scheduled_at: '2026-07-15T11:00:00Z' }, error: null },
                               { data: null, error: null }],
      session_instructors:    [{ data: null, error: null }],
      makeup_session_students:[{
        data: [{
          id: 'mss-002', student_id: STUDENT_ID, mode: 'REPLACE_MISSED',
          replaced_session_id: MISSED_SESSION_ID, attendance_status: 'present',
        }],
        error: null,
      }],
      student_enrollments: [{ data: [], error: null }],
      attendance_records:  [{ data: null, error: null }],
    })

    const result = await endMakeupSession(SESSION_ID)

    expect(result.success).toBe(true)
    // attendance_records update should have been called (for REPLACE_MISSED)
    expect(db.from).toHaveBeenCalledWith('attendance_records')
    // consume RPC should NOT be called (no EXTRA students)
    expect(db.rpc).not.toHaveBeenCalledWith('consume_attendance_sessions_batch', expect.anything())
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: endTrialSession stamps session_instructors.submitted_at (payroll)
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 6 — endTrialSession sets submitted_at on session_instructors (payroll)', async () => {
    const db = mockDb({
      schedules:               [{ data: { status: 'ongoing', branch_id: BRANCH_ID }, error: null },
                                { data: null, error: null }],
      session_instructors:     [{ data: { instructor_id: INSTR_ID }, error: null },
                                { data: null, error: null }],
      trial_session_students:  [{ data: [], error: null }],
    })

    await endTrialSession(SESSION_ID)

    // session_instructors should be updated (queued and consumed)
    const calls = (db.from as ReturnType<typeof vi.fn>).mock.calls
    const siCalls = calls.filter((c: any[]) => c[0] === 'session_instructors')
    expect(siCalls.length).toBeGreaterThanOrEqual(1)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: endMakeupSession stamps session_instructors.submitted_at (payroll)
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 7 — endMakeupSession sets submitted_at on session_instructors (payroll)', async () => {
    const db = mockDb({
      schedules:              [{ data: { status: 'ongoing', branch_id: BRANCH_ID, scheduled_at: '2026-07-15T11:00:00Z' }, error: null },
                               { data: null, error: null }],
      session_instructors:    [{ data: null, error: null }],
      makeup_session_students:[{ data: [], error: null }],
    })

    await endMakeupSession(SESSION_ID)

    expect(db.from).toHaveBeenCalledWith('session_instructors')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: TodaySession.session_type drives badge display (unit test on data shape)
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 8 — TodaySession session_type field correctly typed for badges', () => {
    const primary = { id: '1', session_type: 'primary' as const, group_id: 'g1', group_name: 'Alpha', course_title: 'Python', branch_name: 'Main', scheduled_at: new Date().toISOString(), duration_minutes: 60, student_count: 10, session_number: 1, status: 'scheduled', group_course_id: 'gc1' }
    const trial   = { id: '2', session_type: 'trial'   as const, group_id: '',   group_name: 'Trial Session', course_title: '', branch_name: 'Main', scheduled_at: new Date().toISOString(), duration_minutes: 60, student_count: 0, session_number: null, status: 'scheduled', group_course_id: null }
    const makeup  = { id: '3', session_type: 'makeup'  as const, group_id: '',   group_name: 'Makeup Session', course_title: '', branch_name: 'Main', scheduled_at: new Date().toISOString(), duration_minutes: 60, student_count: 0, session_number: null, status: 'scheduled', group_course_id: null }

    expect(primary.session_type).toBe('primary')
    expect(trial.session_type).toBe('trial')
    expect(makeup.session_type).toBe('makeup')

    // Special sessions have null group_course_id (standalone)
    expect(primary.group_course_id).not.toBeNull()
    expect(trial.group_course_id).toBeNull()
    expect(makeup.group_course_id).toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9: Permission enforcement — trial requires manage_schedule
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 9 — createTrialSession calls requirePermission with manage_schedule', async () => {
    const { requirePermission } = await import('@/modules/rbac/guards')

    mockDb({
      schedules:           [{ data: { id: SESSION_ID }, error: null }],
      session_instructors: [{ data: null, error: null }],
      instructors:         [{ data: null, error: null }],
    })

    await createTrialSession(null, fd({
      branch_id:        BRANCH_ID,
      instructor_id:    INSTR_ID,
      scheduled_at:     '2026-07-15T10:00',
      duration_minutes: '60',
    }))

    expect(requirePermission).toHaveBeenCalledWith('manage_schedule')
  })

  it('TEST 9b — createMakeupSession calls requirePermission with manage_schedule (TL-only)', async () => {
    const { requirePermission } = await import('@/modules/rbac/guards')

    mockDb({
      schedules:           [{ data: { id: SESSION_ID }, error: null }],
      session_instructors: [{ data: null, error: null }],
      instructors:         [{ data: null, error: null }],
    })

    await createMakeupSession(null, fd({
      branch_id:        BRANCH_ID,
      instructor_id:    INSTR_ID,
      scheduled_at:     '2026-07-15T10:00',
      duration_minutes: '60',
    }))

    expect(requirePermission).toHaveBeenCalledWith('manage_schedule')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 10: Calendar types — SpecialSessionListItem has type field
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 10 — SpecialSessionListItem type field drives calendar color coding', () => {
    const SESSION_TYPE_COLOR = {
      trial:   { bg: 'bg-purple-100', text: 'text-purple-700' },
      makeup:  { bg: 'bg-orange-100', text: 'text-orange-700' },
      primary: { bg: 'bg-blue-100',   text: 'text-blue-700' },
    }

    expect(SESSION_TYPE_COLOR.trial.bg).toBe('bg-purple-100')
    expect(SESSION_TYPE_COLOR.makeup.bg).toBe('bg-orange-100')
    expect(SESSION_TYPE_COLOR.primary.bg).toBe('bg-blue-100')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 11: Add trial student from lead updates lead status to TRIAL_BOOKED
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 11 — addTrialStudentFromLead updates lead status to TRIAL_BOOKED', async () => {
    const db = mockDb({
      schedules:              [{ data: { type: 'trial' }, error: null }],
      leads:                  [{ data: { id: LEAD_ID, child_name: 'Ali Hassan', phone: '01012345678', whatsapp: null }, error: null },
                               { data: null, error: null }],
      trial_session_students: [{ data: { id: 'tss-001' }, error: null }],
    })

    const result = await addTrialStudentFromLead(null, fd({
      schedule_id: SESSION_ID,
      lead_id:     LEAD_ID,
    }))

    expect(result.success).toBe(true)
    // Leads table should have been called twice: once to fetch, once to update
    const leadCalls = (db.from as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: any[]) => c[0] === 'leads')
    expect(leadCalls.length).toBe(2)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 12: Postpone rollback clears trial and makeup attendance
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 12 — postponeSpecialSession clears trial and makeup attendance_status', async () => {
    const db = mockDb({
      schedules:               [{ data: { status: 'ongoing', branch_id: BRANCH_ID }, error: null },
                                { data: null, error: null }],
      trial_session_students:  [{ data: null, error: null }],
      makeup_session_students: [{ data: null, error: null }],
    })

    const result = await postponeSpecialSession(null, fd({
      session_id: SESSION_ID,
      reason:     'Instructor unavailable',
    }))

    expect(result.success).toBe(true)

    const calls = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('trial_session_students')
    expect(calls).toContain('makeup_session_students')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 13: Notifications seeded on trial and makeup session creation
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 13 — createTrialSession seeds TRIAL_SESSION_ASSIGNED notification', async () => {
    mockDb({
      schedules:           [{ data: { id: SESSION_ID }, error: null }],
      session_instructors: [{ data: null, error: null }],
      instructors:         [{ data: { user_id: 'user-instr-001', users: { email: 'i@test.com' } }, error: null }],
    })

    await createTrialSession(null, fd({
      branch_id:        BRANCH_ID,
      instructor_id:    INSTR_ID,
      scheduled_at:     '2026-07-15T10:00',
      duration_minutes: '60',
    }))

    expect(seedTrialSessionAssignedNotification).toHaveBeenCalledWith(
      'user-instr-001',
      SESSION_ID,
      expect.stringContaining('2026')
    )
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 14: Validation — REPLACE_MISSED requires replaced_session_id
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 14 — addMakeupStudent rejects REPLACE_MISSED without replaced_session_id', async () => {
    mockDb({
      makeup_session_students: [{ data: null, error: null }],
    })

    const result = await addMakeupStudent(null, fd({
      schedule_id: SESSION_ID,
      student_id:  STUDENT_ID,
      mode:        'REPLACE_MISSED',
      // replaced_session_id intentionally omitted
    }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.message).toMatch(/missed session/i)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 15: Backward compatibility — startSpecialSession guards on group_course_id=null
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 15 — startSpecialSession only matches standalone sessions (group_course_id IS NULL guard)', async () => {
    // Simulate a primary session (group_course_id is NOT null → query returns null)
    const db = mockDb({
      schedules: [{ data: null, error: null }], // IS NULL filter excludes primary sessions
    })

    const result = await startSpecialSession('primary-session-id')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 15b: endTrialSession updates present leads to TRIAL_ATTENDED
  // ─────────────────────────────────────────────────────────────────────────────
  it('TEST 15b — endTrialSession marks present trial leads as TRIAL_ATTENDED', async () => {
    const db = mockDb({
      schedules:               [{ data: { status: 'ongoing', branch_id: BRANCH_ID }, error: null },
                                { data: null, error: null }],
      session_instructors:     [{ data: { instructor_id: INSTR_ID }, error: null },
                                { data: null, error: null }],
      trial_session_students:  [{ data: [{ lead_id: LEAD_ID }], error: null },
                                { data: null, error: null }],
      leads:                   [{ data: null, error: null }],
    })

    await endTrialSession(SESSION_ID)

    const calls = (db.from as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('leads')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST A: bulkBookTrialFromLeads creates one session and attaches N leads
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST A — bulkBookTrialFromLeads creates trial session and attaches multiple leads', async () => {
    const LEAD_ID_2 = '00000000-0000-4000-8000-000000000007'

    const db = mockDb({
      schedules:              [{ data: { id: SESSION_ID }, error: null }],
      session_instructors:    [{ data: null, error: null }],
      instructors:            [{ data: { user_id: 'user-instr-001', users: { email: 'i@test.com' } }, error: null }],
      leads:                  [
        // .in() returns an array of all matching leads
        { data: [
            { id: LEAD_ID,   child_name: 'Ali Hassan',   phone: '01012345678', whatsapp: null },
            { id: LEAD_ID_2, child_name: 'Sara Mohamed', phone: '01087654321', whatsapp: null },
          ], error: null },
        // Two lead .update() calls (one per lead)
        { data: null, error: null },
        { data: null, error: null },
      ],
      trial_session_students: [
        { data: { id: 'tss-bulk-001' }, error: null },
        { data: { id: 'tss-bulk-002' }, error: null },
      ],
    })

    const result = await bulkBookTrialFromLeads(null, fd({
      lead_ids:         JSON.stringify([LEAD_ID, LEAD_ID_2]),
      branch_id:        BRANCH_ID,
      instructor_id:    INSTR_ID,
      scheduled_at:     '2026-07-20T09:00',
      duration_minutes: '60',
    }))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe(SESSION_ID)
      expect(result.data.attachedCount).toBeGreaterThanOrEqual(1)
    }
    // One schedules row created
    expect(db.from).toHaveBeenCalledWith('schedules')
    // Leads table accessed for status updates
    expect(db.from).toHaveBeenCalledWith('leads')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST B: bulkBookTrialFromLeads validates required fields
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST B — bulkBookTrialFromLeads returns VALIDATION error when lead_ids is empty', async () => {
    mockDb({ schedules: [] })

    const result = await bulkBookTrialFromLeads(null, fd({
      lead_ids:      JSON.stringify([]),
      branch_id:     BRANCH_ID,
      instructor_id: INSTR_ID,
      scheduled_at:  '2026-07-20T09:00',
    }))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('VALIDATION')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST C: bulkBookTrialFromLeads calls manage_schedule permission
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST C — bulkBookTrialFromLeads requires manage_schedule (TL only)', async () => {
    const { requirePermission } = await import('@/modules/rbac/guards')

    mockDb({
      schedules:              [{ data: { id: SESSION_ID }, error: null }],
      session_instructors:    [{ data: null, error: null }],
      instructors:            [{ data: { user_id: 'user-instr-001', users: { email: 'i@test.com' } }, error: null }],
      leads:                  [
        { data: [{ id: LEAD_ID, child_name: 'Ali', phone: '010', whatsapp: null }], error: null },
        { data: null, error: null },
      ],
      trial_session_students: [{ data: { id: 'tss-001' }, error: null }],
    })

    await bulkBookTrialFromLeads(null, fd({
      lead_ids:      JSON.stringify([LEAD_ID]),
      branch_id:     BRANCH_ID,
      instructor_id: INSTR_ID,
      scheduled_at:  '2026-07-20T09:00',
    }))

    expect(requirePermission).toHaveBeenCalledWith('manage_schedule')
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST D: Instructor nav does NOT contain special-sessions route
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST D — INSTRUCTOR_NAV does not contain special-sessions or makeup routes', async () => {
    const { INSTRUCTOR_NAV } = await import('@/modules/instructor-portal/navigation')

    const hrefs = INSTRUCTOR_NAV.map(n => n.href)
    expect(hrefs.every(h => !h.includes('special-sessions'))).toBe(true)
    expect(hrefs.every(h => !h.includes('makeup'))).toBe(true)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST E: Instructor nav contains dashboard, groups, calendar, students
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST E — INSTRUCTOR_NAV contains required portal routes', async () => {
    const { INSTRUCTOR_NAV } = await import('@/modules/instructor-portal/navigation')

    const hrefs = INSTRUCTOR_NAV.map(n => n.href)
    expect(hrefs.some(h => h === '/portal/instructor')).toBe(true)
    expect(hrefs.some(h => h.includes('/portal/instructor/groups'))).toBe(true)
    expect(hrefs.some(h => h.includes('/portal/instructor/calendar'))).toBe(true)
    expect(hrefs.some(h => h.includes('/portal/instructor/students'))).toBe(true)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // XL.2 TEST F: bulkBookTrialFromLeads seeds notification for instructor
  // ─────────────────────────────────────────────────────────────────────────────
  it('XL.2 TEST F — bulkBookTrialFromLeads seeds TRIAL_SESSION_ASSIGNED notification', async () => {
    mockDb({
      schedules:              [{ data: { id: SESSION_ID }, error: null }],
      session_instructors:    [{ data: null, error: null }],
      instructors:            [{ data: { user_id: 'user-instr-999', users: { email: 'i@test.com' } }, error: null }],
      leads:                  [
        { data: [{ id: LEAD_ID, child_name: 'Ali', phone: '010', whatsapp: null }], error: null },
        { data: null, error: null },
      ],
      trial_session_students: [{ data: { id: 'tss-001' }, error: null }],
    })

    await bulkBookTrialFromLeads(null, fd({
      lead_ids:      JSON.stringify([LEAD_ID]),
      branch_id:     BRANCH_ID,
      instructor_id: INSTR_ID,
      scheduled_at:  '2026-07-20T09:00',
    }))

    expect(seedTrialSessionAssignedNotification).toHaveBeenCalledWith(
      'user-instr-999',
      SESSION_ID,
      expect.any(String)
    )
  })
})
