import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ─────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const requireAuthMock = vi.fn()
vi.mock('@/modules/rbac/guards', () => ({
  requireAuth: (...args: any[]) => requireAuthMock(...args),
}))

const getInstructorByUserIdMock = vi.fn()
vi.mock('@/modules/instructor-portal/queries', () => ({
  getInstructorByUserId: (...args: any[]) => getInstructorByUserIdMock(...args),
}))

vi.mock('@/modules/notifications/actions', () => ({
  seedPayoutRequestSubmittedNotification: vi.fn().mockResolvedValue(undefined),
  seedPayoutRequestDecidedNotification:   vi.fn().mockResolvedValue(undefined),
}))

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  isValidVodafoneCash, isValidInstapayLink, isPaymentInfoComplete,
  type InstructorPaymentMethods,
} from '@/modules/instructor-payments/types'
import { applySessionEarningFilters, getInstructorPaymentOverview } from '@/modules/instructor-payments/queries'
import type { InstructorSessionEarning } from '@/modules/instructor-payments/types'
import {
  decidePayoutRequestAction, markPayoutRequestPaidAction,
  getInstructorPaymentMethodsAction, listInstructorPayoutRequestsForModalAction,
  updateMyPaymentMethodsAction, requestPayoutAction,
} from '@/modules/instructor-payments/actions'

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

const INSTRUCTOR_ID = 'instr-001'
const USER_ID       = 'user-001'
const BRANCH_ID     = 'branch-001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Pure validation helpers ──────────────────────────────────────────────────

describe('Payment method validation', () => {
  it('accepts exactly 11 digits for Vodafone Cash', () => {
    expect(isValidVodafoneCash('01012345678')).toBe(true)
    expect(isValidVodafoneCash('0101234567')).toBe(false)   // 10 digits
    expect(isValidVodafoneCash('010123456789')).toBe(false) // 12 digits
    expect(isValidVodafoneCash('0101234567a')).toBe(false)  // non-numeric
  })

  it('accepts only valid http(s) URLs for Instapay links', () => {
    expect(isValidInstapayLink('https://ipn.eg/S/example/instapay/abc')).toBe(true)
    expect(isValidInstapayLink('http://example.com')).toBe(true)
    expect(isValidInstapayLink('not-a-url')).toBe(false)
    expect(isValidInstapayLink('ftp://example.com')).toBe(false)
  })

  it('derives payment-info completeness per preferred method', () => {
    const base: InstructorPaymentMethods = {
      instructor_id: INSTRUCTOR_ID,
      payment_method: null,
      wallet_number: null,
      instapay_number: null,
      payment_link: null,
      bank_account_number: null,
    }
    expect(isPaymentInfoComplete(base)).toBe(false)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'cash' })).toBe(true)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'vodafone_cash' })).toBe(false)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'vodafone_cash', wallet_number: '01012345678' })).toBe(true)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'instapay' })).toBe(false)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'instapay', instapay_number: '01012345678' })).toBe(true)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'bank_transfer', bank_account_number: 'EG123' })).toBe(true)
  })
})

// ── Session breakdown filtering (pure) ───────────────────────────────────────

describe('applySessionEarningFilters', () => {
  const rows: InstructorSessionEarning[] = [
    { schedule_id: 's1', scheduled_at: '2026-06-05T10:00:00Z', session_type: 'primary', group_id: 'g1', group_name: 'G1', topic: null, amount: 100, status: 'completed' },
    { schedule_id: 's2', scheduled_at: '2026-06-10T10:00:00Z', session_type: 'trial',   group_id: null, group_name: '—', topic: null, amount: 50,  status: 'completed' },
    { schedule_id: 's3', scheduled_at: '2026-07-01T10:00:00Z', session_type: 'makeup',  group_id: null, group_name: '—', topic: null, amount: 75,  status: 'scheduled' },
    { schedule_id: 's4', scheduled_at: '2026-07-15T10:00:00Z', session_type: 'primary', group_id: 'g1', group_name: 'G1', topic: null, amount: 100, status: 'cancelled' },
  ]

  it('filters by month + year', () => {
    const out = applySessionEarningFilters(rows, { month: 6, year: 2026 })
    expect(out.map(r => r.schedule_id)).toEqual(['s1', 's2'])
  })

  it('filters by session type', () => {
    const out = applySessionEarningFilters(rows, { sessionType: 'trial' })
    expect(out.map(r => r.schedule_id)).toEqual(['s2'])
  })

  it('filters by status', () => {
    const out = applySessionEarningFilters(rows, { status: 'cancelled' })
    expect(out.map(r => r.schedule_id)).toEqual(['s4'])
  })

  it('filters by explicit date range', () => {
    const out = applySessionEarningFilters(rows, { from: '2026-07-01', to: '2026-07-31' })
    expect(out.map(r => r.schedule_id).sort()).toEqual(['s3', 's4'])
  })

  it('returns all rows when no filters are set', () => {
    expect(applySessionEarningFilters(rows, {})).toHaveLength(4)
  })
})

// ── Permissions ───────────────────────────────────────────────────────────────

describe('Permissions', () => {
  it('decidePayoutRequestAction rejects a caller without payroll access', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    const res = await decidePayoutRequestAction('req-1', 'approved')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
  })

  it('markPayoutRequestPaidAction rejects a caller without payroll access', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    const res = await markPayoutRequestPaidAction('req-1', 'cash')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
  })

  it('getInstructorPaymentMethodsAction rejects a caller without payroll access', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    const res = await getInstructorPaymentMethodsAction(INSTRUCTOR_ID)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
  })

  it('listInstructorPayoutRequestsForModalAction rejects a caller without payroll access', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    const res = await listInstructorPayoutRequestsForModalAction([BRANCH_ID])
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
  })

  it('decidePayoutRequestAction succeeds through the guard for a user with manage_payroll', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: ['manage_payroll'] })
    mockDb({
      instructor_payout_requests: [
        { data: { id: 'req-1', instructor_id: INSTRUCTOR_ID, requested_amount: 500, status: 'pending' }, error: null },
        { data: null, error: null }, // update
      ],
      instructors: [{ data: { user_id: USER_ID }, error: null }],
    })
    const res = await decidePayoutRequestAction('req-1', 'approved')
    expect(res.success).toBe(true)
  })

  it('updateMyPaymentMethodsAction rejects a caller with no instructor record', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue(null)
    const res = await updateMyPaymentMethodsAction({ payment_method: 'cash' })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND')
  })
})

// ── Payout requests ───────────────────────────────────────────────────────────

describe('requestPayoutAction', () => {
  it('rejects when there is no outstanding balance', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue({
      id: INSTRUCTOR_ID, user_id: USER_ID, branch_id: BRANCH_ID,
      email: 'i@x.com', first_name: 'Test', last_name: 'Instructor',
    })

    mockDb({
      instructor_payout_requests: [{ data: null, error: null }], // getOpenPayoutRequest → none
      instructor_branches:        [{ data: [], error: null }],
      instructors:                [{ data: { salary_per_session: 0 }, error: null }, { data: { currency: 'EGP' }, error: null }],
      group_courses:               [{ data: [], error: null }],
      group_instructors:           [{ data: [], error: null }],
      session_instructors:         [{ data: [], error: null }],
      finance_adjustments:         [{ data: [], error: null }, { data: [], error: null }],
      staff_payroll_profiles:      [{ data: null, error: null }, { data: { id: 'sp-1' }, error: null }],
      staff_payment_records:       [{ data: [], error: null }],
    })

    const res = await requestPayoutAction()
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('INVALID')
  })

  it('rejects when an open payout request already exists', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue({
      id: INSTRUCTOR_ID, user_id: USER_ID, branch_id: BRANCH_ID,
      email: 'i@x.com', first_name: 'Test', last_name: 'Instructor',
    })

    mockDb({
      instructor_payout_requests: [
        { data: { id: 'req-existing', instructor_id: INSTRUCTOR_ID, status: 'pending' }, error: null },
      ],
    })

    const res = await requestPayoutAction()
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('CONFLICT')
  })
})

// ── Overview calculations ────────────────────────────────────────────────────

describe('getInstructorPaymentOverview', () => {
  it('returns all-zero figures for an instructor with no sessions, adjustments, or payments', async () => {
    mockDb({
      instructor_branches:    [{ data: [], error: null }],
      instructors:            [{ data: { salary_per_session: 0 }, error: null }, { data: { currency: 'EGP' }, error: null }],
      group_courses:          [{ data: [], error: null }],
      group_instructors:      [{ data: [], error: null }],
      session_instructors:    [{ data: [], error: null }],
      finance_adjustments:    [{ data: [], error: null }, { data: [], error: null }],
      staff_payroll_profiles: [{ data: null, error: null }, { data: { id: 'sp-1' }, error: null }],
      staff_payment_records:  [{ data: [], error: null }],
      instructor_payout_requests: [{ data: null, error: null }],
    })

    const overview = await getInstructorPaymentOverview(INSTRUCTOR_ID, USER_ID, BRANCH_ID)

    expect(overview).toEqual({
      estimated_this_month: 0,
      approved_this_month:  0,
      paid_this_month:      0,
      outstanding:          0,
      lifetime_earnings:    0,
      currency:             'EGP',
      can_request_payout:   false,
    })
  })
})
