import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/timeline', () => ({ logTimelineEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/notifications/actions', () => ({ seedAchievementEarnedNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/modules/notifications/queries', () => ({ getStudentUserId: vi.fn().mockResolvedValue(null) }))
import { createServiceClient } from '@/lib/supabase/service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import { checkedEffectsClient } from '@/modules/instructor-portal/session-effects-db'
import { logTimelineEvent } from '@/lib/timeline'
import { BADGE_DEFS } from '@/modules/gamification/types'

beforeEach(() => vi.clearAllMocks())
function achievementsDb(existing = false) {
  const db = createMockDb({
    student_portfolios: [{ data: null, error: null }],
    attendance_records: [{ data: null, count: 1, error: null } as any],
    students: [{ data: { total_xp: 0 }, error: null }],
    student_achievements: [{ data: existing ? { id: 'existing' } : null, error: null }],
  })
  vi.mocked(createServiceClient).mockReturnValue(db as any)
  return db
}
describe('canonical reward write regressions', () => {
  it('normal callers award First Attendance and bonus XP through the atomic write RPC', async () => {
    const db = achievementsDb()
    db.rpc.mockResolvedValue({ data: 'achievement-id', error: null })
    await checkAndUnlockAchievements('synthetic-student')
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('unlock_student_achievement', {
      p_student_id: 'synthetic-student', p_portfolio_id: null, p_title: 'First Attendance',
      p_description: 'Attended your first session.', p_type: 'attendance', p_xp: 25,
    })
    expect(logTimelineEvent).toHaveBeenCalledOnce()
  })
  it('existing achievements do not request bonus XP again', async () => {
    const db = achievementsDb(true)
    await checkAndUnlockAchievements('synthetic-student')
    expect(db.rpc).not.toHaveBeenCalled()
    expect(logTimelineEvent).not.toHaveBeenCalled()
  })
  it('a concurrent achievement winner produces no repeated side effects', async () => {
    const db = achievementsDb()
    db.rpc.mockResolvedValue({ data: null, error: null })
    await checkAndUnlockAchievements('synthetic-student', checkedEffectsClient(db as any))
    expect(db.rpc).toHaveBeenCalledOnce()
    expect(logTimelineEvent).not.toHaveBeenCalled()
  })
  it('critical achievement write errors reach the durable worker', async () => {
    const db = achievementsDb()
    db.rpc.mockResolvedValue({ data: null, error: { message: 'Bonus transaction failed' } })
    await expect(checkAndUnlockAchievements('synthetic-student', checkedEffectsClient(db as any)))
      .rejects.toThrow('Bonus transaction failed')
    expect(logTimelineEvent).not.toHaveBeenCalled()
  })
  it('read failures reach the worker instead of silently skipping milestone checks', async () => {
    const db = createMockDb({ student_portfolios: [{ data: null, error: { message: 'Portfolio lookup failed' } }] })
    await expect(checkAndUnlockAchievements('synthetic-student', checkedEffectsClient(db as any)))
      .rejects.toThrow('Portfolio lookup failed')
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('normal badge callers preserve canonical XP eligibility and use the serialized award RPC', async () => {
    const db = createMockDb({ students: [{ data: { total_xp: 1000, current_level: 3, best_streak: 0 }, error: null }] })
    vi.mocked(createServiceClient).mockReturnValue(db as any)
    db.rpc.mockResolvedValue({ data: 'badge-id', error: null })
    await checkAndAwardBadges('synthetic-student')
    const definition = BADGE_DEFS.find(d => d.condition === 'xp_1000')!
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('award_student_badge', {
      p_student_id: 'synthetic-student', p_portfolio_id: null,
      p_name: definition.badge_name, p_description: definition.description,
    })
  })
  it('badge write failures are retriable rather than acknowledged', async () => {
    const db = createMockDb({ students: [{ data: { total_xp: 1000, current_level: 3, best_streak: 0 }, error: null }] })
    db.rpc.mockResolvedValue({ data: null, error: { message: 'Badge write failed' } })
    await expect(checkAndAwardBadges('synthetic-student', checkedEffectsClient(db as any)))
      .rejects.toThrow('Badge write failed')
  })
})
