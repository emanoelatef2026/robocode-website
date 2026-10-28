import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { queueSessionChange, assertSessionLead } from '@/modules/instructor-portal/session-changes'
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const rpc = vi.fn()
beforeEach(() => { vi.clearAllMocks(); vi.mocked(createServiceClient).mockReturnValue({ rpc } as never) })
describe('session change boundary', () => {
  it('only allows direct writes after the database identifies the actor as lead', async () => {
    rpc.mockResolvedValue({ data: { direct: true }, error: null })
    expect(await queueSessionChange('actor', 'instructor', 'session', 'group', 'attendance', {})).toBeNull()
    expect(rpc).toHaveBeenCalledWith('stage_session_change', expect.objectContaining({ p_actor: 'actor', p_instructor: 'instructor', p_kind: 'attendance' }))
  })
  it('returns a request identity without authorizing direct writes for assistants', async () => {
    rpc.mockResolvedValue({ data: { direct: false, changeId: 'proposal' }, error: null })
    expect(await queueSessionChange('actor','instructor','session','group','homework_create',{})).toEqual({ success: true, data: { changeId: 'proposal' } })
    expect(revalidatePath).toHaveBeenCalledWith('/portal/instructor/groups/group/sessions/session')
  })
  it('fails closed when migration is missing, without exposing internal details', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Private schema details' } })
    const result = await queueSessionChange('actor','instructor','session','group','resources',{})
    expect(result?.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain('Private schema')
  })
  it('surfaces a stale proposal so the instructor can reload without overwriting attendance', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Attendance changed. Reload.' } })
    expect(await queueSessionChange('actor','instructor','session','group','attendance',{})).toMatchObject({ success: false, error: { message: 'Attendance changed. Reload.' } })
  })
  it('denies end/cancel/postpone unless the database explicitly permits the lead', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect((await assertSessionLead('actor','instructor','session','group')).success).toBe(false)
    rpc.mockResolvedValue({ data: true, error: null })
    expect((await assertSessionLead('actor','instructor','session','group')).success).toBe(true)
  })
})
