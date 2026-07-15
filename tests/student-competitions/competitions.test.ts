import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCompetitionSchema } from '@/modules/student-competitions/schemas'

const BASE = {
  student_id:       '11111111-1111-4111-8111-111111111111',
  competition_name: 'FIRST LEGO League',
  year:             2026,
}

describe('createCompetitionSchema', () => {
  it('accepts a minimal valid competition', () => {
    const result = createCompetitionSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('rejects a missing competition_name', () => {
    const result = createCompetitionSchema.safeParse({ ...BASE, competition_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a year outside 2000-2100', () => {
    const result = createCompetitionSchema.safeParse({ ...BASE, year: 1899 })
    expect(result.success).toBe(false)
  })

  it('accepts full optional fields (rank, award, team, coach, project, certificate)', () => {
    const result = createCompetitionSchema.safeParse({
      ...BASE,
      season: 'Spring',
      role: 'Team Captain',
      team_name: 'Robo Rangers',
      coach_instructor_id: '22222222-2222-4222-8222-222222222222',
      project_id: '33333333-3333-4333-8333-333333333333',
      rank: '1st Place',
      award: 'Innovation Award',
      certificate_id: '44444444-4444-4444-8444-444444444444',
      notes: 'Great teamwork',
    })
    expect(result.success).toBe(true)
  })
})

// ── Action wiring — achievement auto-creation ──────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-tl-001' }),
}))
vi.mock('@/modules/gamification/achievement-service', () => ({
  resolvePortfolioId: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/timeline', () => ({
  logTimelineEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/modules/notifications/actions', () => ({
  seedCompetitionResultNotification: vi.fn().mockResolvedValue(undefined),
  seedAchievementEarnedNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/modules/notifications/queries', () => ({
  getStudentUserId: vi.fn().mockResolvedValue('student-user-001'),
  getParentUserIdsForStudent: vi.fn().mockResolvedValue([]),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { createStudentCompetition } from '@/modules/student-competitions/actions'

function mockDbFor(tableResults: Record<string, any>) {
  return {
    from: vi.fn((table: string) => {
      const c: any = {}
      const methods = ['select', 'eq', 'insert', 'update']
      for (const m of methods) c[m] = () => c
      c.single      = () => Promise.resolve(tableResults[table] ?? { data: null, error: null })
      c.maybeSingle = () => Promise.resolve(tableResults[table] ?? { data: null, error: null })
      c.then        = (r: any) => Promise.resolve(tableResults[table] ?? { data: null, error: null }).then(r)
      return c
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

describe('createStudentCompetition', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a competition without an achievement when no rank/award is given', async () => {
    const db = mockDbFor({
      student_competitions: { data: { id: 'comp-001' }, error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await createStudentCompetition(BASE)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.competitionId).toBe('comp-001')
      expect(result.data.achievementId).toBeNull()
    }
  })

  it('auto-creates a linked achievement when award is present', async () => {
    const db = mockDbFor({
      student_competitions: { data: { id: 'comp-002' }, error: null },
      student_achievements: { data: { id: 'ach-002' }, error: null },
    })
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await createStudentCompetition({ ...BASE, award: 'Gold Medal' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.achievementId).toBe('ach-002')
    }
    expect(db.from).toHaveBeenCalledWith('student_achievements')
  })

  it('returns a VALIDATION error for malformed input', async () => {
    const result = await createStudentCompetition({ ...BASE, year: 'not-a-number' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('VALIDATION')
  })
})
