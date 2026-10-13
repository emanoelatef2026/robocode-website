import { beforeEach, describe, expect, it, vi } from 'vitest'
import { moveStudentsToGroupAction } from '@/modules/groups/actions/students'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), role: 'team_leader' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: async () => ({ id: 'actor', globalRole: mocks.role, branchIds: ['branch-1'] }), isBranchAccessible: vi.fn() }))
vi.mock('@/modules/groups/actions/db-ops', () => ({ applyStudentChanges: vi.fn() }))

beforeEach(() => { vi.clearAllMocks(); mocks.role = 'team_leader'; mocks.rpc.mockResolvedValue({ error: null }) })
describe('atomic student group move', () => {
  it('uses one transaction and server-derived branch scope, deduplicating students', async () => {
    expect(await moveStudentsToGroupAction('source', 'target', ['student', 'student'], 'new')).toEqual({ success: true, data: undefined })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('move_group_students_atomic', {
      p_source_group_id: 'source', p_target_group_id: 'target', p_student_ids: ['student'],
      p_contract_mode: 'new', p_allowed_branch_ids: ['branch-1'],
    })
  })
  it('passes the continue choice without creating a second financial account', async () => {
    mocks.role = 'super_admin'
    await moveStudentsToGroupAction('source', 'target', ['student'], 'continue')
    expect(mocks.rpc).toHaveBeenCalledWith('move_group_students_atomic', expect.objectContaining({ p_contract_mode: 'continue', p_allowed_branch_ids: null }))
  })
  it('returns a recoverable validation error instead of throwing a hidden production error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Destination group capacity exceeded.' } })
    expect(await moveStudentsToGroupAction('source', 'target', ['student'], 'new')).toEqual({ success: false, error: { code: 'MOVE_FAILED', message: 'Destination group capacity exceeded.' } })
    vi.restoreAllMocks()
  })
  it('does not leak unexpected database errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rpc.mockResolvedValue({ error: { code: '23505', message: 'private database details' } })
    const result = await moveStudentsToGroupAction('source', 'target', ['student'], 'new')
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain('private database details')
    vi.restoreAllMocks()
  })
  it('rejects same-group and empty requests before writing', async () => {
    expect((await moveStudentsToGroupAction('source', 'source', ['student'], 'new')).success).toBe(false)
    expect((await moveStudentsToGroupAction('source', 'target', [], 'new')).success).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
