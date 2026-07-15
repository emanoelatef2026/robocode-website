import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvaluationSchema, updateEvaluationSchema } from '@/modules/student-evaluations/schemas'
import { EVALUATION_CRITERIA, EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'

const BASE = {
  student_id: '11111111-1111-4111-8111-111111111111',
  branch_id:  '22222222-2222-4222-8222-222222222222',
  criterion:  'PROGRAMMING' as const,
  score:      85,
}

describe('createEvaluationSchema', () => {
  it('accepts a valid evaluation with just a score', () => {
    const result = createEvaluationSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('accepts a valid evaluation with just a rating', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, score: undefined, rating: 4 })
    expect(result.success).toBe(true)
  })

  it('rejects when neither score nor rating is provided', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, score: undefined })
    expect(result.success).toBe(false)
  })

  it('rejects CUSTOM criterion without custom_label', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, criterion: 'CUSTOM' })
    expect(result.success).toBe(false)
  })

  it('accepts CUSTOM criterion with custom_label', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, criterion: 'CUSTOM', custom_label: 'Robot Design' })
    expect(result.success).toBe(true)
  })

  it('rejects a rating outside 1-5', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, score: undefined, rating: 6 })
    expect(result.success).toBe(false)
  })

  it('rejects a score outside 0-100', () => {
    const result = createEvaluationSchema.safeParse({ ...BASE, score: 150 })
    expect(result.success).toBe(false)
  })

  it('defaults visible_to_student and visible_to_parent to true', () => {
    const result = createEvaluationSchema.safeParse(BASE)
    if (!result.success) throw new Error('expected success')
    expect(result.data.visible_to_student).toBe(true)
    expect(result.data.visible_to_parent).toBe(true)
  })
})

describe('updateEvaluationSchema', () => {
  it('accepts a partial patch', () => {
    const result = updateEvaluationSchema.safeParse({ evaluation_id: BASE.student_id, score: 90 })
    expect(result.success).toBe(true)
  })
})

describe('Evaluation criteria', () => {
  it('every criterion has a label', () => {
    for (const c of EVALUATION_CRITERIA) {
      expect(EVALUATION_CRITERION_LABELS[c]).toBeTruthy()
    }
  })

  it('covers all 13 named business-rule criteria plus CUSTOM', () => {
    expect(EVALUATION_CRITERIA).toHaveLength(14)
    expect(EVALUATION_CRITERIA).toContain('CUSTOM')
  })
})

// ── Action wiring ──────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-instructor-001' }),
}))
vi.mock('@/lib/timeline', () => ({
  logTimelineEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/modules/notifications/actions', () => ({
  seedEvaluationPublishedNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/modules/notifications/queries', () => ({
  getStudentUserId: vi.fn().mockResolvedValue('student-user-001'),
  getParentUserIdsForStudent: vi.fn().mockResolvedValue(['parent-user-001']),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { createStudentEvaluation } from '@/modules/student-evaluations/actions'

describe('createStudentEvaluation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts a row and returns its id', async () => {
    const db = {
      from: vi.fn(() => {
        const c: any = {}
        const methods = ['select', 'eq', 'insert']
        for (const m of methods) c[m] = () => c
        c.single = () => Promise.resolve({ data: { id: 'eval-001' }, error: null })
        return c
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

    const result = await createStudentEvaluation(BASE)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.evaluationId).toBe('eval-001')
  })

  it('returns a VALIDATION error for malformed input', async () => {
    const result = await createStudentEvaluation({ ...BASE, criterion: 'NOT_A_REAL_CRITERION' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('VALIDATION')
  })
})
