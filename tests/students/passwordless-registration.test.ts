import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createStudent } from '@/modules/students/actions'
import { createStudentModal } from '@/modules/students/modal-actions'
import { createServiceClient } from '@/lib/supabase/service'
import { convertLeadToStudent } from '@/modules/leads/actions'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn(async () => ({ id: 'actor', globalRole: 'super_admin', branchIds: [], permissions: ['manage_students'] })), requirePortalRole: vi.fn(async () => ({ id: 'actor', globalRole: 'super_admin', branchIds: [] })), isBranchAccessible: () => true }))
vi.mock('@/lib/generate-login-email', () => ({ generateUniqueLoginEmail: vi.fn(async () => 'test.student@example.com'), makeEmailLocalPartExists: vi.fn() }))
vi.mock('@/modules/parents/registration', () => ({ prepareRegistrationContacts: vi.fn(async () => []), saveRegistrationContacts: vi.fn(async () => undefined) }))
const branch = '00000000-0000-4000-8000-000000000001'
beforeEach(() => vi.clearAllMocks())
describe('student registration no longer asks for passwords', () => {
  it.each([['standard', createStudent], ['modal', createStudentModal], ['lead conversion', convertLeadToStudent]] as const)('registers through %s without a supplied password', async (_label, action) => {
    const db = createMockDb({ students: [{ data: { id: 'new-student' }, error: null }], leads: [{ data: { phone: '01000000001', branch_id: branch }, error: null }] })
    db.rpc.mockResolvedValue({ data: [], error: null })
    const createUser = vi.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null }))
    vi.mocked(createServiceClient).mockReturnValue({ ...db, auth: { admin: { createUser } } } as unknown as ReturnType<typeof createServiceClient>)
    const fd = new FormData()
    for (const [key, value] of Object.entries({ first_name: 'Test', last_name: 'Child', phone: '01000000001', age: '10', branch_id: branch, lead_id: '00000000-0000-4000-8000-000000000003', parent_first: 'Test', parent_last: 'Guardian', parent_phone: '01000000001', parent_contacts_json: JSON.stringify([{ name: 'Test Guardian', phone1: '01000000001' }]) })) fd.set(key, value)
    await action(null, fd)
    expect(createUser).toHaveBeenCalledExactlyOnceWith({ email: 'test.student@example.com', email_confirm: true })
  })
})
