import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { getSessionDetail } from '@/modules/instructor-portal/queries'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

function fixture(failedTable?: 'group_students' | 'attendance_records') {
  const result = (table: string) => ({ data: failedTable === table ? null : [], error: failedTable === table ? { code: 'TEST_READ_FAILURE', message: 'Synthetic unavailable' } : null })
  const db = createMockDb({
    schedules: [
      { data: { id: 'test-session', group_course_id: 'test-course', status: 'ongoing', scheduled_at: '2026-10-18T12:00:00Z', duration_minutes: 90 }, error: null },
      { data: { topic: 'Test topic' }, error: null },
      { data: {}, error: null },
      { data: [], error: null },
    ],
    group_courses: [{ data: { id: 'test-course', group_id: 'test-group', instructor_id: 'test-instructor' }, error: null }],
    group_students: [result('group_students')],
    attendance_records: [result('attendance_records')],
  })
  vi.mocked(createServiceClient).mockReturnValue(db as never)
}

describe('session roster reads fail closed', () => {
  it.each(['group_students', 'attendance_records'] as const)('never displays an empty/successful roster after a failed %s read', async table => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fixture(table)
    await expect(getSessionDetail('test-session', 'test-instructor')).rejects.toThrow('Unable to load the current attendance roster')
  })

  it('still permits a genuinely empty group when both reads succeeded', async () => {
    fixture()
    const detail = await getSessionDetail('test-session', 'test-instructor')
    expect(detail?.student_count).toBe(0)
    expect(detail?.attendance).toEqual([])
  })
})
