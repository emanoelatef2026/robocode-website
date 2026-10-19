import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { changeParticipation, openSharedSession, reviewParticipation } from '@/modules/instructor-portal/shared-actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn() }))
vi.mock('@/modules/instructor-portal/queries', () => ({ getInstructorByUserId: vi.fn().mockResolvedValue({ id: 'instructor' }) }))
const id = 'a0000000-0000-4000-8000-000000000001'
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requirePermission).mockResolvedValue({ id: 'actor', globalRole: 'instructor' } as never) })
function db() { const d = createMockDb({}); vi.mocked(createServiceClient).mockReturnValue(d as never); return d }
describe('shared participation actions', () => {
  it('uses the authenticated instructor identity, never client-supplied actor IDs', async () => {
    const d = db(); d.rpc.mockResolvedValue({ data: { sessionId: id, groupId: id, state: 'confirmed' }, error: null })
    expect((await changeParticipation(id, 'confirm')).success).toBe(true)
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith('record_session_participation', { p_actor: 'actor', p_instructor: 'instructor', p_session: id, p_mode: 'confirm', p_reason: null })
  })
  it('passes expected class identities so stale clients cannot create the next class', async () => {
    const d = db(); d.rpc.mockResolvedValue({ data: { sessionId: id, groupId: id }, error: null })
    await openSharedSession(id, id, null, 'Loops')
    expect(d.rpc).toHaveBeenCalledWith('open_shared_instructor_session', expect.objectContaining({ p_expected_session: id, p_expected_previous: null }))
  })
  it('denies instructor self-approval even if a stale token contains the management permission', async () => {
    const d = db()
    expect((await reviewParticipation(id, id, true)).success).toBe(false)
    expect(d.rpc).not.toHaveBeenCalled()
  })
  it('admin approvals still go through a server-side role/branch checked RPC', async () => {
    vi.mocked(requirePermission).mockResolvedValue({ id: 'actor', globalRole: 'team_leader' } as never)
    const d = db(); d.rpc.mockResolvedValue({ data: { sessionId: id, groupId: id }, error: null })
    expect((await reviewParticipation(id, id, true)).success).toBe(true)
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith('review_session_participation', { p_actor: 'actor', p_session: id, p_instructor: id, p_approve: true })
  })
  it('hides unexpected database errors and does not claim success', async () => {
    const d = db(); d.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'Private internal detail' } })
    const result = await changeParticipation(id, 'confirm')
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain('Private internal detail')
  })
})
