import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createStudent } from '@/modules/students/actions'
import { createStudentModal } from '@/modules/students/modal-actions'
import { convertLeadToStudent } from '@/modules/leads/actions'
import { createServiceClient } from '@/lib/supabase/service'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn(async () => ({ id: 'actor' })), requirePortalRole: vi.fn(async () => ({ id: 'actor' })), isBranchAccessible: () => true }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/generate-login-email', () => ({ generateUniqueLoginEmail: vi.fn(async () => 'new@example.com'), makeEmailLocalPartExists: vi.fn() }))

const branch = '00000000-0000-4000-8000-000000000001'
function form() {
  const fd = new FormData()
  for (const [key,value] of Object.entries({ first_name: 'Test', last_name: 'Learner', password: 'test-password', branch_id: branch, phone: '01000000001', age: '12', parent_contacts_json: '[]', lead_id: '00000000-0000-4000-8000-000000000002', parent_first: 'Parent', parent_last: 'Name', parent_password: 'test-password', parent_phone: '01000000001' })) fd.set(key,value)
  fd.set('parent_contacts_json', JSON.stringify([{ name: 'Parent Name', relation: 'father', phone1: '01000000001', is_primary: true }]))
  return fd
}
beforeEach(() => vi.clearAllMocks())
describe('registration duplicate checks happen before account creation', () => {
  it.each([['standard', createStudent], ['modal', createStudentModal], ['lead conversion', convertLeadToStudent]] as const)('blocks duplicate %s registration without any auth writes', async (_name, action) => {
    const db = createMockDb({ leads: [{ data: { phone: '01000000001', branch_id: branch }, error: null }] })
    db.rpc.mockResolvedValue({ data: [{ id: 'existing' }], error: null })
    const createUser = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue({ ...db, auth: { admin: { createUser } } } as unknown as ReturnType<typeof createServiceClient>)
    const result = await action(null, form())
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toMatch(/already exists/)
    expect(createUser).not.toHaveBeenCalled()
  })
  it('removes only its new auth account if a concurrent request wins the identity claim', async () => {
    const db = createMockDb({ students: [{ data: null, error: { code: '23505', message: 'duplicate identity' } }] })
    db.rpc.mockResolvedValue({ data: [], error: null })
    const createUser = vi.fn(async () => ({ data: { user: { id: 'just-created' } }, error: null }))
    const deleteUser = vi.fn(async () => ({ error: null }))
    vi.mocked(createServiceClient).mockReturnValue({ ...db, auth: { admin: { createUser, deleteUser } } } as unknown as ReturnType<typeof createServiceClient>)
    const result = await createStudent(null, form())
    expect(result.success).toBe(false)
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith('just-created')
  })
})
