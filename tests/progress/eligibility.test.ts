import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'

let mockDb: ReturnType<typeof createMockDb>

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockDb),
}))

import { checkCertificateEligibility } from '@/modules/progress/eligibility'

type ProgressRow = {
  attendance_score:    number
  assignment_score:    number
  portfolio_score:     number
  completion_percentage: number
}

function progressDb(rows: ProgressRow[]) {
  return createMockDb({
    student_course_progress: [{ data: rows, error: null }],
  })
}

describe('checkCertificateEligibility', () => {
  beforeEach(() => { mockDb = progressDb([]) })

  it('returns ineligible with no_progress_data when no rows exist', async () => {
    mockDb = progressDb([])
    const result = await checkCertificateEligibility('s1', 'sem1')
    expect(result.is_eligible).toBe(false)
    expect(result.failed_thresholds).toContain('no_progress_data')
    expect(result.courses_evaluated).toBe(0)
    expect(result.overall_percentage).toBe(0)
  })

  it('returns eligible when all thresholds are met', async () => {
    mockDb = progressDb([
      { attendance_score: 90, assignment_score: 85, portfolio_score: 80, completion_percentage: 86 },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1')
    expect(result.is_eligible).toBe(true)
    expect(result.failed_thresholds).toHaveLength(0)
    expect(result.courses_evaluated).toBe(1)
  })

  it('fails when attendance is below default threshold (75)', async () => {
    mockDb = progressDb([
      { attendance_score: 50, assignment_score: 80, portfolio_score: 80, completion_percentage: 75 },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1')
    expect(result.is_eligible).toBe(false)
    expect(result.failed_thresholds).toContain('attendance')
    expect(result.failed_thresholds).not.toContain('assignments')
  })

  it('fails when assignment score is below default threshold (60)', async () => {
    mockDb = progressDb([
      { attendance_score: 80, assignment_score: 45, portfolio_score: 80, completion_percentage: 72 },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1')
    expect(result.is_eligible).toBe(false)
    expect(result.failed_thresholds).toContain('assignments')
    expect(result.failed_thresholds).not.toContain('attendance')
  })

  it('respects custom thresholds — passes with lowered minimums', async () => {
    mockDb = progressDb([
      { attendance_score: 60, assignment_score: 55, portfolio_score: 60, completion_percentage: 60 },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1', {
      min_attendance: 50,
      min_assignment: 50,
      min_overall:    50,
    })
    expect(result.is_eligible).toBe(true)
    expect(result.failed_thresholds).toHaveLength(0)
  })

  it('averages scores across multiple courses', async () => {
    mockDb = progressDb([
      { attendance_score: 100, assignment_score: 100, portfolio_score: 100, completion_percentage: 100 },
      { attendance_score: 60,  assignment_score: 60,  portfolio_score: 60,  completion_percentage: 60  },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1')
    expect(result.attendance_score).toBe(80)
    expect(result.assignment_score).toBe(80)
    expect(result.overall_percentage).toBe(80)
    expect(result.courses_evaluated).toBe(2)
  })

  it('exposes the thresholds used in the result', async () => {
    mockDb = progressDb([
      { attendance_score: 90, assignment_score: 90, portfolio_score: 90, completion_percentage: 90 },
    ])
    const result = await checkCertificateEligibility('s1', 'sem1', { min_attendance: 80 })
    expect(result.thresholds.min_attendance).toBe(80)
    expect(result.thresholds.min_assignment).toBe(60)   // default
    expect(result.thresholds.min_overall).toBe(70)       // default
  })
})
