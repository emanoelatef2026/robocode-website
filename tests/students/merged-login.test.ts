import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from '@/modules/rbac/guards'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/lms-session', () => ({ getSessionCookie: mocks.session }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ sub: 'old-user', role: 'student', email: 'student@example.com', branchIds: ['branch'], permissions: [] })
  mocks.rpc.mockResolvedValue({ data: 'canonical-user', error: null })
})
describe('merged student logins', () => {
  it('resolves an existing student session to the surviving identity', async () => {
    expect((await getCurrentUser())?.id).toBe('canonical-user')
    expect(mocks.rpc).toHaveBeenCalledWith('resolve_merged_student_login', { p_user_id: 'old-user' })
  })
  it('keeps a normal student principal when no alias exists', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect((await getCurrentUser())?.id).toBe('old-user')
  })
  it('never remaps staff or parent sessions', async () => {
    for (const role of ['super_admin','team_leader','parent']) {
      mocks.session.mockResolvedValue({ sub: 'staff-user', role, branchIds: [], permissions: [] })
      expect((await getCurrentUser())?.id).toBe('staff-user')
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('does not fall back to an archived identity if alias resolution fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable' } })
    await expect(getCurrentUser()).rejects.toThrow('Could not resolve student account')
  })
})
