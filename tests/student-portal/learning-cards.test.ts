import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('@/modules/certificates/queries', () => ({
  getOwnCertificates: vi.fn().mockResolvedValue([]),
}))

const resolveActiveGroupIdsMock = vi.fn()
vi.mock('@/modules/academic/enrollment-integrity', () => ({
  resolveActiveGroupIds: (...args: unknown[]) => resolveActiveGroupIdsMock(...args),
  resolvePrimaryActiveGroupId: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { getStudentLearningCards } from '@/modules/student-portal/queries'

// A chainable query-builder mock: every call returns itself; resolves via
// `.then`/`.maybeSingle`/`.single` to a static per-table result. Matches the
// pattern already used in tests/student-competitions/competitions.test.ts,
// extended with the extra chain methods (.in/.order/.neq) this module needs.
function mockDbFor(tableResults: Record<string, any>) {
  return {
    from: vi.fn((table: string) => {
      const c: any = {}
      const methods = ['select', 'eq', 'in', 'order', 'neq', 'is', 'limit', 'insert', 'update']
      for (const m of methods) c[m] = () => c
      const result = tableResults[table] ?? { data: [], error: null }
      c.single      = () => Promise.resolve(result)
      c.maybeSingle = () => Promise.resolve(result)
      c.then        = (r: any) => Promise.resolve(result).then(r)
      return c
    }),
  }
}

describe('getStudentLearningCards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns an empty array when the student has no active enrollments', async () => {
    resolveActiveGroupIdsMock.mockResolvedValue([])
    const db = mockDbFor({
      students: { data: { id: 'student-1' }, error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const cards = await getStudentLearningCards('user-1')
    expect(cards).toEqual([])
  })

  it('returns an empty array when the user has no student record', async () => {
    resolveActiveGroupIdsMock.mockResolvedValue(['g1'])
    const db = mockDbFor({
      students: { data: null, error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const cards = await getStudentLearningCards('user-1')
    expect(cards).toEqual([])
    expect(resolveActiveGroupIdsMock).not.toHaveBeenCalled()
  })

  it('returns one card per concurrently-active enrollment (multi-course)', async () => {
    resolveActiveGroupIdsMock.mockResolvedValue(['g1', 'g2'])
    const db = mockDbFor({
      students: { data: { id: 'student-1' }, error: null },
      groups: {
        data: [
          { id: 'g1', name: 'Group A', day_of_week: 'monday', time: '10:00' },
          { id: 'g2', name: 'Group B', day_of_week: 'tuesday', time: '11:00' },
        ],
        error: null,
      },
      group_courses: {
        data: [
          { id: 'gc1', group_id: 'g1', status: 'active', instructor_id: null, course_id: 'c1', courses: { title: 'Python' } },
          { id: 'gc2', group_id: 'g2', status: 'active', instructor_id: null, course_id: 'c2', courses: { title: 'Robotics' } },
        ],
        error: null,
      },
      student_enrollments: {
        data: [
          { group_id: 'g1', enrolled_sessions: 20, consumed_sessions: 5, remaining_sessions: 15, start_date: '2026-01-01' },
          { group_id: 'g2', enrolled_sessions: 16, consumed_sessions: 16, remaining_sessions: 0, start_date: '2026-01-01' },
        ],
        error: null,
      },
      student_course_progress: {
        data: [
          { group_id: 'g1', completion_percentage: 40 },
          { group_id: 'g2', completion_percentage: 90 },
        ],
        error: null,
      },
      schedules: { data: [], error: null },
      group_instructors: { data: [], error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const cards = await getStudentLearningCards('user-1')

    expect(cards).toHaveLength(2)
    expect(cards.map(c => c.group_id)).toEqual(['g1', 'g2'])
    expect(cards.map(c => c.course_title)).toEqual(['Python', 'Robotics'])
    expect(cards.map(c => c.group_name)).toEqual(['Group A', 'Group B'])
    expect(cards[0].enrolled_sessions).toBe(20)
    expect(cards[0].progress_pct).toBe(40)
    expect(cards[1].progress_pct).toBe(90)
    // No schedules mocked → no attendance data, no upcoming session
    expect(cards[0].att_total).toBe(0)
    expect(cards[0].next_session_at).toBeNull()
    // No certificate/eligibility data → default status
    expect(cards[0].certificate_status).toBe('in_progress')
  })
})
