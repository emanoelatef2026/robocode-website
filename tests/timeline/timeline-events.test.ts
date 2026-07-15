import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  logTimelineEvent,
  TIMELINE_EVENT_LABELS,
  TIMELINE_SEVERITY_COLORS,
  type TimelineEventType,
} from '@/lib/timeline'

const STUDENT_DOMAIN_EVENT_TYPES: TimelineEventType[] = [
  'NOTE_ADDED',
  'EVALUATION_RECORDED',
  'COMPETITION_LOGGED',
  'ACHIEVEMENT_EARNED',
  'BADGE_EARNED',
]

describe('Timeline — Student Domain event types', () => {
  it('every new event type has a label', () => {
    for (const type of STUDENT_DOMAIN_EVENT_TYPES) {
      expect(TIMELINE_EVENT_LABELS[type]).toBeTruthy()
    }
  })

  it('every severity has a color mapping', () => {
    expect(TIMELINE_SEVERITY_COLORS.INFO).toBeTruthy()
    expect(TIMELINE_SEVERITY_COLORS.WARNING).toBeTruthy()
    expect(TIMELINE_SEVERITY_COLORS.CRITICAL).toBeTruthy()
  })
})

describe('logTimelineEvent', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts a row into student_timeline_events with the resolved severity', async () => {
    let inserted: any = null
    const db = {
      from: vi.fn((table: string) => {
        const c: any = {}
        c.insert = (row: any) => { inserted = row; return Promise.resolve({ data: null, error: null }) }
        return c
      }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await logTimelineEvent({
      student_id: 'stu-001',
      event_type: 'COMPETITION_LOGGED',
      notes:      'FIRST LEGO League (2026)',
      created_by: 'user-tl-001',
    })

    expect(db.from).toHaveBeenCalledWith('student_timeline_events')
    expect(inserted.student_id).toBe('stu-001')
    expect(inserted.event_type).toBe('COMPETITION_LOGGED')
  })

  it('never throws even when the insert fails', async () => {
    const db = {
      from: vi.fn(() => ({
        insert: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      })),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    await expect(
      logTimelineEvent({ student_id: 'stu-001', event_type: 'ACHIEVEMENT_EARNED' })
    ).resolves.toBeUndefined()
  })
})
