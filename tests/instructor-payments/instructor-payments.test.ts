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

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  isValidVodafoneCash, isValidInstapayLink, isPaymentInfoComplete, validatePaymentMethodFields,
  type InstructorPaymentMethods,
} from '@/modules/instructor-payments/types'
import { applySessionEarningFilters, getInstructorPaymentOverview, getInstructorPaymentMethods } from '@/modules/instructor-payments/queries'
import type { InstructorSessionEarning } from '@/modules/instructor-payments/types'
import {
  getInstructorPaymentMethodsAction,
  updateMyPaymentMethodsAction,
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
    // Instapay requires BOTH the number AND the payment link — number alone is incomplete.
    expect(isPaymentInfoComplete({ ...base, payment_method: 'instapay', instapay_number: '01012345678' })).toBe(false)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'instapay', payment_link: 'https://ipn.eg/S/x' })).toBe(false)
    expect(isPaymentInfoComplete({
      ...base, payment_method: 'instapay',
      instapay_number: '01012345678', payment_link: 'https://ipn.eg/S/x',
    })).toBe(true)
    expect(isPaymentInfoComplete({ ...base, payment_method: 'bank_transfer', bank_account_number: 'EG123' })).toBe(true)
  })
})

// ── Shared validation used by every write path (instructor / TL / admin / payroll) ──

describe('validatePaymentMethodFields — shared write-path validation', () => {
  it('rejects Instapay with number only (no link)', () => {
    const err = validatePaymentMethodFields({ payment_method: 'instapay', instapay_number: '01012345678', payment_link: '' })
    expect(err).toMatch(/payment link is required/i)
  })

  it('rejects Instapay with link only (no number)', () => {
    const err = validatePaymentMethodFields({ payment_method: 'instapay', instapay_number: '', payment_link: 'https://ipn.eg/S/x' })
    expect(err).toMatch(/instapay number is required/i)
  })

  it('accepts Instapay when both number and link are present and link is a valid URL', () => {
    const err = validatePaymentMethodFields({
      payment_method: 'instapay', instapay_number: '01012345678', payment_link: 'https://ipn.eg/S/x',
    })
    expect(err).toBeNull()
  })

  it('rejects an Instapay link that is not a valid URL', () => {
    const err = validatePaymentMethodFields({
      payment_method: 'instapay', instapay_number: '01012345678', payment_link: 'not-a-url',
    })
    expect(err).toMatch(/valid URL/i)
  })

  it('rejects Vodafone Cash numbers that are not exactly 11 digits', () => {
    expect(validatePaymentMethodFields({ payment_method: 'vodafone_cash', wallet_number: '123' })).toMatch(/11 digits/)
    expect(validatePaymentMethodFields({ payment_method: 'vodafone_cash', wallet_number: '01012345678' })).toBeNull()
  })

  it('rejects bank transfer with no account number', () => {
    expect(validatePaymentMethodFields({ payment_method: 'bank_transfer', bank_account_number: '' })).toMatch(/bank account number/i)
    expect(validatePaymentMethodFields({ payment_method: 'bank_transfer', bank_account_number: 'EG123' })).toBeNull()
  })

  it('requires nothing extra for cash', () => {
    expect(validatePaymentMethodFields({ payment_method: 'cash' })).toBeNull()
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
  it('getInstructorPaymentMethodsAction rejects a caller without payroll access', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    const res = await getInstructorPaymentMethodsAction(INSTRUCTOR_ID)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('FORBIDDEN')
  })

  it('updateMyPaymentMethodsAction rejects a caller with no instructor record', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue(null)
    const res = await updateMyPaymentMethodsAction({ payment_method: 'cash' })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND')
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
    })

    const overview = await getInstructorPaymentOverview(INSTRUCTOR_ID, USER_ID, BRANCH_ID)

    expect(overview).toEqual({
      estimated_this_month: 0,
      approved_this_month:  0,
      paid_this_month:      0,
      outstanding:          0,
      lifetime_earnings:    0,
      currency:             'EGP',
    })
  })

  it('does not reference the removed payout-request workflow', () => {
    // No `can_request_payout` field, no instructor_payout_requests dependency —
    // guards against the field/table being reintroduced.
    expect(getInstructorPaymentOverview.toString()).not.toMatch(/instructor_payout_requests/)
    expect(getInstructorPaymentOverview.toString()).not.toMatch(/can_request_payout/)
  })
})

// ── Single source of truth: payment info read/write ──────────────────────────

describe('Single source of truth for payment info', () => {
  it('instructor self-service write updates the instructors table directly', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue({ id: INSTRUCTOR_ID, user_id: USER_ID, branch_id: BRANCH_ID })

    const db = mockDb({
      instructors: [{ data: null, error: null }], // update
    })

    const res = await updateMyPaymentMethodsAction({
      payment_method:  'vodafone_cash',
      wallet_number:   '01012345678',
    })

    expect(res.success).toBe(true)
    expect(db.from).toHaveBeenCalledWith('instructors')
  })

  it('team leader / admin read wrapper reads the same instructors-table columns instructor writes wrote', async () => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: ['manage_payroll'] })
    mockDb({
      instructors: [{
        data: {
          id: INSTRUCTOR_ID,
          payment_method: 'vodafone_cash',
          wallet_number: '01012345678',
          instapay_number: null,
          payment_link: null,
          bank_account_number: null,
        },
        error: null,
      }],
    })

    const res = await getInstructorPaymentMethodsAction(INSTRUCTOR_ID)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.payment_method).toBe('vodafone_cash')
      expect(res.data.wallet_number).toBe('01012345678')
    }
  })

  it('existing payment data preloads correctly (non-empty instructors row round-trips through getInstructorPaymentMethods)', async () => {
    mockDb({
      instructors: [{
        data: {
          id: INSTRUCTOR_ID,
          payment_method: 'bank_transfer',
          wallet_number: null,
          instapay_number: null,
          payment_link: null,
          bank_account_number: 'EG123456789',
        },
        error: null,
      }],
    })

    const methods = await getInstructorPaymentMethods(INSTRUCTOR_ID)
    expect(methods.payment_method).toBe('bank_transfer')
    expect(methods.bank_account_number).toBe('EG123456789')
    expect(isPaymentInfoComplete(methods)).toBe(true)
  })
})

// ── Instructor self-service: Instapay both-required rule ─────────────────────

describe('updateMyPaymentMethodsAction — Instapay both-required rule', () => {
  beforeEach(() => {
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: [] })
    getInstructorByUserIdMock.mockResolvedValue({ id: INSTRUCTOR_ID, user_id: USER_ID, branch_id: BRANCH_ID })
  })

  it('saves successfully when both Instapay number and link are provided', async () => {
    const db = mockDb({ instructors: [{ data: null, error: null }] })
    const res = await updateMyPaymentMethodsAction({
      payment_method:  'instapay',
      instapay_number: '01012345678',
      payment_link:    'https://ipn.eg/S/example',
    })
    expect(res.success).toBe(true)
    expect(db.from).toHaveBeenCalledWith('instructors')
  })

  it('rejects with a validation error when only the Instapay number is provided', async () => {
    const res = await updateMyPaymentMethodsAction({
      payment_method:  'instapay',
      instapay_number: '01012345678',
      payment_link:    '',
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('INVALID')
  })

  it('rejects with a validation error when only the Instapay link is provided', async () => {
    const res = await updateMyPaymentMethodsAction({
      payment_method:  'instapay',
      instapay_number: '',
      payment_link:    'https://ipn.eg/S/example',
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('INVALID')
  })
})

// ── Payroll modal (TL / admin) ────────────────────────────────────────────────

describe('Payroll modal — instructor payment write path (modules/staff-finance)', () => {
  it('updateInstructorPaymentInfoAction writes all five payment columns to the instructors table only', async () => {
    const { updateInstructorPaymentInfoAction } = await import('@/modules/staff-finance/actions')
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: ['manage_payroll'] })
    const db = mockDb({ instructors: [{ data: null, error: null }] })

    const res = await updateInstructorPaymentInfoAction({
      instructor_id:       INSTRUCTOR_ID,
      salary_per_session:  100,
      payment_method:      'instapay',
      instapay_number:     '01012345678',
      payment_link:        'https://ipn.eg/S/example',
      payment_notes:       null,
    })

    expect(res.success).toBe(true)
    // Single source of truth: the only table touched is `instructors` — no secondary table.
    expect(db.from).toHaveBeenCalledWith('instructors')
    expect(db.from).not.toHaveBeenCalledWith('instructor_payment_methods')
  })

  it('rejects Instapay with number only, from the payroll modal, the same as every other write path', async () => {
    const { updateInstructorPaymentInfoAction } = await import('@/modules/staff-finance/actions')
    requireAuthMock.mockResolvedValue({ id: USER_ID, permissions: ['manage_payroll'] })

    const res = await updateInstructorPaymentInfoAction({
      instructor_id:      INSTRUCTOR_ID,
      salary_per_session: 100,
      payment_method:     'instapay',
      instapay_number:    '01012345678',
      payment_link:       null,
      payment_notes:      null,
    })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error.code).toBe('VALIDATION')
  })

  it('getLiveInstructorFinance selects wallet_number, instapay_number, payment_link and bank_account_number together (never instapay_number alone)', async () => {
    const { getLiveInstructorFinance } = await import('@/modules/staff-finance/queries')
    const src = getLiveInstructorFinance.toString()
    expect(src).toMatch(/wallet_number/)
    expect(src).toMatch(/instapay_number/)
    expect(src).toMatch(/payment_link/)
    expect(src).toMatch(/bank_account_number/)
  })
})

// ── Payout requests removed ───────────────────────────────────────────────────

describe('Payout request functionality removal', () => {
  it('no payout-request actions are exported from instructor-payments/actions', async () => {
    const actions = await import('@/modules/instructor-payments/actions')
    expect((actions as Record<string, unknown>).requestPayoutAction).toBeUndefined()
    expect((actions as Record<string, unknown>).decidePayoutRequestAction).toBeUndefined()
    expect((actions as Record<string, unknown>).markPayoutRequestPaidAction).toBeUndefined()
    expect((actions as Record<string, unknown>).listInstructorPayoutRequestsForModalAction).toBeUndefined()
  })

  it('no payout-request queries are exported from instructor-payments/queries', async () => {
    const queries = await import('@/modules/instructor-payments/queries')
    expect((queries as Record<string, unknown>).getOpenPayoutRequest).toBeUndefined()
    expect((queries as Record<string, unknown>).listInstructorPayoutRequests).toBeUndefined()
    expect((queries as Record<string, unknown>).listPayoutRequestsForBranches).toBeUndefined()
  })

  it('no payout-request notification seeders are exported from notifications/actions', async () => {
    const notifActions = await import('@/modules/notifications/actions')
    expect((notifActions as Record<string, unknown>).seedPayoutRequestSubmittedNotification).toBeUndefined()
    expect((notifActions as Record<string, unknown>).seedPayoutRequestDecidedNotification).toBeUndefined()
  })
})
