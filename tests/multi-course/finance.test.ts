import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/parents/parent-portal-queries', () => ({
  verifyParentChild: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { verifyParentChild } from '@/modules/parents/parent-portal-queries'
import { getParentChildFinance } from '@/modules/finance/queries'
import { listStudentEnrollments } from '@/modules/enrollments/queries'

function makeChain(result: any) {
  const c: any = {}
  const methods = ['select', 'eq', 'in', 'is', 'order', 'limit']
  for (const m of methods) c[m] = (..._: any[]) => c
  c.single      = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then        = (r: any) => Promise.resolve(result).then(r)
  return c
}

beforeEach(() => { vi.clearAllMocks() })

// Sprint 1 — root-cause fix: student_financial_accounts can now hold 2+ rows
// per student (one per enrollment_id), but the query layer still returned at
// most one. getParentChildFinance must return one entry per account, and
// must distinguish "denied" (null) from "genuinely no account" ([]) — the
// prior version showed the same "no account found" message for both.
describe('getParentChildFinance — multi-account', () => {
  it('returns one entry per financial account for a multi-course family', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { id: 'link-1', can_view_financials: true }, error: null })
        if (table === 'student_financial_accounts') {
          return makeChain({
            data: [
              { id: 'acc-python', student_id: 's1', enrollment_id: 'enr-python', total_amount: 1000, discount_amount: 0, net_amount: 1000, paid_amount: 1000, remaining_amount: 0, status: 'PAID', next_due_date: null },
              { id: 'acc-robotics', student_id: 's1', enrollment_id: 'enr-robotics', total_amount: 1200, discount_amount: 0, net_amount: 1200, paid_amount: 400, remaining_amount: 800, status: 'CURRENT', next_due_date: '2026-08-01' },
            ],
            error: null,
          })
        }
        if (table === 'finance_installments') return makeChain({ data: [], error: null })
        if (table === 'finance_payments') return makeChain({ data: [], error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getParentChildFinance('parent-user-1', 's1')

    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result!.map(a => a.enrollment_id).sort()).toEqual(['enr-python', 'enr-robotics'])
    const robotics = result!.find(a => a.enrollment_id === 'enr-robotics')!
    expect(robotics.account.remaining_amount).toBe(800)
  })

  it('returns null (denied) when can_view_financials is off — distinct from "no account"', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { id: 'link-1', can_view_financials: false }, error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getParentChildFinance('parent-user-1', 's1')
    expect(result).toBeNull()
  })

  it('returns [] (genuinely no account) when access is valid but no account exists', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { id: 'link-1', can_view_financials: true }, error: null })
        if (table === 'student_financial_accounts') return makeChain({ data: [], error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getParentChildFinance('parent-user-1', 's1')
    expect(result).toEqual([])
  })
})

// Sprint S0 — listStudentEnrollments had no ownership check of its own,
// safe only because its one caller happened to pre-validate the id.
describe('listStudentEnrollments — ownership check', () => {
  it('returns [] without querying enrollments when the caller is not a linked parent', async () => {
    ;(verifyParentChild as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    const db: any = { from: vi.fn(() => makeChain({ data: [], error: null })) }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await listStudentEnrollments('parent-user-1', 'student-1')
    expect(result).toEqual([])
    expect(db.from).not.toHaveBeenCalled()
  })

  it('queries enrollments when the caller is a verified linked parent', async () => {
    ;(verifyParentChild as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'student_enrollments') return makeChain({ data: [], error: null })
        if (table === 'students') return makeChain({ data: null, error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await listStudentEnrollments('parent-user-1', 'student-1')
    expect(db.from).toHaveBeenCalledWith('student_enrollments')
  })
})
