import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { getTodaySessions } from '@/modules/instructor-portal/queries'

const mockDb = (queues: Record<string, ReturnType<typeof createMockDb> extends { from: (t: string) => infer R } ? never : any>) => {
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(queues)
}

const TODAY = new Date()
TODAY.setHours(10, 0, 0, 0)

const INSTRUCTOR_ID = 'inst-001'
const GC_ID         = 'gc-001'
const GROUP_ID      = 'grp-001'

function makeMockDb(sessions: any[]) {
  let callCount = 0

  const chainFor = (result: any) => {
    const c: any = {}
    const methods = [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
      'in', 'is', 'not', 'or', 'and', 'order', 'limit', 'range',
      'match', 'filter',
    ]
    for (const m of methods) c[m] = () => c
    c.single      = () => Promise.resolve(result)
    c.maybeSingle = () => Promise.resolve(result)
    c.then = (res: any) => Promise.resolve(result).then(res)
    c.catch = (rej: any) => Promise.resolve(result).catch(rej)
    return c
  }

  return {
    from: vi.fn((table: string) => {
      callCount++
      // call 1: group_instructors (resolveGcContext)
      if (callCount === 1) return chainFor({ data: [{ group_id: GROUP_ID }], error: null })
      // call 2: group_courses (resolveGcContext direct)
      if (callCount === 2) return chainFor({ data: [{ id: GC_ID, group_id: GROUP_ID }], error: null })
      // call 3: group_courses by giGroupIds
      if (callCount === 3) return chainFor({ data: [{ id: GC_ID, group_id: GROUP_ID }], error: null })
      // call 4: schedules (today's sessions)
      if (callCount === 4) return chainFor({ data: sessions, error: null })
      // call 5: group_courses for meta (groups join)
      if (callCount === 5) return chainFor({
        data: [{ id: GC_ID, groups: { id: GROUP_ID, name: 'Alpha', branches: { name: 'Main Branch' } }, courses: { title: 'Python 101' } }],
        error: null,
      })
      // call 6: group_students count
      if (callCount === 6) return chainFor({ data: [{ group_id: GROUP_ID }, { group_id: GROUP_ID }], error: null })
      return chainFor({ data: null, error: null })
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

describe('getTodaySessions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('TEST 1 — returns today sessions with correct shape', async () => {
    const db = makeMockDb([{
      id:               'sess-001',
      group_course_id:  GC_ID,
      scheduled_at:     TODAY.toISOString(),
      duration_minutes: 90,
      status:           'scheduled',
      session_number:   5,
    }])
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getTodaySessions(INSTRUCTOR_ID)

    expect(result).toHaveLength(1)
    const s = result[0]
    expect(s.id).toBe('sess-001')
    expect(s.group_name).toBe('Alpha')
    expect(s.course_title).toBe('Python 101')
    expect(s.branch_name).toBe('Main Branch')
    expect(s.duration_minutes).toBe(90)
    expect(s.session_number).toBe(5)
    expect(s.status).toBe('scheduled')
    expect(s.student_count).toBe(2)
  })

  it('TEST 1b — returns empty array when instructor has no groups', async () => {
    const db = {
      from: vi.fn((table: string) => {
        const c: any = {}
        const methods = ['select', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'not', 'order', 'limit', 'filter']
        for (const m of methods) c[m] = () => c
        c.single      = () => Promise.resolve({ data: null, error: null })
        c.maybeSingle = () => Promise.resolve({ data: null, error: null })
        c.then = (r: any) => Promise.resolve({ data: [], error: null }).then(r)
        return c
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await getTodaySessions(INSTRUCTOR_ID)
    expect(result).toHaveLength(0)
  })

  it('TEST 2 — quickStart priority: ongoing before scheduled', () => {
    const sessions = [
      { id: 'a', status: 'scheduled', group_id: 'g1', group_name: 'A', course_title: 'C', branch_name: 'B', scheduled_at: TODAY.toISOString(), duration_minutes: 60, student_count: 5, session_number: 1, group_course_id: 'gc1' },
      { id: 'b', status: 'ongoing',   group_id: 'g2', group_name: 'B', course_title: 'C', branch_name: 'B', scheduled_at: TODAY.toISOString(), duration_minutes: 60, student_count: 5, session_number: 2, group_course_id: 'gc2' },
    ]

    // Simulate Quick Start button logic from dashboard page
    const quickStart =
      sessions.find((s) => s.status === 'ongoing') ??
      sessions.find((s) => s.status === 'scheduled') ??
      null

    expect(quickStart?.id).toBe('b')
    expect(quickStart?.status).toBe('ongoing')
  })
})
