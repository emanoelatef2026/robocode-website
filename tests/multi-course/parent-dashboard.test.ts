import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { getChildSessionsProgress, getChildAttendance } from '@/modules/parents/parent-portal-queries'

function makeChain(result: any) {
  const c: any = {}
  const methods = ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']
  for (const m of methods) c[m] = (..._: any[]) => c
  c.single      = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then        = (r: any) => Promise.resolve(result).then(r)
  return c
}

beforeEach(() => { vi.clearAllMocks() })

// Sprint 1 — this is the session-count source of truth actually rendered on
// the parent dashboard (app/portal/parent/page.tsx uses `sessions`, not
// getChildDashboardData's own completed_sessions/total_sessions field).
// It previously resolved a single enrollment (group-linked, FIFO fallback)
// — a family with 2 active courses saw only one course's session package.
describe('getChildSessionsProgress — multi-course', () => {
  it('sums completed/total sessions across every active enrollment', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { student_id: 's1' }, error: null })
        if (table === 'student_enrollments') {
          return makeChain({
            data: [
              { enrolled_sessions: 20, consumed_sessions: 20 },
              { enrolled_sessions: 16, consumed_sessions: 4 },
            ],
            error: null,
          })
        }
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getChildSessionsProgress('parent-user-1', 's1')
    expect(result).toEqual({ completed_sessions: 24, total_sessions: 36 })
  })

  it('returns zeros when there are no active enrollments', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { student_id: 's1' }, error: null })
        if (table === 'student_enrollments') return makeChain({ data: [], error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getChildSessionsProgress('parent-user-1', 's1')
    expect(result).toEqual({ completed_sessions: 0, total_sessions: 0 })
  })
})

// Sprint S0/1 — getChildAttendance had no .limit() at all (grows unbounded
// with account age), unlike its siblings in the same file. It computes an
// all-time summary so it needs a safety ceiling, not a small "recent N"
// window that would make the percentage wrong.
describe('getChildAttendance — bounded query', () => {
  it('caps the attendance_records query instead of fetching unbounded rows', async () => {
    let capturedLimit: number | undefined
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'parents') return makeChain({ data: { id: 'parent-1' }, error: null })
        if (table === 'parent_students') return makeChain({ data: { student_id: 's1' }, error: null })
        if (table === 'attendance_records') {
          const c = makeChain({ data: [], error: null })
          c.limit = (n: number) => { capturedLimit = n; return c }
          return c
        }
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await getChildAttendance('parent-user-1', 's1')
    expect(capturedLimit).toBeGreaterThan(0)
  })
})
