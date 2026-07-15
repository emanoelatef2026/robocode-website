import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  seedEvaluationPublishedNotification,
  seedStudentNoteNotification,
  seedParentNoteNotification,
  seedAchievementEarnedNotification,
  seedCompetitionResultNotification,
} from '@/modules/notifications/actions'
import { getStudentUserId, getParentUserIdsForStudent } from '@/modules/notifications/queries'

function mockUpsertDb() {
  const upserts: any[] = []
  const db = {
    from: vi.fn(() => ({
      upsert: (payload: any, opts: any) => {
        upserts.push({ payload, opts })
        return Promise.resolve({ data: null, error: null })
      },
    })),
  }
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return { db, upserts }
}

describe('Student domain notification seed functions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('seedEvaluationPublishedNotification upserts with a per-recipient dedup_key', async () => {
    const { upserts } = mockUpsertDb()
    await seedEvaluationPublishedNotification('user-001', 'eval-001', 'Programming')

    expect(upserts).toHaveLength(1)
    expect(upserts[0].payload.type).toBe('EVALUATION_PUBLISHED')
    expect(upserts[0].payload.dedup_key).toBe('evaluation_published:eval-001:user-001')
    expect(upserts[0].opts).toEqual({ onConflict: 'recipient_id,dedup_key', ignoreDuplicates: true })
  })

  it('seedStudentNoteNotification upserts with a note-scoped dedup_key', async () => {
    const { upserts } = mockUpsertDb()
    await seedStudentNoteNotification('user-002', 'note-001')

    expect(upserts[0].payload.type).toBe('STUDENT_NOTE_SHARED')
    expect(upserts[0].payload.dedup_key).toBe('student_note:note-001')
  })

  it('seedParentNoteNotification upserts with a per-recipient dedup_key', async () => {
    const { upserts } = mockUpsertDb()
    await seedParentNoteNotification('user-003', 'note-002')

    expect(upserts[0].payload.type).toBe('PARENT_NOTE_SHARED')
    expect(upserts[0].payload.dedup_key).toBe('parent_note:note-002:user-003')
  })

  it('seedAchievementEarnedNotification upserts with an achievement-scoped dedup_key', async () => {
    const { upserts } = mockUpsertDb()
    await seedAchievementEarnedNotification('user-004', 'ach-001', 'First Certificate')

    expect(upserts[0].payload.type).toBe('ACHIEVEMENT_EARNED')
    expect(upserts[0].payload.dedup_key).toBe('achievement_earned:ach-001')
    expect(upserts[0].payload.title).toContain('First Certificate')
  })

  it('seedCompetitionResultNotification upserts with a per-recipient dedup_key', async () => {
    const { upserts } = mockUpsertDb()
    await seedCompetitionResultNotification('user-005', 'comp-001', 'FIRST LEGO League')

    expect(upserts[0].payload.type).toBe('COMPETITION_RESULT')
    expect(upserts[0].payload.dedup_key).toBe('competition_result:comp-001:user-005')
  })
})

describe('Recipient resolution helpers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('getStudentUserId returns the student user_id', async () => {
    const db = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { user_id: 'user-stu-001' }, error: null }) }) }),
      })),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const userId = await getStudentUserId('stu-001')
    expect(userId).toBe('user-stu-001')
  })

  it('getStudentUserId returns null when the student has no portal account', async () => {
    const db = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      })),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const userId = await getStudentUserId('stu-002')
    expect(userId).toBeNull()
  })

  it('getParentUserIdsForStudent returns every linked parent user_id', async () => {
    const rows = [{ parents: { user_id: 'user-parent-1' } }, { parents: { user_id: 'user-parent-2' } }]
    const db = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
      })),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const ids = await getParentUserIdsForStudent('stu-001')
    expect(ids).toEqual(['user-parent-1', 'user-parent-2'])
  })
})
