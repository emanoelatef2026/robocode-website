import { describe, it, expect, vi, beforeEach } from 'vitest'

// Sprint 4 — Parent Experience reuses the Student Domain (Sprint 2) business
// layer directly instead of duplicating it. These tests verify: (1) every
// adapter is gated by verifyParentChild before it ever calls the underlying
// student-domain reader, and (2) each adapter delegates rather than
// reimplementing the query.

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))

const getStudentEvaluationsMock  = vi.fn()
const getStudentCompetitionsMock = vi.fn()
const getStudentNotesMock        = vi.fn()
const getStudentLearningCardsMock = vi.fn()
const getSharedTimelineMock      = vi.fn()

vi.mock('@/modules/student-evaluations/queries', () => ({
  getStudentEvaluations: (...args: unknown[]) => getStudentEvaluationsMock(...args),
}))
vi.mock('@/modules/student-competitions/queries', () => ({
  getStudentCompetitions: (...args: unknown[]) => getStudentCompetitionsMock(...args),
}))
vi.mock('@/modules/student-notes/queries', () => ({
  getStudentNotes: (...args: unknown[]) => getStudentNotesMock(...args),
}))
vi.mock('@/modules/student-portal/queries', () => ({
  getStudentLearningCards: (...args: unknown[]) => getStudentLearningCardsMock(...args),
}))
vi.mock('@/lib/timeline', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timeline')>('@/lib/timeline')
  return {
    ...actual,
    getStudentTimeline: (...args: unknown[]) => getSharedTimelineMock(...args),
  }
})
vi.mock('@/modules/certificates/queries', () => ({ getChildCertificates: vi.fn() }))
vi.mock('@/modules/portfolio/queries', () => ({ getChildPortfolioDetail: vi.fn() }))
vi.mock('@/modules/finance/queries', () => ({ getParentChildFinance: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/service'
import {
  getChildEvaluations, getChildCompetitions, getChildNotes,
  getChildLearningCards, getChildJourneyTimeline,
} from '@/modules/parents/parent-portal-queries'

function makeChain(result: any) {
  const c: any = {}
  const methods = ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']
  for (const m of methods) c[m] = (..._: any[]) => c
  c.single      = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then        = (r: any) => Promise.resolve(result).then(r)
  return c
}

// verifyParentChild's shape: parents.select('id').eq('user_id', parentUserId) →
// { id: parentId }; parent_students.select('student_id').eq('parent_id',..).eq('student_id',..) → link row or null.
function mockLinkedDb(linked: boolean, extra: Record<string, any> = {}) {
  const db: any = {
    from: vi.fn((table: string) => {
      if (table === 'parents') return makeChain({ data: { id: 'parent-rec-1' }, error: null })
      if (table === 'parent_students') {
        return makeChain({ data: linked ? { student_id: 's1' } : null, error: null })
      }
      if (extra[table]) return makeChain(extra[table])
      return makeChain({ data: null, error: null })
    }),
  }
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Parent Experience — Student Domain reuse adapters', () => {
  it('getChildEvaluations refuses an unlinked parent without calling the student reader', async () => {
    mockLinkedDb(false)
    const result = await getChildEvaluations('parent-user-1', 's1')
    expect(result).toEqual([])
    expect(getStudentEvaluationsMock).not.toHaveBeenCalled()
  })

  it('getChildEvaluations delegates to getStudentEvaluations(studentId, "parent") for a linked parent', async () => {
    mockLinkedDb(true)
    getStudentEvaluationsMock.mockResolvedValue([{ id: 'e1', criterion: 'PROGRAMMING' }])
    const result = await getChildEvaluations('parent-user-1', 's1')
    expect(getStudentEvaluationsMock).toHaveBeenCalledWith('s1', 'parent')
    expect(result).toEqual([{ id: 'e1', criterion: 'PROGRAMMING' }])
  })

  it('getChildCompetitions refuses an unlinked parent and delegates for a linked one', async () => {
    mockLinkedDb(false)
    expect(await getChildCompetitions('parent-user-1', 's1')).toEqual([])
    expect(getStudentCompetitionsMock).not.toHaveBeenCalled()

    mockLinkedDb(true)
    getStudentCompetitionsMock.mockResolvedValue([{ id: 'c1' }])
    const result = await getChildCompetitions('parent-user-1', 's1')
    expect(getStudentCompetitionsMock).toHaveBeenCalledWith('s1')
    expect(result).toEqual([{ id: 'c1' }])
  })

  it('getChildNotes passes viewer kind "parent" — never "student" or "staff"', async () => {
    mockLinkedDb(true)
    getStudentNotesMock.mockResolvedValue([])
    await getChildNotes('parent-user-1', 's1')
    expect(getStudentNotesMock).toHaveBeenCalledWith('s1', { userId: 'parent-user-1', kind: 'parent' })
  })

  it('getChildLearningCards resolves the student\'s own user_id then delegates (no query duplication)', async () => {
    mockLinkedDb(true, { students: { data: { user_id: 'student-auth-user-1' }, error: null } })
    getStudentLearningCardsMock.mockResolvedValue([{ group_id: 'g1' }])
    const result = await getChildLearningCards('parent-user-1', 's1')
    expect(getStudentLearningCardsMock).toHaveBeenCalledWith('student-auth-user-1')
    expect(result).toEqual([{ group_id: 'g1' }])
  })

  it('getChildLearningCards returns [] when the student has no linked auth user', async () => {
    mockLinkedDb(true, { students: { data: null, error: null } })
    const result = await getChildLearningCards('parent-user-1', 's1')
    expect(result).toEqual([])
    expect(getStudentLearningCardsMock).not.toHaveBeenCalled()
  })

  it('getChildJourneyTimeline filters out staff/finance-only event types', async () => {
    mockLinkedDb(true)
    getSharedTimelineMock.mockResolvedValue([
      { id: '1', event_type: 'EVALUATION_RECORDED', notes: 'ok',      created_at: '2026-01-01', severity: 'INFO', created_by_name: null },
      { id: '2', event_type: 'PROMISE_MADE',         notes: 'hidden', created_at: '2026-01-02', severity: 'INFO', created_by_name: null },
      { id: '3', event_type: 'BLOCK_APPLIED',        notes: 'hidden', created_at: '2026-01-03', severity: 'CRITICAL', created_by_name: null },
      { id: '4', event_type: 'COMPETITION_LOGGED',   notes: 'ok',     created_at: '2026-01-04', severity: 'INFO', created_by_name: null },
    ])
    const result = await getChildJourneyTimeline('parent-user-1', 's1')
    expect(result.map(e => e.id)).toEqual(['1', '4'])
  })

  it('getChildJourneyTimeline refuses an unlinked parent', async () => {
    mockLinkedDb(false)
    const result = await getChildJourneyTimeline('parent-user-1', 's1')
    expect(result).toEqual([])
    expect(getSharedTimelineMock).not.toHaveBeenCalled()
  })
})
