import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/service'
import {
  logTimelineEvent,
  TIMELINE_EVENT_LABELS,
  TIMELINE_SEVERITY_COLORS,
  STUDENT_VISIBLE_TIMELINE_EVENT_TYPES,
  PARENT_VISIBLE_TIMELINE_EVENT_TYPES,
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

// Sprint 4 — Parent Experience Journey page filters the shared
// student_timeline_events table (also used by finance/collections) down to
// this allowlist before rendering anything, mirroring the student-side guard.
describe('Timeline — PARENT_VISIBLE_TIMELINE_EVENT_TYPES', () => {
  const FINANCE_AND_STAFF_EVENT_TYPES: TimelineEventType[] = [
    'PAYMENT', 'PAYMENT_REVERSAL', 'PROMISE_MADE', 'PROMISE_BROKEN',
    'OVERDRAFT_GRANTED', 'COMPLAINT_LOGGED', 'PARENT_ESCALATION',
    'MANUAL_ADJUSTMENT', 'BLOCK_APPLIED', 'BLOCK_LIFTED', 'CALL_LOGGED',
    'WHATSAPP_SENT', 'TASK_CREATED', 'TASK_COMPLETED', 'SCORE_COMPUTED',
    'COLLECTION_STAGE_ADVANCED', 'REMINDER_SENT',
  ]

  it('excludes every finance/collections/staff-internal event type', () => {
    for (const type of FINANCE_AND_STAFF_EVENT_TYPES) {
      expect(PARENT_VISIBLE_TIMELINE_EVENT_TYPES).not.toContain(type)
    }
  })

  it('includes the academic milestone event types a parent should see', () => {
    for (const type of STUDENT_DOMAIN_EVENT_TYPES) {
      expect(PARENT_VISIBLE_TIMELINE_EVENT_TYPES).toContain(type)
    }
    expect(PARENT_VISIBLE_TIMELINE_EVENT_TYPES).toContain('ATTENDANCE_RECORDED')
    expect(PARENT_VISIBLE_TIMELINE_EVENT_TYPES).toContain('CERTIFICATE_ISSUED')
  })

  it('is a subset of every type that has a label (no orphaned allowlist entries)', () => {
    for (const type of PARENT_VISIBLE_TIMELINE_EVENT_TYPES) {
      expect(TIMELINE_EVENT_LABELS[type]).toBeTruthy()
    }
  })

  it('differs from the student allowlist by excluding homework detail', () => {
    // A parent doesn't track day-to-day homework assignment/completion the
    // way a student does — that detail lives in the Assignments page (which
    // already exposes only public_feedback), not the milestone timeline.
    expect(STUDENT_VISIBLE_TIMELINE_EVENT_TYPES).toContain('HOMEWORK_ASSIGNED')
    expect(PARENT_VISIBLE_TIMELINE_EVENT_TYPES).not.toContain('HOMEWORK_ASSIGNED')
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
