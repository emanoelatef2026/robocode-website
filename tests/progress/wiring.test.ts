/**
 * Verifies that every domain action that mutates progress-relevant data
 * calls the appropriate safeRecalcProgress* helper after its primary DB write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb, createSuccessMockDb } from '../helpers/mock-db'

// ── Module-level mocks (hoisted before imports) ──────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-1', role: 'instructor' }),
  requireAuth:       vi.fn().mockResolvedValue({ id: 'user-2' }),
}))

vi.mock('@/modules/progress/resolve', () => ({
  resolveProgressFromSubmission:       vi.fn().mockResolvedValue(null),
  resolveProgressFromAssignment:       vi.fn().mockResolvedValue(null),
  resolveProgressFromPortfolioProject: vi.fn().mockResolvedValue(null),
  resolveGroupProgressContext:         vi.fn().mockResolvedValue([]),
}))

vi.mock('@/modules/progress/safe-recalc', () => ({
  safeRecalcProgress:      vi.fn().mockResolvedValue(undefined),
  safeRecalcProgressBatch: vi.fn().mockResolvedValue(undefined),
  buildBatchTuples:        vi.fn().mockReturnValue([]),
}))

vi.mock('@/modules/attendance/queries', () => ({
  getOrCreateGroupCourse: vi.fn().mockResolvedValue('group-course-1'),
}))

// ── Imports (after mocks are hoisted) ────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { safeRecalcProgress, safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import {
  resolveProgressFromSubmission,
  resolveProgressFromAssignment,
  resolveGroupProgressContext,
} from '@/modules/progress/resolve'
import { gradeSubmission, submitAssignment }   from '@/modules/assignments/submissions/actions'
import { recordAttendanceSession }             from '@/modules/attendance/actions'
import { enrollStudent, unenrollStudent }      from '@/modules/groups/actions'

// ── Shared fixtures ───────────────────────────────────────────────────────────

// RFC 4122 v4 UUIDs (version=4, variant=8/9/a/b) — required by Zod v4's strict uuid()
const SUBMISSION_UUID = '00000000-0000-4000-8000-000000000001'
const ASSIGNMENT_UUID = '00000000-0000-4000-8000-000000000002'
const GROUP_UUID      = '00000000-0000-4000-8000-000000000010'
const STUDENT_UUID    = '00000000-0000-4000-8000-000000000011'

const fakeTuple  = { studentId: 's1', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' }
const fakeCtx    = [{ courseId: 'c1', semesterId: 'sem1', groupId: 'g1' }]
const fakeTuples = [{ studentId: 'sid1', courseId: 'c1', semesterId: 'sem1', groupId: 'g1' }]

beforeEach(() => {
  vi.clearAllMocks()

  // Always start with a DB that returns success for everything
  vi.mocked(createServiceClient).mockReturnValue(createSuccessMockDb() as any)

  // Restore progress mock implementations cleared by clearAllMocks
  vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', role: 'instructor' } as any)
  vi.mocked(requireAuth).mockResolvedValue({ id: 'user-2' } as any)
  vi.mocked(safeRecalcProgress).mockResolvedValue(undefined)
  vi.mocked(safeRecalcProgressBatch).mockResolvedValue(undefined)
  vi.mocked(buildBatchTuples).mockReturnValue([])
  vi.mocked(resolveProgressFromSubmission).mockResolvedValue(null)
  vi.mocked(resolveProgressFromAssignment).mockResolvedValue(null)
  vi.mocked(resolveGroupProgressContext).mockResolvedValue([])
})

// ── gradeSubmission ───────────────────────────────────────────────────────────

describe('gradeSubmission', () => {
  function gradeFormData(extra?: Record<string, string>) {
    const fd = new FormData()
    fd.set('submission_id',    SUBMISSION_UUID)
    fd.set('assignment_id',    ASSIGNMENT_UUID)
    fd.set('status',           'graded')
    fd.set('portfolio_visible', '')   // required: null would fail z.string().optional()
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v)
    return fd
  }

  it('calls safeRecalcProgress with the resolved tuple', async () => {
    vi.mocked(resolveProgressFromSubmission).mockResolvedValue(fakeTuple)

    const result = await gradeSubmission(undefined, gradeFormData())

    expect(result.success).toBe(true)
    expect(resolveProgressFromSubmission).toHaveBeenCalledWith(SUBMISSION_UUID)
    expect(safeRecalcProgress).toHaveBeenCalledWith(fakeTuple, 'gradeSubmission')
  })

  it('still calls safeRecalcProgress with null when student has no group enrollment', async () => {
    vi.mocked(resolveProgressFromSubmission).mockResolvedValue(null)

    await gradeSubmission(undefined, gradeFormData())

    expect(safeRecalcProgress).toHaveBeenCalledWith(null, 'gradeSubmission')
  })
})

// ── submitAssignment ──────────────────────────────────────────────────────────

describe('submitAssignment', () => {
  function makeSubmitDb() {
    return createMockDb({
      students:    [{ data: { id: 'student-1' }, error: null }],
      assignments: [{
        data: {
          id:                   ASSIGNMENT_UUID,
          due_at:               null,
          allow_late:           false,
          resubmission_allowed: false,
          max_resubmissions:    0,
          submission_type:      'text',
        },
        error: null,
      }],
      // First call → maybeSingle existing check (no prior submission)
      // Second call → insert select single (new row)
      submissions: [
        { data: null,                    error: null },
        { data: { id: SUBMISSION_UUID }, error: null },
      ],
    })
  }

  it('calls safeRecalcProgress after a new submission', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSubmitDb() as any)
    vi.mocked(resolveProgressFromAssignment).mockResolvedValue(fakeTuple)

    const formData = new FormData()
    formData.set('assignment_id', ASSIGNMENT_UUID)
    formData.set('content', 'My answer')

    const result = await submitAssignment(undefined, formData)

    expect(result.success).toBe(true)
    expect(resolveProgressFromAssignment).toHaveBeenCalledWith('student-1', ASSIGNMENT_UUID)
    expect(safeRecalcProgress).toHaveBeenCalledWith(fakeTuple, 'submitAssignment')
  })
})

// ── recordAttendanceSession ───────────────────────────────────────────────────

describe('recordAttendanceSession', () => {
  function makeAttendanceDb() {
    return createMockDb({
      group_students:     [{ data: [{ student_id: 'sid1' }], error: null }],
      schedules:          [{ data: { id: 'schedule-1' }, error: null }],
      attendance_records: [{ data: null, error: null }],
    })
  }

  function attendanceFormData() {
    const fd = new FormData()
    fd.set('group_id',         GROUP_UUID)
    fd.set('branch_id',        '00000000-0000-0000-0000-000000000020')
    fd.set('session_date',     '2026-05-01T10:00:00Z')
    fd.set('duration_minutes', '60')
    fd.set('delivery',         'offline')
    fd.append('student_ids[]', 'sid1')
    fd.set('status_sid1',      'present')
    return fd
  }

  it('calls safeRecalcProgressBatch with group contexts after a session is recorded', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeAttendanceDb() as any)
    vi.mocked(resolveGroupProgressContext).mockResolvedValue(fakeCtx)
    vi.mocked(buildBatchTuples).mockReturnValue(fakeTuples)

    const result = await recordAttendanceSession(attendanceFormData())

    expect(result.success).toBe(true)
    expect(resolveGroupProgressContext).toHaveBeenCalledWith(GROUP_UUID)
    expect(safeRecalcProgressBatch).toHaveBeenCalled()
  })

  it('does not call safeRecalcProgressBatch when the group has no active courses', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeAttendanceDb() as any)
    vi.mocked(resolveGroupProgressContext).mockResolvedValue([])

    await recordAttendanceSession(attendanceFormData())

    expect(safeRecalcProgressBatch).not.toHaveBeenCalled()
  })
})

// ── enrollStudent ─────────────────────────────────────────────────────────────

describe('enrollStudent', () => {
  it('calls safeRecalcProgressBatch after a student is enrolled', async () => {
    vi.mocked(resolveGroupProgressContext).mockResolvedValue(fakeCtx)
    vi.mocked(buildBatchTuples).mockReturnValue(fakeTuples)

    const formData = new FormData()
    formData.set('group_id',   GROUP_UUID)
    formData.set('student_id', STUDENT_UUID)

    const result = await enrollStudent(undefined, formData)

    expect(result.success).toBe(true)
    expect(resolveGroupProgressContext).toHaveBeenCalledWith(GROUP_UUID)
    expect(safeRecalcProgressBatch).toHaveBeenCalled()
  })

  it('does not call safeRecalcProgressBatch when the group has no active courses', async () => {
    vi.mocked(resolveGroupProgressContext).mockResolvedValue([])

    const formData = new FormData()
    formData.set('group_id',   GROUP_UUID)
    formData.set('student_id', STUDENT_UUID)

    await enrollStudent(undefined, formData)

    expect(safeRecalcProgressBatch).not.toHaveBeenCalled()
  })
})

// ── unenrollStudent ───────────────────────────────────────────────────────────

describe('unenrollStudent', () => {
  it('calls safeRecalcProgressBatch after a student is unenrolled', async () => {
    vi.mocked(resolveGroupProgressContext).mockResolvedValue(fakeCtx)
    vi.mocked(buildBatchTuples).mockReturnValue(fakeTuples)

    const result = await unenrollStudent(GROUP_UUID, STUDENT_UUID)

    expect(result.success).toBe(true)
    expect(resolveGroupProgressContext).toHaveBeenCalledWith(GROUP_UUID)
    expect(safeRecalcProgressBatch).toHaveBeenCalled()
  })
})
