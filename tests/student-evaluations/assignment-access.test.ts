import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb, type MockResult } from '../helpers/mock-db'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn() }))
vi.mock('@/lib/timeline', () => ({ logTimelineEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/notifications/actions', () => ({ seedEvaluationPublishedNotification: vi.fn() }))
vi.mock('@/modules/notifications/queries', () => ({
  getStudentUserId: vi.fn().mockResolvedValue(null), getParentUserIdsForStudent: vi.fn().mockResolvedValue([]),
}))
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createStudentEvaluation } from '@/modules/student-evaluations/actions'

const student = '11111111-1111-4111-8111-111111111111'
const branch = '22222222-2222-4222-8222-222222222222'
const group = '33333333-3333-4333-8333-333333333333'
const course = '44444444-4444-4444-8444-444444444444'
const input = { student_id: student, group_id: group, branch_id: branch, criterion: 'PROGRAMMING', score: 85 }
const ok = (data: unknown): MockResult => ({ data, error: null })
function setup(overrides: Record<string, MockResult[]> = {}, allowed = true) {
  const db = createMockDb({
    instructors: [ok({ id: 'instructor-1' })], groups: [ok({ branch_id: branch })],
    group_students: [ok({ student_id: student })], student_evaluations: [ok({ id: 'evaluation-1' })], ...overrides,
  })
  db.rpc.mockResolvedValue({ data: allowed, error: null })
  vi.mocked(createServiceClient).mockReturnValue(db as unknown as ReturnType<typeof createServiceClient>)
  return db
}
describe('Assigned instructor legacy evaluation access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue({ id: 'teacher-1', globalRole: 'instructor', branchIds: [] } as never)
  })
  it('allows an assigned teacher without giving branch-wide access', async () => {
    const db = setup()
    expect((await createStudentEvaluation(input)).success).toBe(true)
    expect(requirePermission).toHaveBeenCalledWith('manage_evaluations')
    expect(requirePermission).not.toHaveBeenCalledWith('manage_evaluations', { branchId: branch })
    expect(db.rpc).toHaveBeenCalledWith('instructor_can_teach_group', {
      p_actor: 'teacher-1', p_instructor: 'instructor-1', p_group: group, p_permission: 'manage_evaluations',
    })
  })
  it('requires a group context for instructors', async () => {
    const db = setup()
    expect((await createStudentEvaluation({ ...input, group_id: undefined })).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('denies revoked permission or unassigned teachers', async () => {
    const db = setup({}, false)
    expect((await createStudentEvaluation(input)).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('denies students outside the assigned group', async () => {
    const db = setup({ group_students: [ok(null)] })
    expect((await createStudentEvaluation(input)).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('rejects a forged branch', async () => {
    const db = setup({ groups: [ok({ branch_id: course })] })
    expect((await createStudentEvaluation(input)).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('does not accept unrelated course or enrollment references', async () => {
    const db = setup({ group_courses: [ok(null)] })
    expect((await createStudentEvaluation({ ...input, course_id: course })).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
    const next = setup({ student_enrollments: [ok(null)] })
    expect((await createStudentEvaluation({ ...input, enrollment_id: course })).success).toBe(false)
    expect(next.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('fails closed when the permission RPC fails', async () => {
    const db = setup()
    db.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } })
    expect((await createStudentEvaluation(input)).success).toBe(false)
    expect(db.from).not.toHaveBeenCalledWith('student_evaluations')
  })
  it('preserves management branch restrictions', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ id: 'manager-1', globalRole: 'team_leader' } as never)
    const db = setup()
    expect((await createStudentEvaluation({ ...input, group_id: undefined })).success).toBe(true)
    expect(requirePermission).toHaveBeenCalledWith('manage_evaluations', { branchId: branch })
    expect(db.rpc).not.toHaveBeenCalled()
  })
})
