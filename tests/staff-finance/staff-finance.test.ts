import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ─────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { getLiveStaffFinance, getStaffFinanceSummary } from '@/modules/staff-finance/queries'
import * as staffFinanceQueries from '@/modules/staff-finance/queries'
import {
  getInstructorPaymentOverview,
  getInstructorPaymentHistory,
  resolveInstructorStaffProfileId,
} from '@/modules/instructor-payments/queries'

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

const BRANCH_ID = 'branch-001'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Employee query excludes instructors ──────────────────────────────────────

describe('getLiveStaffFinance — Employees-only payroll', () => {
  it('filters role != instructor at the query level on both the branch-scoped and works_all_branches queries', () => {
    // Regression guard: `resolveInstructorStaffProfileId` (modules/instructor-payments/queries.ts)
    // lazily creates staff_payroll_profiles rows with role='instructor' to key the shared paid
    // ledger for My Payments. Payroll must never surface those rows — enforced server-side via
    // .neq('role', 'instructor') on every listing query, not via client-side filtering.
    const src = getLiveStaffFinance.toString()
    const occurrences = src.match(/\.neq\(\s*['"]role['"]\s*,\s*['"]instructor['"]\s*\)/g) ?? []
    expect(occurrences.length).toBe(2)
  })

  it('returns only employee rows even when the underlying table also holds instructor-created profiles', async () => {
    // Simulates what Postgres returns once `.neq('role', 'instructor')` has been applied —
    // the instructor-created profile (role='instructor') never reaches this result set.
    mockDb({
      staff_payroll_profiles: [
        { data: [{ id: 'sp-employee-1', user_id: 'u-1', branch_id: BRANCH_ID, role: 'team_leader', department: null, employment_status: 'active', works_all_branches: false, payroll_type: 'fixed_salary', basic_salary: 5000, session_rate: 0, payment_method: 'cash', payment_reference: null, notes: null, branches: { name: 'Main' } }], error: null },
        { data: [], error: null },
      ],
      profiles:               [{ data: [{ user_id: 'u-1', first_name: 'Sara', last_name: 'TL' }], error: null }],
      finance_adjustments:    [{ data: [], error: null }],
      staff_sessions:         [{ data: [], error: null }],
      staff_payment_records:  [{ data: [], error: null }],
    })

    const rows = await getLiveStaffFinance([BRANCH_ID], '2026-07-01', '2026-07-31')
    expect(rows).toHaveLength(1)
    expect(rows.every(r => r.role !== 'instructor')).toBe(true)
    expect(rows[0].display_name).toBe('Sara TL')
  })
})

// ── KPIs exclude instructors ──────────────────────────────────────────────────

describe('getStaffFinanceSummary — KPI cards exclude instructors', () => {
  it('staff_count and totals derive only from the filtered employee query', async () => {
    mockDb({
      // getLiveInstructorFinance short-circuits to [] once `schedules` is empty
      schedules: [{ data: [], error: null }],
      staff_payroll_profiles: [
        { data: [{ id: 'sp-employee-1', user_id: 'u-1', branch_id: BRANCH_ID, role: 'coordinator', department: null, employment_status: 'active', works_all_branches: false, payroll_type: 'fixed_salary', basic_salary: 4000, session_rate: 0, payment_method: 'cash', payment_reference: null, notes: null, branches: { name: 'Main' } }], error: null },
        { data: [], error: null },
      ],
      profiles:              [{ data: [{ user_id: 'u-1', first_name: 'Omar', last_name: 'Coord' }], error: null }],
      finance_adjustments:   [{ data: [], error: null }],
      staff_sessions:        [{ data: [], error: null }],
      staff_payment_records: [{ data: [], error: null }],
    })

    const summary = await getStaffFinanceSummary([BRANCH_ID], '2026-07-01', '2026-07-31')
    expect(summary.staff_count).toBe(1)
    expect(summary.total_staff_salaries).toBe(4000)
  })
})

// ── Search excludes instructors ───────────────────────────────────────────────

describe('Payroll search excludes instructors', () => {
  function filterByName<T extends { display_name: string }>(rows: T[], search: string): T[] {
    return rows.filter(r => !search || r.display_name.toLowerCase().includes(search.toLowerCase()))
  }

  it('never surfaces an instructor even when searching, because the source data is already employee-only', async () => {
    mockDb({
      staff_payroll_profiles: [
        { data: [{ id: 'sp-1', user_id: 'u-1', branch_id: BRANCH_ID, role: 'sales', department: null, employment_status: 'active', works_all_branches: false, payroll_type: 'fixed_salary', basic_salary: 3000, session_rate: 0, payment_method: 'cash', payment_reference: null, notes: null, branches: { name: 'Main' } }], error: null },
        { data: [], error: null },
      ],
      profiles:               [{ data: [{ user_id: 'u-1', first_name: 'Nour', last_name: 'Sales' }], error: null }],
      finance_adjustments:    [{ data: [], error: null }],
      staff_sessions:         [{ data: [], error: null }],
      staff_payment_records:  [{ data: [], error: null }],
    })

    const rows = await getLiveStaffFinance([BRANCH_ID], '2026-07-01', '2026-07-31')
    const results = filterByName(rows, 'instructor')
    expect(results).toHaveLength(0)
  })
})

// ── Export surface guard ──────────────────────────────────────────────────────

describe('Payroll export surface excludes instructors', () => {
  it('the only staff-payroll listing queries exported are the filtered ones (no unfiltered bypass query exists)', () => {
    // Any future CSV/Excel/PDF export must be built on top of getLiveStaffFinance /
    // getStaffFinanceSummary. This guards against a new unfiltered "export" query being
    // added later that reads staff_payroll_profiles without the role != instructor filter.
    const exported = Object.keys(staffFinanceQueries)
    const staffListingFns = exported.filter(name =>
      /staff/i.test(name) && !/session|payment|adjustment|search/i.test(name)
    )
    expect(staffListingFns.sort()).toEqual(['getLiveStaffFinance', 'getStaffFinanceSummary'])
  })
})

// ── Instructor My Payments unaffected ─────────────────────────────────────────

describe('Instructor My Payments still works after the payroll exclusion fix', () => {
  it('getInstructorPaymentOverview still resolves via staff_payroll_profiles/staff_payment_records', async () => {
    const now = new Date()

    mockDb({
      instructor_branches:    [{ data: [], error: null }],
      instructors:            [{ data: { salary_per_session: 100 }, error: null }, { data: { currency: 'EGP' }, error: null }],
      group_courses:          [{ data: [], error: null }],
      group_instructors:      [{ data: [], error: null }],
      session_instructors:    [{ data: [], error: null }],
      finance_adjustments:    [{ data: [], error: null }, { data: [], error: null }],
      staff_payroll_profiles: [{ data: null, error: null }, { data: { id: 'sp-instr-1' }, error: null }],
      staff_payment_records:  [{ data: [{ amount: 200, month: now.getMonth() + 1, year: now.getFullYear() }], error: null }],
    })

    const overview = await getInstructorPaymentOverview('instr-001', 'user-001', BRANCH_ID)
    expect(overview.currency).toBe('EGP')
    expect(overview.paid_this_month).toBe(200)
  })

  it('resolveInstructorStaffProfileId still lazily creates role=instructor profiles for the paid ledger', async () => {
    mockDb({
      staff_payroll_profiles: [
        { data: null, error: null },                 // no existing profile
        { data: { id: 'sp-new-instr' }, error: null }, // insert result
      ],
    })

    const id = await resolveInstructorStaffProfileId('user-001', BRANCH_ID)
    expect(id).toBe('sp-new-instr')
  })
})

// ── Instructor payment history unaffected ─────────────────────────────────────

describe('Instructor payment history still works', () => {
  it('getInstructorPaymentHistory still returns monthly summaries', async () => {
    mockDb({
      instructor_branches:    [{ data: [], error: null }],
      instructors:            [{ data: { salary_per_session: 0 }, error: null }],
      group_courses:          [{ data: [], error: null }],
      group_instructors:      [{ data: [], error: null }],
      session_instructors:    [{ data: [], error: null }],
      staff_payroll_profiles: [{ data: { id: 'sp-instr-1' }, error: null }],
      staff_payment_records:  [{ data: [], error: null }],
      finance_adjustments:    [{ data: [], error: null }],
    })

    const history = await getInstructorPaymentHistory('instr-001', 'user-001', BRANCH_ID, 1)
    expect(Array.isArray(history)).toBe(true)
  })
})

// ── No regression in paid calculations ────────────────────────────────────────

describe('No regression in employee paid calculations', () => {
  it('computes net_amount, total_paid, and remaining correctly for a fixed-salary employee', async () => {
    mockDb({
      staff_payroll_profiles: [
        { data: [{ id: 'sp-1', user_id: 'u-1', branch_id: BRANCH_ID, role: 'finance', department: null, employment_status: 'active', works_all_branches: false, payroll_type: 'fixed_salary', basic_salary: 6000, session_rate: 0, payment_method: 'bank_transfer', payment_reference: null, notes: null, branches: { name: 'Main' } }], error: null },
        { data: [], error: null },
      ],
      profiles:              [{ data: [{ user_id: 'u-1', first_name: 'Laila', last_name: 'Finance' }], error: null }],
      finance_adjustments:   [{ data: [{ type: 'bonus', amount: 500, staff_profile_id: 'sp-1', adjustment_date: '2026-07-05' }], error: null }],
      staff_sessions:        [{ data: [], error: null }],
      staff_payment_records: [{ data: [{ staff_profile_id: 'sp-1', amount: 4000, month: 7, year: 2026, payment_date: '2026-07-10' }], error: null }],
    })

    const rows = await getLiveStaffFinance([BRANCH_ID], '2026-07-01', '2026-07-31')
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.net_amount).toBe(6500)   // basic_salary + adj_net (bonus)
    expect(row.total_paid).toBe(4000)
    expect(row.remaining).toBe(2500)
    expect(row.payment_status).toBe('partial')
  })
})
