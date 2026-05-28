import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  classifyCertReadiness,
  listAtRiskStudents,
  listGroupPerformance,
  listCoursePerformance,
  getSemesterOverview,
  resolveGroupFilter,
} from '@/modules/analytics/queries'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockDb = (queues: Record<string, MockResult[]>) => {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// ── classifyCertReadiness ─────────────────────────────────────────────────────

describe('classifyCertReadiness', () => {
  it('returns ready when all scores meet full thresholds', () => {
    const result = classifyCertReadiness(80, 70, 75)
    expect(result.status).toBe('ready')
    expect(result.failedThresholds).toHaveLength(0)
  })

  it('returns not_ready when a score falls below the grace band', () => {
    // attendance < 65 (grace floor) → not_ready
    const result = classifyCertReadiness(60, 70, 75)
    expect(result.status).toBe('not_ready')
    expect(result.failedThresholds).toContain('attendance')
  })

  it('returns almost_ready when failing scores are within the grace band', () => {
    // attendance = 70 (< 75 threshold but >= 65 grace floor)
    const result = classifyCertReadiness(70, 70, 75)
    expect(result.status).toBe('almost_ready')
    expect(result.failedThresholds).toContain('attendance')
  })

  it('includes all failing threshold labels', () => {
    // all below threshold, all below grace → not_ready with 3 reasons
    const result = classifyCertReadiness(50, 40, 50)
    expect(result.status).toBe('not_ready')
    expect(result.failedThresholds).toContain('attendance')
    expect(result.failedThresholds).toContain('assignments')
    expect(result.failedThresholds).toContain('overall')
  })

  it('exact threshold boundary — exactly at threshold is ready', () => {
    const result = classifyCertReadiness(75, 60, 70)
    expect(result.status).toBe('ready')
  })

  it('one point below threshold falls into almost_ready band', () => {
    const result = classifyCertReadiness(74, 60, 70)
    expect(result.status).toBe('almost_ready')
  })
})

// ── listAtRiskStudents ────────────────────────────────────────────────────────

const AT_RISK_ROW = {
  student_id:            'stu-1',
  course_id:             'crs-1',
  semester_id:           'sem-1',
  group_id:              'grp-1',
  completion_percentage: 55,
  attendance_score:      60,
  assignment_score:      70,
  portfolio_score:       65,
  last_calculated_at:    '2026-05-27T00:00:00Z',
  students: { users: { email: 'a@b.com', profiles: { first_name: 'Alice', last_name: 'Smith' } } },
  groups:   { name: 'Alpha' },
  courses:  { title: 'Robotics 101' },
  semesters: { name: 'Spring 2026' },
}

describe('listAtRiskStudents', () => {
  it('returns empty result for an empty groupFilter', async () => {
    const result = await listAtRiskStudents([])
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('maps rows to AtRiskStudent shape with correct risk_reasons', async () => {
    mockDb({
      student_course_progress: [{ data: [AT_RISK_ROW], error: null }],
    })
    const result = await listAtRiskStudents(null)
    expect(result.data).toHaveLength(1)
    const s = result.data[0]
    expect(s.student_name).toBe('Alice Smith')
    expect(s.student_email).toBe('a@b.com')
    expect(s.risk_reasons).toContain('low_completion')
    expect(s.risk_reasons).toContain('low_attendance')
  })

  it('only tags low_completion when completion is below 70 but attendance is fine', async () => {
    const row = { ...AT_RISK_ROW, completion_percentage: 65, attendance_score: 80 }
    mockDb({ student_course_progress: [{ data: [row], error: null }] })
    const result = await listAtRiskStudents(null)
    expect(result.data[0].risk_reasons).toEqual(['low_completion'])
  })

  it('returns empty on DB error', async () => {
    mockDb({ student_course_progress: [{ data: null, error: { message: 'db error' } }] })
    const result = await listAtRiskStudents(null)
    expect(result.data).toHaveLength(0)
  })
})

// ── listGroupPerformance ──────────────────────────────────────────────────────

const GROUP_PROGRESS_ROWS = [
  {
    group_id: 'grp-1', completion_percentage: 80, attendance_score: 85, assignment_score: 75,
    groups: { name: 'Alpha', branches: { name: 'Cairo' } },
  },
  {
    group_id: 'grp-1', completion_percentage: 90, attendance_score: 95, assignment_score: 80,
    groups: { name: 'Alpha', branches: { name: 'Cairo' } },
  },
  {
    group_id: 'grp-2', completion_percentage: 50, attendance_score: 60, assignment_score: 55,
    groups: { name: 'Beta', branches: null },
  },
]

describe('listGroupPerformance', () => {
  it('returns empty for empty groupFilter', async () => {
    const result = await listGroupPerformance([])
    expect(result).toHaveLength(0)
  })

  it('aggregates multiple rows per group into averages', async () => {
    mockDb({ student_course_progress: [{ data: GROUP_PROGRESS_ROWS, error: null }] })
    const result = await listGroupPerformance(null)
    const alpha = result.find(g => g.group_id === 'grp-1')!
    expect(alpha.student_count).toBe(2)
    expect(alpha.avg_completion).toBe(85)
    expect(alpha.branch_name).toBe('Cairo')
  })

  it('sorts groups by avg_completion descending', async () => {
    mockDb({ student_course_progress: [{ data: GROUP_PROGRESS_ROWS, error: null }] })
    const result = await listGroupPerformance(null)
    expect(result[0].avg_completion).toBeGreaterThanOrEqual(result[1].avg_completion)
  })

  it('returns empty on DB error', async () => {
    mockDb({ student_course_progress: [{ data: null, error: { message: 'fail' } }] })
    const result = await listGroupPerformance(null)
    expect(result).toHaveLength(0)
  })
})

// ── listCoursePerformance ─────────────────────────────────────────────────────

const COURSE_PROGRESS_ROWS = [
  {
    course_id: 'crs-1', completion_percentage: 70, attendance_score: 80, assignment_score: 65,
    courses: { title: 'Robotics 101' },
  },
  {
    course_id: 'crs-1', completion_percentage: 90, attendance_score: 85, assignment_score: 75,
    courses: { title: 'Robotics 101' },
  },
  {
    course_id: 'crs-2', completion_percentage: 40, attendance_score: 50, assignment_score: 45,
    courses: { title: 'AI Basics' },
  },
]

describe('listCoursePerformance', () => {
  it('returns empty for empty groupFilter', async () => {
    const result = await listCoursePerformance([])
    expect(result).toHaveLength(0)
  })

  it('aggregates multiple rows per course into averages', async () => {
    mockDb({ student_course_progress: [{ data: COURSE_PROGRESS_ROWS, error: null }] })
    const result = await listCoursePerformance(null)
    const r101 = result.find(c => c.course_id === 'crs-1')!
    expect(r101.student_count).toBe(2)
    expect(r101.avg_completion).toBe(80)
    expect(r101.course_title).toBe('Robotics 101')
  })

  it('sorts courses by avg_completion descending', async () => {
    mockDb({ student_course_progress: [{ data: COURSE_PROGRESS_ROWS, error: null }] })
    const result = await listCoursePerformance(null)
    expect(result[0].avg_completion).toBeGreaterThanOrEqual(result[1].avg_completion)
  })
})

// ── getSemesterOverview ───────────────────────────────────────────────────────

const SEMESTER_ROWS = [
  { student_id: 'stu-1', status: 'active',    attendance_score: 80, assignment_score: 70, portfolio_score: 65, completion_percentage: 75, semesters: { name: 'Spring 2026' } },
  { student_id: 'stu-2', status: 'completed', attendance_score: 90, assignment_score: 85, portfolio_score: 80, completion_percentage: 95, semesters: { name: 'Spring 2026' } },
  { student_id: 'stu-3', status: 'failed',    attendance_score: 40, assignment_score: 30, portfolio_score: 25, completion_percentage: 35, semesters: { name: 'Spring 2026' } },
]

describe('getSemesterOverview', () => {
  it('returns null for empty groupFilter', async () => {
    const result = await getSemesterOverview('sem-1', [])
    expect(result).toBeNull()
  })

  it('returns null on DB error or empty data', async () => {
    mockDb({ student_course_progress: [{ data: null, error: { message: 'err' } }] })
    const result = await getSemesterOverview('sem-1', null)
    expect(result).toBeNull()
  })

  it('correctly counts unique students by worst status', async () => {
    mockDb({ student_course_progress: [{ data: SEMESTER_ROWS, error: null }] })
    const result = await getSemesterOverview('sem-1', null)
    expect(result).not.toBeNull()
    expect(result!.total_students).toBe(3)
    expect(result!.active_students).toBe(1)
    expect(result!.completed_students).toBe(1)
    expect(result!.failed_students).toBe(1)
  })

  it('picks worst status when student appears in multiple rows', async () => {
    const rows = [
      { ...SEMESTER_ROWS[0], status: 'completed' },
      { ...SEMESTER_ROWS[0], status: 'failed' },   // same student, worse status
    ]
    mockDb({ student_course_progress: [{ data: rows, error: null }] })
    const result = await getSemesterOverview('sem-1', null)
    expect(result!.failed_students).toBe(1)
    expect(result!.completed_students).toBe(0)
  })

  it('returns semester_name from row data', async () => {
    mockDb({ student_course_progress: [{ data: SEMESTER_ROWS, error: null }] })
    const result = await getSemesterOverview('sem-1', null)
    expect(result!.semester_name).toBe('Spring 2026')
  })
})

// ── resolveGroupFilter ────────────────────────────────────────────────────────

describe('resolveGroupFilter', () => {
  it('returns null for super_admin', async () => {
    const user = { globalRole: 'super_admin', id: 'u1', branchIds: [] } as any
    const result = await resolveGroupFilter(user)
    expect(result).toBeNull()
  })

  it('returns empty array for team_leader with no branches', async () => {
    const user = { globalRole: 'team_leader', id: 'u1', branchIds: [] } as any
    const result = await resolveGroupFilter(user)
    expect(result).toEqual([])
  })

  it('returns group ids for team_leader with branches', async () => {
    const user = { globalRole: 'team_leader', id: 'u1', branchIds: ['br-1'] } as any
    mockDb({
      groups: [{ data: [{ id: 'grp-1' }, { id: 'grp-2' }], error: null }],
    })
    const result = await resolveGroupFilter(user)
    expect(result).toEqual(['grp-1', 'grp-2'])
  })

  it('returns empty array for instructor with no instructor record', async () => {
    const user = { globalRole: 'instructor', id: 'u1', branchIds: [] } as any
    mockDb({
      instructors: [{ data: null, error: null }],
    })
    const result = await resolveGroupFilter(user)
    expect(result).toEqual([])
  })

  it('returns group ids for instructor with assignments', async () => {
    const user = { globalRole: 'instructor', id: 'u1', branchIds: [] } as any
    mockDb({
      instructors:       [{ data: { id: 'ins-1' }, error: null }],
      group_instructors: [{ data: [{ group_id: 'grp-1' }], error: null }],
    })
    const result = await resolveGroupFilter(user)
    expect(result).toEqual(['grp-1'])
  })
})
