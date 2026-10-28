import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServiceClient } from '@/lib/supabase/service'
import { loadSharedSessionSnapshot } from '@/modules/instructor-portal/shared-queries'
import { createMockDb } from '../helpers/mock-db'
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
const row = { id: 'session', group_course_id: 'course', session_number: 1, status: 'ongoing', scheduled_at: '2026-10-28', topic: 'Test lesson', attendance_revision: 0, ended_at: null }
beforeEach(() => vi.clearAllMocks())
describe('shared session schema compatibility', () => {
  it('keeps existing classes visible in read-only mode before the role migration', async () => {
    const db = createMockDb({ group_courses: [{ data: [{ id: 'course' }], error: null }], schedules: [
      { data: null, error: { code: '42703', message: 'column schedules.lead_instructor_id does not exist' } },
      { data: [row], error: null },
    ] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    const result = await loadSharedSessionSnapshot('group', 'teacher')
    expect(result.workflowReady).toBe(false)
    expect(result.sessions).toMatchObject([{ id: 'session', topic: 'Test lesson', isLead: false }])
  })
  it('does not hide real permission or database errors behind an empty list', async () => {
    const db = createMockDb({ group_courses: [{ data: [{ id: 'course' }], error: null }], schedules: [{ data: null, error: { code: '42501', message: 'permission denied' } }] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    await expect(loadSharedSessionSnapshot('group','teacher')).rejects.toThrow('Unable to load shared sessions')
    expect(db.from.mock.calls.filter(([table]) => table === 'schedules')).toHaveLength(1)
  })
  it('enables the workflow and identifies the lead after the migration', async () => {
    const db = createMockDb({ group_courses: [{ data: [{ id: 'course' }], error: null }], schedules: [{ data: [{ ...row, lead_instructor_id: 'teacher' }], error: null }] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    const result = await loadSharedSessionSnapshot('group','teacher')
    expect(result.workflowReady).toBe(true)
    expect(result.sessions[0].isLead).toBe(true)
  })
  it('detects the old schema even for a group without any scheduled classes', async () => {
    const db = createMockDb({ group_courses: [{ data: [{ id: 'course' }], error: null }], schedules: [
      { data: null, error: { code: '42703', message: 'column schedules.lead_instructor_id does not exist' } }, { data: [], error: null },
    ] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    expect(await loadSharedSessionSnapshot('group','teacher')).toEqual({ sessions: [], workflowReady: false })
  })
})
