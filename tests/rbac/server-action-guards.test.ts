import { describe, it, expect, vi, beforeEach } from 'vitest'

// Sprint S0 — regression tests proving the 6 previously-zero-guard Server Action
// files now call an RBAC guard before touching the database, and that the TL
// cross-branch grading gap is closed. We mock modules/rbac/guards directly
// (rather than relying on next/navigation's globally-stubbed no-op `redirect`)
// so a rejected/forbidden guard can be asserted to short-circuit the action
// before any query runs.

vi.mock('@/modules/rbac/guards', () => ({
  requireAuth:       vi.fn(),
  requirePermission:  vi.fn(),
  requirePortalRole: vi.fn(),
  isBranchAccessible: vi.fn(),
  getCurrentUser:     vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/finance/queries', () => ({
  getGroupPnLRows: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/modules/progress/resolve', () => ({
  resolveProgressFromSubmission: vi.fn().mockResolvedValue(null),
  resolveProgressFromAssignment: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/modules/progress/safe-recalc', () => ({ safeRecalcProgress: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/gamification/xp-service', () => ({ awardXP: vi.fn(), XP_AWARDS: {} }))
vi.mock('@/modules/gamification/achievement-service', () => ({ checkAndUnlockAchievements: vi.fn() }))
vi.mock('@/modules/gamification/badge-service', () => ({ checkAndAwardBadges: vi.fn() }))

import { requireAuth, requirePermission, requirePortalRole, isBranchAccessible } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'

function makeChain(result: any) {
  const c: any = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'not', 'or', 'order', 'limit', 'filter']
  for (const m of methods) c[m] = (..._: any[]) => c
  c.single      = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then        = (r: any) => Promise.resolve(result).then(r)
  return c
}

const FORBIDDEN = new Error('redirect: forbidden')

// Valid v4-shaped UUIDs — zod's .uuid() rejects the nil UUID (version nibble 0).
const SUBMISSION_ID = '11111111-1111-4111-8111-111111111111'
const ASSIGNMENT_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getStudentAttendanceHistoryAction', () => {
  it('calls requirePermission(manage_attendance) before querying', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockRejectedValue(FORBIDDEN)
    const db: any = { from: vi.fn(() => makeChain({ data: [], error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { getStudentAttendanceHistoryAction } = await import('@/modules/groups/actions/attendance')
    await expect(getStudentAttendanceHistoryAction('student-1')).rejects.toThrow()
    expect(requirePermission).toHaveBeenCalledWith('manage_attendance')
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('getGroupDetailDataAction', () => {
  it('rejects when the caller cannot access the group branch', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', globalRole: 'team_leader', branchIds: ['branch-a'] })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'groups') return makeChain({ data: { branch_id: 'branch-b' }, error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { getGroupDetailDataAction } = await import('@/modules/groups/actions/detail')
    const result = await getGroupDetailDataAction('group-1')

    expect(requirePermission).toHaveBeenCalledWith('manage_groups')
    expect(result).toEqual({ sessions: [], students: [] })
    // Only the branch-check lookup ran, not the full roster query
    expect(db.from).toHaveBeenCalledWith('groups')
    expect(db.from).not.toHaveBeenCalledWith('group_students')
  })
})

describe('fetchGroupsExportData', () => {
  it('drops caller-supplied branchIds/groupIds the user is not authorized for', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', globalRole: 'team_leader', branchIds: ['branch-a'] })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockImplementation((_user, branchId) => branchId === 'branch-a')

    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'groups') {
          // group-1 belongs to the unauthorized branch — must be dropped
          return makeChain({ data: [{ id: 'group-1', branch_id: 'branch-b' }], error: null })
        }
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { fetchGroupsExportData } = await import('@/modules/groups/export/queries')
    const result = await fetchGroupsExportData(['group-1'], ['branch-a', 'branch-b'])

    expect(requirePermission).toHaveBeenCalledWith('manage_groups')
    expect(isBranchAccessible).toHaveBeenCalledWith(expect.anything(), 'branch-b')
    // group-1's branch (branch-b) was not authorized, so no students/groups query ran
    expect(result).toEqual({ pnlRows: [], students: [] })
    expect(db.from).not.toHaveBeenCalledWith('group_students')
  })
})

describe('getStudentGroupHistory', () => {
  it('calls requirePermission(manage_students) before querying', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockRejectedValue(FORBIDDEN)
    const db: any = { from: vi.fn(() => makeChain({ data: [], error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { getStudentGroupHistory } = await import('@/modules/students/group-history')
    await expect(getStudentGroupHistory('student-1')).rejects.toThrow()
    expect(requirePermission).toHaveBeenCalledWith('manage_students')
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('calculateStudentProgress', () => {
  it('calls requireAuth before touching student_course_progress', async () => {
    ;(requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(FORBIDDEN)
    const db: any = { from: vi.fn(() => makeChain({ data: [], error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { calculateStudentProgress } = await import('@/modules/progress/actions')
    await expect(calculateStudentProgress('s1', 'c1', 'sem1', 'g1')).rejects.toThrow()
    expect(requireAuth).toHaveBeenCalled()
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('tasks actions', () => {
  it('updateTask rejects when the task belongs to an inaccessible branch', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', globalRole: 'team_leader', branchIds: ['branch-a'] })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const db: any = { from: vi.fn(() => makeChain({ data: { branch_id: 'branch-b' }, error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { updateTask } = await import('@/modules/tasks/actions')
    await expect(updateTask('task-1', { status: 'COMPLETED' } as any)).rejects.toThrow('No access to this task.')
    expect(requirePermission).toHaveBeenCalledWith('manage_students')
  })

  it('dismissTask rejects when the task belongs to an inaccessible branch', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', globalRole: 'team_leader', branchIds: ['branch-a'] })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const db: any = { from: vi.fn(() => makeChain({ data: { branch_id: 'branch-b' }, error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { dismissTask } = await import('@/modules/tasks/actions')
    await expect(dismissTask('task-1')).rejects.toThrow('No access to this task.')
    expect(requirePermission).toHaveBeenCalledWith('manage_students')
  })

  it('bulkCreateTasks calls requirePermission(manage_students) before inserting', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockRejectedValue(FORBIDDEN)
    const db: any = { from: vi.fn(() => makeChain({ data: null, error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { bulkCreateTasks } = await import('@/modules/tasks/actions')
    await expect(bulkCreateTasks([{ type: 'FOLLOW_UP' } as any])).rejects.toThrow()
    expect(db.from).not.toHaveBeenCalled()
  })
})

describe('submitAssignment', () => {
  it('uses requirePortalRole(student), not the weaker requireAuth', async () => {
    ;(requirePortalRole as ReturnType<typeof vi.fn>).mockRejectedValue(FORBIDDEN)
    const db: any = { from: vi.fn(() => makeChain({ data: null, error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { submitAssignment } = await import('@/modules/assignments/submissions/actions')
    const fd = new FormData()
    fd.set('assignment_id', ASSIGNMENT_ID)

    await expect(submitAssignment(undefined, fd)).rejects.toThrow()
    expect(requirePortalRole).toHaveBeenCalledWith('student')
    expect(requireAuth).not.toHaveBeenCalled()
  })
})

describe('gradeSubmission — team_leader branch scoping', () => {
  it('forbids a team_leader grading a submission outside their branch', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'tl-1', globalRole: 'team_leader', branchIds: ['branch-a'],
    })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'submissions') return makeChain({ data: { student_id: 'student-1' }, error: null })
        if (table === 'group_students') {
          return makeChain({ data: { groups: { branch_id: 'branch-b' } }, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { gradeSubmission } = await import('@/modules/assignments/submissions/actions')
    const fd = new FormData()
    fd.set('submission_id', SUBMISSION_ID)
    fd.set('assignment_id', ASSIGNMENT_ID)
    fd.set('status', 'graded')
    fd.set('portfolio_visible', 'false')

    const result = await gradeSubmission(undefined, fd)

    expect(result).toEqual({ success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } })
    expect(isBranchAccessible).toHaveBeenCalledWith(expect.anything(), 'branch-b')
  })

  it('allows a team_leader to grade a submission inside their branch', async () => {
    ;(requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'tl-1', globalRole: 'team_leader', branchIds: ['branch-a'],
    })
    ;(isBranchAccessible as ReturnType<typeof vi.fn>).mockReturnValue(true)

    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'submissions') return makeChain({ data: { student_id: 'student-1', status: 'submitted' }, error: null })
        if (table === 'group_students') {
          return makeChain({ data: { groups: { branch_id: 'branch-a' } }, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const { gradeSubmission } = await import('@/modules/assignments/submissions/actions')
    const fd = new FormData()
    fd.set('submission_id', SUBMISSION_ID)
    fd.set('assignment_id', ASSIGNMENT_ID)
    fd.set('status', 'under_review')
    fd.set('portfolio_visible', 'false')

    const result = await gradeSubmission(undefined, fd)
    expect(result.success).toBe(true)
  })
})
