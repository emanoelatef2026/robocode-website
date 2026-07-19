import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ─────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import {
  getTLEvaluationOverview,
  getTLNotesOverview,
  getTLCompetitionOverview,
  getTLAcademicOverviewKPIs,
} from '@/modules/tl-analytics/queries'

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

const BRANCH_ID   = '00000000-0000-4000-8000-000000000001'
const GROUP_ID    = '00000000-0000-4000-8000-000000000010'
const INSTR_ID    = '00000000-0000-4000-8000-000000000020'
const STUDENT_1   = '00000000-0000-4000-8000-000000000030'
const STUDENT_2   = '00000000-0000-4000-8000-000000000031'

// Single group_courses row: one active branch group taught by one instructor,
// matching the shape resolveBranchAcademicRoster() expects to embed.
const GROUP_COURSES_ROW = {
  data: [{
    id: 'gc-1',
    instructor_id: INSTR_ID,
    groups: {
      id: GROUP_ID, name: 'Group Alpha', branch_id: BRANCH_ID,
      branches: { name: 'Main Branch' },
    },
    instructors: {
      id: INSTR_ID,
      users: { profiles: { first_name: 'Jane', last_name: 'Coach' } },
    },
  }],
  error: null,
}

const GROUP_STUDENTS_ROW = {
  data: [
    { group_id: GROUP_ID, student_id: STUDENT_1 },
    { group_id: GROUP_ID, student_id: STUDENT_2 },
  ],
  error: null,
}

const STUDENT_NAME_ROWS = {
  data: [
    { id: STUDENT_1, users: { profiles: { first_name: 'Ali', last_name: 'Hassan' } } },
    { id: STUDENT_2, users: { profiles: { first_name: 'Sara', last_name: 'Adel' } } },
  ],
  error: null,
}

describe('tl-analytics — Academic Oversight (Sprint B)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ─────────────────────────────────────────────────────────────────────────
  // Branch isolation — every function must short-circuit on empty branchIds
  // without ever touching the database.
  // ─────────────────────────────────────────────────────────────────────────
  it('getTLEvaluationOverview returns an empty overview and never queries the DB when branchIds is empty', async () => {
    const db = mockDb({})
    const result = await getTLEvaluationOverview([])
    expect(result.kpis.total_active_students).toBe(0)
    expect(result.students_missing).toEqual([])
    expect(db.from).not.toHaveBeenCalled()
  })

  it('getTLNotesOverview returns an empty overview and never queries the DB when branchIds is empty', async () => {
    const db = mockDb({})
    const result = await getTLNotesOverview([])
    expect(result.kpis.total_active_students).toBe(0)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('getTLCompetitionOverview returns an empty overview and never queries the DB when branchIds is empty', async () => {
    const db = mockDb({})
    const result = await getTLCompetitionOverview([])
    expect(result.kpis.total_active_students).toBe(0)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('getTLAcademicOverviewKPIs returns all-zero KPIs and never queries the DB when branchIds is empty', async () => {
    const db = mockDb({})
    const result = await getTLAcademicOverviewKPIs([])
    expect(result).toEqual({
      evaluation_completion_pct: 0, notes_completion_pct: 0, homework_completion_pct: 0,
      competition_participation_pct: 0, students_missing_evaluation: 0, students_missing_notes: 0,
      groups_requiring_attention: 0, instructors_requiring_attention: 0,
    })
    expect(db.from).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getTLEvaluationOverview — classification + coverage math
  // ─────────────────────────────────────────────────────────────────────────
  it('getTLEvaluationOverview classifies a never-evaluated student as missing and computes 50% completion', async () => {
    const now = new Date().toISOString()
    mockDb({
      group_courses:       [GROUP_COURSES_ROW],
      group_students:      [GROUP_STUDENTS_ROW],
      student_evaluations: [{
        data: [{ id: 'eval-1', student_id: STUDENT_1, criterion: 'PROGRAMMING', author_id: 'author-1', evaluated_at: now, created_at: now }],
        error: null,
      }],
      students: [STUDENT_NAME_ROWS],
      users:    [{ data: [{ id: 'author-1', profiles: { first_name: 'Jane', last_name: 'Coach' } }], error: null }],
    })

    const result = await getTLEvaluationOverview([BRANCH_ID])

    expect(result.kpis.total_active_students).toBe(2)
    expect(result.kpis.evaluated_recent_count).toBe(1)
    expect(result.kpis.completion_pct).toBe(50)
    expect(result.kpis.missing_count).toBe(1)
    expect(result.kpis.overdue_count).toBe(0)

    expect(result.students_missing).toHaveLength(1)
    expect(result.students_missing[0]).toMatchObject({ student_id: STUDENT_2, status: 'missing' })

    expect(result.by_group).toEqual([
      { group_id: GROUP_ID, group_name: 'Group Alpha', branch_name: 'Main Branch', student_count: 2, evaluated_count: 1, completion_pct: 50 },
    ])
    expect(result.by_instructor).toEqual([
      { instructor_id: INSTR_ID, instructor_name: 'Jane Coach', student_count: 2, evaluated_count: 1, completion_pct: 50 },
    ])
    expect(result.recent_activity).toHaveLength(1)
    expect(result.recent_activity[0]).toMatchObject({ student_id: STUDENT_1, criterion: 'PROGRAMMING', author_name: 'Jane Coach' })
  })

  it('getTLEvaluationOverview classifies a stale (30+ day) evaluation as overdue, not missing', async () => {
    const staleDate = new Date(Date.now() - 45 * 86400000).toISOString()
    mockDb({
      group_courses:       [GROUP_COURSES_ROW],
      group_students:      [GROUP_STUDENTS_ROW],
      student_evaluations: [{
        data: [
          { id: 'eval-1', student_id: STUDENT_1, criterion: 'LOGIC', author_id: 'author-1', evaluated_at: staleDate, created_at: staleDate },
        ],
        error: null,
      }],
      students: [STUDENT_NAME_ROWS],
      users:    [{ data: [], error: null }],
    })

    const result = await getTLEvaluationOverview([BRANCH_ID])

    expect(result.kpis.missing_count).toBe(1)   // STUDENT_2, never evaluated
    expect(result.kpis.overdue_count).toBe(1)   // STUDENT_1, stale
    expect(result.kpis.evaluated_recent_count).toBe(0)
    expect(result.kpis.completion_pct).toBe(0)

    const statuses = result.students_missing.map(s => `${s.student_id}:${s.status}`).sort()
    expect(statuses).toEqual([`${STUDENT_1}:overdue`, `${STUDENT_2}:missing`].sort())
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getTLNotesOverview — coverage math + content is never exposed
  // ─────────────────────────────────────────────────────────────────────────
  it('getTLNotesOverview computes coverage and never selects note content', async () => {
    const now = new Date().toISOString()
    mockDb({
      group_courses:  [GROUP_COURSES_ROW],
      group_students: [GROUP_STUDENTS_ROW],
      student_notes:  [{
        data: [{ id: 'note-1', student_id: STUDENT_1, category: 'ACADEMIC', severity: 'MEDIUM', author_id: 'author-1', created_at: now }],
        error: null,
      }],
      students: [STUDENT_NAME_ROWS],
      users:    [{ data: [{ id: 'author-1', profiles: { first_name: 'Jane', last_name: 'Coach' } }], error: null }],
    })

    const result = await getTLNotesOverview([BRANCH_ID])

    expect(result.kpis.completion_pct).toBe(50)
    expect(result.kpis.missing_count).toBe(1)
    expect(result.recent_activity).toHaveLength(1)
    expect(result.recent_activity[0]).toMatchObject({ student_id: STUDENT_1, category: 'ACADEMIC', severity: 'MEDIUM' })
    // The aggregate must never leak note text — only metadata.
    expect('content' in result.recent_activity[0]).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getTLCompetitionOverview — participation + winners (visibility only)
  // ─────────────────────────────────────────────────────────────────────────
  it('getTLCompetitionOverview identifies winners by rank/award and computes participation rate', async () => {
    const now = new Date().toISOString()
    mockDb({
      group_courses:        [GROUP_COURSES_ROW],
      group_students:       [GROUP_STUDENTS_ROW],
      student_competitions: [{
        data: [
          { id: 'comp-1', student_id: STUDENT_1, competition_name: 'Robotics Cup', year: new Date().getFullYear(), rank: '1st', award: 'Gold', created_at: now },
        ],
        error: null,
      }],
      students: [STUDENT_NAME_ROWS],
    })

    const result = await getTLCompetitionOverview([BRANCH_ID])

    expect(result.kpis.participating_count).toBe(1)
    expect(result.kpis.participation_pct).toBe(50)
    expect(result.kpis.winners_count).toBe(1)
    expect(result.kpis.recent_count).toBe(1)
    expect(result.winners).toHaveLength(1)
    expect(result.winners[0]).toMatchObject({ student_id: STUDENT_1, rank: '1st', award: 'Gold' })
  })

  it('getTLCompetitionOverview treats a student with no recorded result as a non-winner, non-participant', async () => {
    mockDb({
      group_courses:        [GROUP_COURSES_ROW],
      group_students:       [GROUP_STUDENTS_ROW],
      student_competitions: [{ data: [], error: null }],
      students:             [{ data: [], error: null }],
    })

    const result = await getTLCompetitionOverview([BRANCH_ID])

    expect(result.kpis.participating_count).toBe(0)
    expect(result.kpis.winners_count).toBe(0)
    expect(result.winners).toEqual([])
  })

  // ─────────────────────────────────────────────────────────────────────────
  // getTLAcademicOverviewKPIs — pure composition, no new business logic
  // ─────────────────────────────────────────────────────────────────────────
  it('getTLAcademicOverviewKPIs composes without error against a fully-empty roster', async () => {
    // No group_courses queued for any of the 4 underlying calls this
    // composite fans out to — every sub-overview resolves to its own
    // documented empty/zero shape, exercising the real composition path.
    const db = mockDb({})
    const result = await getTLAcademicOverviewKPIs([BRANCH_ID])

    expect(result).toEqual({
      evaluation_completion_pct: 0, notes_completion_pct: 0, homework_completion_pct: 0,
      competition_participation_pct: 0, students_missing_evaluation: 0, students_missing_notes: 0,
      groups_requiring_attention: 0, instructors_requiring_attention: 0,
    })
    // Confirms it genuinely fanned out to the underlying tables rather than
    // short-circuiting (branchIds is non-empty here).
    expect(db.from).toHaveBeenCalledWith('group_courses')
  })
})
