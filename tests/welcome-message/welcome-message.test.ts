import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb, type MockResult } from '../helpers/mock-db'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

const requirePermissionMock = vi.fn()
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}))

const getStudentPortalCredentialsMock = vi.fn()
vi.mock('@/modules/students/portal-credentials', () => ({
  getStudentPortalCredentials: (...args: unknown[]) => getStudentPortalCredentialsMock(...args),
}))

const getParentPortalCredentialsMock = vi.fn()
vi.mock('@/modules/parents/portal-credentials', () => ({
  getParentPortalCredentialsForStudent: (...args: unknown[]) => getParentPortalCredentialsMock(...args),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import {
  buildWelcomeMessage,
  canSendWelcomeMessage,
  type WelcomeMessagePayload,
} from '@/modules/messages/welcome'
import {
  getWelcomeMessageStatusAction,
  sendWelcomeWhatsAppAction,
  generateMissingWelcomeCredentialsAction,
} from '@/modules/students/welcome-message'

const STUDENT_ID = 'stu-001'

const FULL_PAYLOAD: WelcomeMessagePayload = {
  parent_email:      'parent@example.com',
  parent_password:   'Parent123',
  student_email:     'ali@example.com',
  student_password:  'Ali123',
}

function studentRow() {
  return {
    users: { profiles: { first_name: 'Ali', last_name: 'Ahmed' } },
  }
}

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

function fullEligibleDb() {
  return mockDb({
    students:                 [{ data: studentRow(), error: null }],
    group_students:           [{ data: { group_id: 'grp-1' }, error: null }],
    group_courses:            [{ data: { courses: { title: 'Scratch Level 1' } }, error: null }],
    student_parent_contacts:  [{ data: { phone1: '01012345678' }, error: null }],
    welcome_message_logs:     [{ data: null, error: null }],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requirePermissionMock.mockResolvedValue({ id: 'user-tl-001', globalRole: 'team_leader' })
  getStudentPortalCredentialsMock.mockResolvedValue({
    email: 'ali@example.com', portal_password: 'Ali123', has_portal_access: true, status: 'active',
  })
  getParentPortalCredentialsMock.mockResolvedValue({
    email: 'parent@example.com', portal_password: 'Parent123', has_portal_access: true, status: 'active',
  })
})

describe('buildWelcomeMessage / URL generation', () => {
  it('TEST 1 — generates a valid wa.me URL with the encoded message', () => {
    const message = buildWelcomeMessage(FULL_PAYLOAD)
    const phone = '201012345678'
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    expect(url.startsWith('https://wa.me/201012345678?text=')).toBe(true)
    expect(url).not.toContain('\n') // encodeURIComponent must escape newlines
  })

  it('TEST 2 — message encoding round-trips (decode restores original content)', () => {
    const message = buildWelcomeMessage(FULL_PAYLOAD)
    const encoded = encodeURIComponent(message)
    const decoded = decodeURIComponent(encoded)

    expect(decoded).toBe(message)
    expect(decoded).toContain(FULL_PAYLOAD.parent_email)
    expect(decoded).toContain(FULL_PAYLOAD.parent_password)
    expect(decoded).toContain(FULL_PAYLOAD.student_email)
    expect(decoded).toContain(FULL_PAYLOAD.student_password)
    expect(decoded).toContain('https://robocodeschools.com')
    expect(decoded).not.toContain('https://portal.robocodeschool.com')
  })
})

describe('canSendWelcomeMessage — eligibility rules', () => {
  const base = {
    parentPhone:     '01012345678',
    parentEmail:     'p@example.com',
    parentPassword:  'pw1',
    studentEmail:    's@example.com',
    studentPassword: 'pw2',
  }

  it('TEST 3 — missing parent phone blocks send', () => {
    const result = canSendWelcomeMessage({ ...base, parentPhone: null })
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('Parent phone number is missing.')
  })

  it('TEST 4 — missing parent account (no email at all) blocks send, not regenerable', () => {
    const noEmail = canSendWelcomeMessage({ ...base, parentEmail: null })
    expect(noEmail.eligible).toBe(false)
    expect(noEmail.reason).toBe('Parent portal account has not been created yet.')
    expect(noEmail.canRegenerate).toBe(false)
  })

  it('TEST 4b — parent account exists but password missing: distinct message, regenerable', () => {
    // Root cause of the reported bug: an existing account (email present) with no
    // password must NOT be reported as "account has not been created yet" — that
    // message is false and blocks TLs from understanding the real, fixable issue.
    const noPassword = canSendWelcomeMessage({ ...base, parentPassword: null })
    expect(noPassword.eligible).toBe(false)
    expect(noPassword.reason).toBe('Parent portal password has not been set yet.')
    expect(noPassword.reason).not.toContain('has not been created')
    expect(noPassword.canRegenerate).toBe(true)
  })

  it('TEST 5 — missing student account (no email at all) blocks send, not regenerable', () => {
    const noEmail = canSendWelcomeMessage({ ...base, studentEmail: null })
    expect(noEmail.eligible).toBe(false)
    expect(noEmail.reason).toBe('Student portal account has not been created yet.')
    expect(noEmail.canRegenerate).toBe(false)
  })

  it('TEST 5b — student account exists but password missing: distinct message, regenerable', () => {
    const noPassword = canSendWelcomeMessage({ ...base, studentPassword: null })
    expect(noPassword.eligible).toBe(false)
    expect(noPassword.reason).toBe('Student portal password has not been set yet.')
    expect(noPassword.canRegenerate).toBe(true)
  })

  it('fully eligible input passes', () => {
    const result = canSendWelcomeMessage(base)
    expect(result.eligible).toBe(true)
    expect(result.canRegenerate).toBe(false)
  })
})

describe('sendWelcomeWhatsAppAction — permission checks', () => {
  it('TEST 9 — Team Leader is allowed', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-tl-001', globalRole: 'team_leader' })
    fullEligibleDb()

    const result = await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect('error' in result).toBe(false)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('TEST 10 — Super Admin is allowed', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-sa-001', globalRole: 'super_admin' })
    fullEligibleDb()

    const result = await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect('error' in result).toBe(false)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('TEST 11 — Instructor is forbidden (redirected)', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-inst-001', globalRole: 'instructor' })
    fullEligibleDb()

    await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect(redirect).toHaveBeenCalledTimes(1)
    expect(vi.mocked(redirect).mock.calls[0][0]).toContain('error=forbidden')
  })
})

describe('sendWelcomeWhatsAppAction — end to end', () => {
  it('TEST 7 — logs a row to welcome_message_logs on send', async () => {
    const db = fullEligibleDb()
    const result = await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.url).toContain('https://wa.me/201012345678?text=')
      expect(result.phone).toBe('201012345678')
    }

    // welcome_message_logs is the 5th table touched — verify insert was invoked
    expect(db.from).toHaveBeenCalledWith('welcome_message_logs')
  })

  it('TEST 8 — resend works (no restriction on sending twice)', async () => {
    fullEligibleDb()
    const first = await sendWelcomeWhatsAppAction(STUDENT_ID)

    fullEligibleDb()
    const second = await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect('error' in first).toBe(false)
    expect('error' in second).toBe(false)
  })

  it('blocks send server-side when parent phone is missing, even if called directly', async () => {
    mockDb({
      students:                [{ data: studentRow(), error: null }],
      group_students:          [{ data: { group_id: 'grp-1' }, error: null }],
      group_courses:           [{ data: { courses: { title: 'Scratch Level 1' } }, error: null }],
      student_parent_contacts: [{ data: null, error: null }],
    })

    const result = await sendWelcomeWhatsAppAction(STUDENT_ID)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('Parent phone number is missing.')
    }
  })
})

describe('getWelcomeMessageStatusAction', () => {
  it('reports ineligible with a reason and the last-sent timestamp', async () => {
    mockDb({
      students:                [{ data: studentRow(), error: null }],
      group_students:          [{ data: { group_id: 'grp-1' }, error: null }],
      group_courses:           [{ data: { courses: { title: 'Scratch Level 1' } }, error: null }],
      student_parent_contacts: [{ data: { phone1: '01012345678' }, error: null }],
      welcome_message_logs:    [{ data: { sent_at: '2026-07-01T10:00:00.000Z' }, error: null }],
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: null, portal_password: null, has_portal_access: false, status: 'no_account',
    })

    const status = await getWelcomeMessageStatusAction(STUDENT_ID)

    expect(status.eligibility.eligible).toBe(false)
    expect(status.eligibility.reason).toBe('Parent portal account has not been created yet.')
    expect(status.lastSentAt).toBe('2026-07-01T10:00:00.000Z')
  })

  it('TEST 12 — historical account (email exists, password_missing) surfaces regenerable reason, not "not created"', () => {
    mockDb({
      students:                [{ data: studentRow(), error: null }],
      group_students:          [{ data: { group_id: 'grp-1' }, error: null }],
      group_courses:           [{ data: { courses: { title: 'Scratch Level 1' } }, error: null }],
      student_parent_contacts: [{ data: { phone1: '01012345678' }, error: null }],
      welcome_message_logs:    [{ data: null, error: null }],
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: null, has_portal_access: true, status: 'password_missing',
    })

    return getWelcomeMessageStatusAction(STUDENT_ID).then(status => {
      expect(status.eligibility.eligible).toBe(false)
      expect(status.eligibility.reason).toBe('Parent portal password has not been set yet.')
      expect(status.eligibility.canRegenerate).toBe(true)
    })
  })
})

describe('generateMissingWelcomeCredentialsAction — historical record repair', () => {
  function withAuthAdmin(db: ReturnType<typeof createMockDb>, updateResult: MockResult = { data: {}, error: null }) {
    ;(db as any).auth = { admin: { updateUserById: vi.fn().mockResolvedValue(updateResult) } }
    return db
  }

  it('TEST 13 — regenerates the student password when student status is password_missing', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-tl-001', globalRole: 'team_leader' })
    getStudentPortalCredentialsMock.mockResolvedValue({
      email: 'ali@example.com', portal_password: null, has_portal_access: true, status: 'password_missing',
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: 'Parent123', has_portal_access: true, status: 'active',
    })
    const db = withAuthAdmin(mockDb({
      students: [{ data: { user_id: 'auth-student-1' }, error: null }],
    }))

    const result = await generateMissingWelcomeCredentialsAction(STUDENT_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.studentRegenerated).toBe(true)
      expect(result.data.parentRegenerated).toBe(false)
    }
    expect((db as any).auth.admin.updateUserById).toHaveBeenCalledWith('auth-student-1', { password: expect.any(String) })
  })

  it('TEST 14 — regenerates the parent password when parent status is password_missing', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-tl-001', globalRole: 'team_leader' })
    getStudentPortalCredentialsMock.mockResolvedValue({
      email: 'ali@example.com', portal_password: 'Ali123', has_portal_access: true, status: 'active',
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: null, has_portal_access: true, status: 'password_missing',
    })
    const db = withAuthAdmin(mockDb({
      parent_students: [{ data: [{ parents: { id: 'parent-1', user_id: 'auth-parent-1' } }], error: null }],
    }))

    const result = await generateMissingWelcomeCredentialsAction(STUDENT_ID)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parentRegenerated).toBe(true)
      expect(result.data.studentRegenerated).toBe(false)
    }
    expect((db as any).auth.admin.updateUserById).toHaveBeenCalledWith('auth-parent-1', { password: expect.any(String) })
  })

  it('TEST 15 — no-op with an error when nothing is actually missing a password', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-tl-001', globalRole: 'team_leader' })
    getStudentPortalCredentialsMock.mockResolvedValue({
      email: 'ali@example.com', portal_password: 'Ali123', has_portal_access: true, status: 'active',
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: 'Parent123', has_portal_access: true, status: 'active',
    })
    withAuthAdmin(mockDb({}))

    const result = await generateMissingWelcomeCredentialsAction(STUDENT_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('No missing passwords could be regenerated for this student.')
    }
  })

  it('TEST 16 — instructor is forbidden from regenerating credentials (redirected)', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-inst-001', globalRole: 'instructor' })
    getStudentPortalCredentialsMock.mockResolvedValue({
      email: 'ali@example.com', portal_password: null, has_portal_access: true, status: 'password_missing',
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: 'Parent123', has_portal_access: true, status: 'active',
    })
    withAuthAdmin(mockDb({
      students: [{ data: { user_id: 'auth-student-1' }, error: null }],
    }))

    await generateMissingWelcomeCredentialsAction(STUDENT_ID)

    expect(redirect).toHaveBeenCalledTimes(1)
    expect(vi.mocked(redirect).mock.calls[0][0]).toContain('error=forbidden')
  })

  it('TEST 17 — Super Admin is allowed to regenerate credentials', async () => {
    requirePermissionMock.mockResolvedValue({ id: 'user-sa-001', globalRole: 'super_admin' })
    getStudentPortalCredentialsMock.mockResolvedValue({
      email: 'ali@example.com', portal_password: null, has_portal_access: true, status: 'password_missing',
    })
    getParentPortalCredentialsMock.mockResolvedValue({
      email: 'parent@example.com', portal_password: 'Parent123', has_portal_access: true, status: 'active',
    })
    const db = withAuthAdmin(mockDb({
      students: [{ data: { user_id: 'auth-student-1' }, error: null }],
    }))

    const result = await generateMissingWelcomeCredentialsAction(STUDENT_ID)

    expect(result.success).toBe(true)
    expect(redirect).not.toHaveBeenCalled()
    expect((db as any).auth.admin.updateUserById).toHaveBeenCalled()
  })
})
