import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { generateMissingWelcomeCredentialsAction } from '@/modules/students/welcome-message'
import { getStudentPortalCredentials } from '@/modules/students/portal-credentials'
import { getParentPortalCredentialsForStudent } from '@/modules/parents/portal-credentials'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn(async () => ({ id: 'staff-test', globalRole: 'super_admin' })), getCurrentUser: vi.fn() }))
vi.mock('@/modules/students/portal-credentials', () => ({ getStudentPortalCredentials: vi.fn() }))
vi.mock('@/modules/parents/portal-credentials', () => ({ getParentPortalCredentialsForStudent: vi.fn() }))

beforeEach(() => vi.clearAllMocks())
describe('group credential generation after passwordless registration', () => {
  it.each([true, false])('activates missing accounts without rotating an existing guardian password (parent missing: %s)', async parentMissing => {
    vi.mocked(getStudentPortalCredentials).mockResolvedValue({ email: 'test.child@example.com', portal_password: null, has_portal_access: true, status: 'password_missing' })
    vi.mocked(getParentPortalCredentialsForStudent).mockResolvedValue({ email: 'test.parent@example.com', portal_password: parentMissing ? null : 'unchanged-fixture-password', has_portal_access: true, status: parentMissing ? 'password_missing' : 'active' })
    const db = createMockDb({
      students: [{ data: { user_id: 'child-user' }, error: null }],
      parent_students: [{ data: [{ parents: { id: 'parent-test', user_id: 'parent-user' } }], error: null }],
    })
    const updateUserById = vi.fn(async () => ({ error: null }))
    vi.mocked(createServiceClient).mockReturnValue({ ...db, auth: { admin: { updateUserById } } } as unknown as ReturnType<typeof createServiceClient>)
    const result = await generateMissingWelcomeCredentialsAction('child-test')
    expect(result).toEqual({ success: true, data: { studentRegenerated: true, parentRegenerated: parentMissing } })
    expect(updateUserById).toHaveBeenCalledWith('child-user', { password: expect.any(String) })
    expect(updateUserById).toHaveBeenCalledTimes(parentMissing ? 2 : 1)
    if (parentMissing) expect(updateUserById).toHaveBeenCalledWith('parent-user', { password: expect.any(String) })
  })
})
