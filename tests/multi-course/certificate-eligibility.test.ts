import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import { getCertificateEligibility } from '@/modules/student-portal/queries'

function makeChain(result: any) {
  const c: any = {}
  const methods = ['select', 'eq', 'in', 'is', 'order', 'limit']
  for (const m of methods) c[m] = (..._: any[]) => c
  c.maybeSingle = () => Promise.resolve(result)
  c.then        = (r: any) => Promise.resolve(result).then(r)
  return c
}

beforeEach(() => { vi.clearAllMocks() })

// Sprint 1 — a student concurrently enrolled in 2 courses must get 2
// independent eligibility checks (certificates are inherently per-course),
// not one that silently reports on only the first course found.
describe('getCertificateEligibility — multi-course', () => {
  it('returns one eligibility entry per active group/course', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'students') return makeChain({ data: { id: 'student-1' }, error: null })
        if (table === 'group_students') {
          return makeChain({
            data: [{ group_id: 'group-python' }, { group_id: 'group-robotics' }],
            error: null,
          })
        }
        if (table === 'groups') {
          return makeChain({
            data: [{ id: 'group-python', name: 'Python A' }, { id: 'group-robotics', name: 'Robotics B' }],
            error: null,
          })
        }
        if (table === 'group_courses') {
          return makeChain({
            data: [
              { id: 'gc-python', group_id: 'group-python', courses: { title: 'Python Basics' } },
              { id: 'gc-robotics', group_id: 'group-robotics', courses: { title: 'Robotics 101' } },
            ],
            error: null,
          })
        }
        if (table === 'student_enrollments') {
          return makeChain({
            data: [
              { group_id: 'group-python', enrolled_sessions: 20, consumed_sessions: 20, remaining_sessions: 0 },
              { group_id: 'group-robotics', enrolled_sessions: 16, consumed_sessions: 4, remaining_sessions: 12 },
            ],
            error: null,
          })
        }
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getCertificateEligibility('user-1')

    expect(result).toHaveLength(2)

    const python = result.find(r => r.course_title === 'Python Basics')!
    expect(python.is_eligible).toBe(true)
    expect(python.consumed_sessions).toBe(20)

    const robotics = result.find(r => r.course_title === 'Robotics 101')!
    expect(robotics.is_eligible).toBe(false)
    expect(robotics.sessions_remaining).toBe(12)
  })

  it('returns an empty array when the student has no active groups', async () => {
    const db: any = {
      from: vi.fn((table: string) => {
        if (table === 'students') return makeChain({ data: { id: 'student-1' }, error: null })
        return makeChain({ data: [], error: null })
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getCertificateEligibility('user-1')
    expect(result).toEqual([])
  })
})
