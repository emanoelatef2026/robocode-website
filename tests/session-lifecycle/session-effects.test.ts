import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/gamification/achievement-service', () => ({ checkAndUnlockAchievements: vi.fn() }))
vi.mock('@/modules/gamification/badge-service', () => ({ checkAndAwardBadges: vi.fn() }))
vi.mock('@/modules/progress/resolve', () => ({ resolveGroupProgressContext: vi.fn() }))
vi.mock('@/modules/progress/recalculate', () => ({ recalculateStudentProgress: vi.fn() }))
import { createServiceClient } from '@/lib/supabase/service'
import { after } from 'next/server'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { recalculateStudentProgress } from '@/modules/progress/recalculate'
import { processSessionEffects, scheduleSessionEffects } from '@/modules/instructor-portal/session-effects'
import { checkedEffectsClient } from '@/modules/instructor-portal/session-effects-db'

const job = {
  session_id: 'session', group_id: 'group', lease_token: 'lease',
  attendance: ['present','late','makeup','absent','excused'].map(status => ({ student_id: status, status })),
}
function workerDb() {
  const db = createMockDb({})
  db.rpc.mockImplementation(async name => {
    if (name === 'lease_session_effect') return { data: [job], error: null }
    return { data: name === 'finish_session_effect' ? true : null, error: null }
  })
  vi.mocked(createServiceClient).mockReturnValue(db as any)
  return db
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveGroupProgressContext).mockResolvedValue([{ groupId: 'group', courseId: 'course', semesterId: 'semester' }])
  vi.mocked(recalculateStudentProgress).mockResolvedValue({ success: true, data: undefined })
  vi.mocked(checkAndUnlockAchievements).mockResolvedValue(undefined)
  vi.mocked(checkAndAwardBadges).mockResolvedValue(undefined)
})
describe('durable session effects', () => {
  it('registers an awaited after callback', () => {
    scheduleSessionEffects('session')
    expect(after).toHaveBeenCalledWith(expect.any(Function))
  })
  it('processes frozen snapshot presence through canonical rewards and all members through progress', async () => {
    const db = workerDb()
    expect(await processSessionEffects('session', 1)).toBe(1)
    expect(db.rpc.mock.calls.map(c => c[0])).toEqual(['lease_session_effect','award_session_attendance_xp','finish_session_effect'])
    expect(db.rpc).toHaveBeenCalledWith('award_session_attendance_xp', { p_session_id: 'session', p_lease_token: 'lease' })
    expect(vi.mocked(checkAndUnlockAchievements).mock.calls.map(c => c[0])).toEqual(['present','late','makeup'])
    expect(vi.mocked(checkAndAwardBadges).mock.calls.map(c => c[0])).toEqual(['present','late','makeup'])
    expect(recalculateStudentProgress).toHaveBeenCalledTimes(5)
    expect(resolveGroupProgressContext).toHaveBeenCalledWith('group', expect.anything(), true)
  })
  it('returns immediately when another worker holds the lease', async () => {
    const db = workerDb()
    db.rpc.mockResolvedValue({ data: [], error: null })
    expect(await processSessionEffects()).toBe(0)
    expect(db.rpc).toHaveBeenCalledOnce()
    expect(checkAndUnlockAchievements).not.toHaveBeenCalled()
  })
  it('queues retry and never finishes on XP transaction failure', async () => {
    const db = workerDb()
    db.rpc.mockImplementation(async name => name === 'lease_session_effect' ? { data: [job], error: null }
      : name === 'award_session_attendance_xp' ? { data: null, error: { message: 'XP write failed' } }
      : { data: null, error: null })
    expect(await processSessionEffects('session', 1)).toBe(0)
    expect(db.rpc).toHaveBeenCalledWith('fail_session_effect', {
      p_session_id: 'session', p_lease_token: 'lease', p_error: 'XP write failed',
    })
    expect(db.rpc).not.toHaveBeenCalledWith('finish_session_effect', expect.anything())
  })
  it('queues retry when canonical reward writes throw', async () => {
    const db = workerDb()
    vi.mocked(checkAndUnlockAchievements).mockRejectedValueOnce(new Error('Achievement write failed'))
    expect(await processSessionEffects('session', 1)).toBe(0)
    expect(db.rpc).toHaveBeenCalledWith('fail_session_effect', expect.objectContaining({ p_error: 'Achievement write failed' }))
    expect(db.rpc).not.toHaveBeenCalledWith('finish_session_effect', expect.anything())
  })
  it('queues retry on a progress ActionResult failure', async () => {
    const db = workerDb()
    vi.mocked(recalculateStudentProgress).mockResolvedValueOnce({ success: false, error: { code: 'DB_ERROR', message: 'Progress failed' } })
    expect(await processSessionEffects('session', 1)).toBe(0)
    expect(db.rpc).toHaveBeenCalledWith('fail_session_effect', expect.objectContaining({ p_error: 'Progress failed' }))
    expect(db.rpc).not.toHaveBeenCalledWith('finish_session_effect', expect.anything())
  })
  it('rejects lease acquisition errors for cron visibility', async () => {
    const db = workerDb()
    db.rpc.mockResolvedValue({ data: null, error: { message: 'Lease failed' } })
    await expect(processSessionEffects()).rejects.toThrow('Lease failed')
  })
  it('does not silently finish when lease token was replaced', async () => {
    const db = workerDb()
    db.rpc.mockImplementation(async name => ({ data: name === 'lease_session_effect' ? [job] : false, error: null }))
    expect(await processSessionEffects('session', 1)).toBe(0)
    expect(db.rpc).toHaveBeenCalledWith('fail_session_effect', expect.objectContaining({ p_error: 'Session effect lease lost' }))
  })
})
describe('checked Supabase client', () => {
  it('throws returned errors from fluent queries and RPCs rather than treating missing data as success', async () => {
    const db = createMockDb({ students: [{ data: null, error: { message: 'Read failed' } }] })
    const checked = checkedEffectsClient(db as any)
    await expect(checked.from('students').select('id').eq('id','synthetic').maybeSingle()).rejects.toThrow('Read failed')
    db.rpc.mockResolvedValue({ data: null, error: { message: 'Write failed' } })
    await expect(checked.rpc('test')).rejects.toThrow('Write failed')
  })
  it('preserves data and count results', async () => {
    const db = createMockDb({ students: [{ data: [{ id: 'synthetic' }], count: 1, error: null } as any] })
    const result = await checkedEffectsClient(db as any).from('students').select('id')
    expect(result).toEqual({ data: [{ id: 'synthetic' }], count: 1, error: null })
  })
})
