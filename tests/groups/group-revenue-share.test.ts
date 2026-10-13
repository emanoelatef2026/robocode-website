import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGroupModal, updateGroupModal } from '@/modules/groups/actions/group-crud'
import { createSchema } from '@/modules/groups/actions/validators'

const mocks = vi.hoisted(() => ({
  role: 'super_admin',
  insert: vi.fn(),
  update: vi.fn(),
  failFirstWrite: false,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn(async () => ({ id: 'admin', globalRole: mocks.role, branchIds: [] })),
  isBranchAccessible: vi.fn(() => true),
}))
vi.mock('@/modules/groups/actions/db-ops', () => ({
  applyStudentChanges: vi.fn(), assignCourseAndInstructor: vi.fn(), updateGroupCoursePlan: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: () => {
      let wrote = false
      const result = () => ({
        data: { id: '11111111-1111-4111-8111-111111111111', branch_id: '22222222-2222-4222-8222-222222222222', status: 'active' },
        error: wrote && mocks.failFirstWrite ? (mocks.failFirstWrite = false, { message: 'Optional column missing' }) : null,
      })
      const chain = {
        select: () => chain,
        eq: () => chain,
        insert: (payload: unknown) => { mocks.insert(payload); wrote = true; return chain },
        update: (payload: unknown) => { mocks.update(payload); wrote = true; return chain },
        single: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return chain
    },
  }),
}))

function form(share?: string) {
  const data = new FormData()
  data.set('id', '11111111-1111-4111-8111-111111111111')
  data.set('branch_id', '22222222-2222-4222-8222-222222222222')
  data.set('name', 'Partnership group')
  data.set('type', 'class')
  data.set('status', 'active')
  if (share !== undefined) data.set('robocode_share_percent', share)
  return data
}

beforeEach(() => { vi.clearAllMocks(); mocks.role = 'super_admin'; mocks.failFirstWrite = false })

describe('Super Admin group revenue share', () => {
  it.each(['0', '37.5', '100'])('saves %s percent when creating and editing', async share => {
    expect((await createGroupModal(null, form(share))).success).toBe(true)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ robocode_share_percent: Number(share) }))
    expect((await updateGroupModal(null, form(share))).success).toBe(true)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ robocode_share_percent: Number(share) }))
  })

  it('does not treat an omitted share as zero', async () => {
    expect(createSchema.parse(Object.fromEntries(form())).robocode_share_percent).toBeUndefined()
    await createGroupModal(null, form())
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ robocode_share_percent: 100 }))
    await updateGroupModal(null, form())
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('robocode_share_percent')
  })

  it('ignores forged Team Leader share changes and preserves the existing share on edit', async () => {
    mocks.role = 'team_leader'
    await createGroupModal(null, form('25'))
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ robocode_share_percent: 100 }))
    await updateGroupModal(null, form('25'))
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('robocode_share_percent')
  })

  it('preserves the share when retrying without optional columns', async () => {
    mocks.failFirstWrite = true
    expect((await createGroupModal(null, form('45.25'))).success).toBe(true)
    expect(mocks.insert.mock.calls).toHaveLength(2)
    expect(mocks.insert.mock.calls[1][0]).toHaveProperty('robocode_share_percent', 45.25)
    mocks.failFirstWrite = true
    expect((await updateGroupModal(null, form('45.25'))).success).toBe(true)
    expect(mocks.update.mock.calls).toHaveLength(2)
    expect(mocks.update.mock.calls[1][0]).toHaveProperty('robocode_share_percent', 45.25)
  })
})
