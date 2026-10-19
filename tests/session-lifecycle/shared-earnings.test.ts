import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorSessionEarnings } from '@/modules/instructor-payments/queries'
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
describe('shared class earnings attribution', () => {
  it('does not pay a merely assigned co-teacher for a class taught by someone else', async () => {
    const db = createMockDb({
      instructors: [{ data: { salary_per_session: 100 }, error: null }],
      group_courses: [{ data: [], error: null }, { data: [{ id: 'gc', group_id: 'g' }], error: null }],
      group_instructors: [{ data: [{ group_id: 'g', role: 'assistant', session_rate: 80 }], error: null }],
      session_instructors: [{ data: [], error: null }, { data: [{ session_id: 'class' }], error: null }],
      schedules: [{ data: [{ id: 'class', group_course_id: 'gc', status: 'completed' }], error: null }],
      session_participations: [{ data: [{ session_id: 'class' }], error: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    expect(await getInstructorSessionEarnings('assistant', ['branch'])).toEqual([])
  })
  it('does not use historical fallback to credit even the lead for an unconfirmed shared class', async () => {
    const db = createMockDb({
      instructors: [{ data: { salary_per_session: 100 }, error: null }],
      group_courses: [{ data: [{ id: 'gc', group_id: 'g' }], error: null }],
      group_instructors: [{ data: [], error: null }],
      session_instructors: [{ data: [], error: null }, { data: [], error: null }],
      schedules: [{ data: [{ id: 'class', group_course_id: 'gc', status: 'completed' }], error: null }],
      session_participations: [{ data: [{ session_id: 'class' }], error: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    expect(await getInstructorSessionEarnings('lead', ['branch'])).toEqual([])
  })
})
