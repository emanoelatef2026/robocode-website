import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { removeGroupAllocationAction } from '@/modules/groups/allocation-actions'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn().mockResolvedValue({ id: 'staff-test' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createServiceClient).mockReturnValue(createMockDb({
    group_instructors: [{ data: null, error: null }],
  }) as unknown as ReturnType<typeof createServiceClient>)
})

describe('allocation editor refresh boundary', () => {
  it('does not refresh the route while an open group editor is replacing an instructor', async () => {
    const result = await removeGroupAllocationAction('group-test', 'instructor-test', { deferRefresh: true })
    expect(result.success).toBe(true)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('preserves immediate revalidation for callers outside the open editor', async () => {
    await removeGroupAllocationAction('group-test', 'instructor-test')
    expect(revalidatePath).toHaveBeenCalledWith('/portal/team-leader/groups')
  })
})
