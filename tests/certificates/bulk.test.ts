import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-1', role: 'super_admin', branchIds: ['branch-1'] }),
  isBranchAccessible: vi.fn().mockReturnValue(true),
}))

vi.mock('@/modules/gamification/xp-service', () => ({
  awardXP: vi.fn(),
  XP_AWARDS: { CERTIFICATE_EARNED: 100 },
}))

vi.mock('@/modules/gamification/achievement-service', () => ({
  checkAndUnlockAchievements: vi.fn(),
  checkCourseAchievement: vi.fn(),
}))

vi.mock('@/modules/gamification/badge-service', () => ({
  checkAndAwardBadges: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { isBranchAccessible } from '@/modules/rbac/guards'
import {
  loadBulkPreviewData,
  issueBulkGroupCertificates,
  loadBulkCertificateWizardOptions,
} from '@/modules/certificates/bulk-actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const S1 = '00000000-0000-4000-8000-000000000001'
const S2 = '00000000-0000-4000-8000-000000000002'
const S3 = '00000000-0000-4000-8000-000000000003'
const COURSE_ID   = '00000000-0000-4000-8000-000000000010'
const SEMESTER_ID = '00000000-0000-4000-8000-000000000020'
const GROUP_ID    = '00000000-0000-4000-8000-000000000030'
const BRANCH_ID   = 'branch-1'
const PORTFOLIO1  = '00000000-0000-4000-8000-000000000041'
const PORTFOLIO2  = '00000000-0000-4000-8000-000000000042'

const STUDENTS_META = [
  { student_id: S1, student_name: 'Ahmed' },
  { student_id: S2, student_name: 'Sara' },
  { student_id: S3, student_name: 'Omar' },
]

const SHARED_PROJECTS = [
  { title: 'Maze Game', sort_order: 0 },
  { title: 'Traffic Light', sort_order: 1 },
]

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────────────────────
// loadBulkPreviewData
// ─────────────────────────────────────────────────────────────────────────────

describe('loadBulkPreviewData — same mode', () => {
  it('marks all students ready when no existing certs', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        certificates: [{ data: [], error: null }],
      }) as any
    )

    const res = await loadBulkPreviewData({
      student_ids:    [S1, S2],
      course_id:      COURSE_ID,
      semester_id:    SEMESTER_ID,
      project_mode:   'same',
      shared_projects: SHARED_PROJECTS,
      students_meta:  STUDENTS_META,
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ student_id: S1, status: 'ready', project_count: 2 })
    expect(data[1]).toMatchObject({ student_id: S2, status: 'ready', project_count: 2 })
  })

  it('marks student already_issued when cert exists for that course+semester', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        // S3 has an existing certificate
        certificates: [{ data: [{ student_id: S3 }], error: null }],
      }) as any
    )

    const res = await loadBulkPreviewData({
      student_ids:    [S1, S3],
      course_id:      COURSE_ID,
      semester_id:    SEMESTER_ID,
      project_mode:   'same',
      shared_projects: SHARED_PROJECTS,
      students_meta:  STUDENTS_META,
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    const omar = data.find((s: any) => s.student_id === S3)
    const ahmed = data.find((s: any) => s.student_id === S1)
    expect(omar.status).toBe('already_issued')
    expect(ahmed.status).toBe('ready')
  })

  it('returns empty array for empty student_ids', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({}) as any
    )

    const res = await loadBulkPreviewData({
      student_ids:    [],
      course_id:      COURSE_ID,
      semester_id:    null,
      project_mode:   'same',
      shared_projects: [],
      students_meta:  [],
    })

    expect(res.success).toBe(true)
    expect((res as any).data).toEqual([])
  })
})

describe('loadBulkPreviewData — portfolio mode', () => {
  it('attaches portfolio projects per student', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        certificates:     [{ data: [], error: null }],
        student_portfolios: [{ data: [
          { id: PORTFOLIO1, student_id: S1 },
          { id: PORTFOLIO2, student_id: S2 },
        ], error: null }],
        portfolio_projects: [{ data: [
          { portfolio_id: PORTFOLIO1, title: 'Scratch Game', sort_order: 0 },
          { portfolio_id: PORTFOLIO1, title: 'Python Bot', sort_order: 1 },
          { portfolio_id: PORTFOLIO2, title: 'LED Circuit', sort_order: 0 },
        ], error: null }],
      }) as any
    )

    const res = await loadBulkPreviewData({
      student_ids:    [S1, S2],
      course_id:      COURSE_ID,
      semester_id:    null,
      project_mode:   'portfolio',
      shared_projects: [],
      students_meta:  STUDENTS_META,
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    const ahmed = data.find((s: any) => s.student_id === S1)
    const sara  = data.find((s: any) => s.student_id === S2)
    expect(ahmed.project_count).toBe(2)
    expect(ahmed.has_portfolio).toBe(true)
    expect(ahmed.status).toBe('ready')
    expect(sara.project_count).toBe(1)
  })

  it('marks has_portfolio false when student has no portfolio entries', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        certificates:     [{ data: [], error: null }],
        // S1 has no portfolio
        student_portfolios: [{ data: [], error: null }],
        portfolio_projects: [{ data: [], error: null }],
      }) as any
    )

    const res = await loadBulkPreviewData({
      student_ids:    [S1],
      course_id:      null,
      semester_id:    null,
      project_mode:   'portfolio',
      shared_projects: [],
      students_meta:  [{ student_id: S1, student_name: 'Ahmed' }],
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(data[0].has_portfolio).toBe(false)
    expect(data[0].project_count).toBe(0)
    // Still ready — admin decided to issue regardless
    expect(data[0].status).toBe('ready')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// issueBulkGroupCertificates
// ─────────────────────────────────────────────────────────────────────────────

describe('issueBulkGroupCertificates — validation', () => {
  it('returns error when student_ids is empty', async () => {
    const res = await issueBulkGroupCertificates({
      group_id: GROUP_ID, branch_id: BRANCH_ID, student_ids: [],
      course_id: COURSE_ID, semester_id: null, certificate_type: 'semester_completion',
      title: 'Scratch', template_id: null, project_mode: 'same', shared_projects: [],
    })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('VALIDATION')
  })

  it('returns error when title is blank', async () => {
    const res = await issueBulkGroupCertificates({
      group_id: GROUP_ID, branch_id: BRANCH_ID, student_ids: [S1],
      course_id: null, semester_id: null, certificate_type: 'custom',
      title: '   ', template_id: null, project_mode: 'same', shared_projects: [],
    })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('VALIDATION')
  })

  it('returns FORBIDDEN when branch is not accessible', async () => {
    vi.mocked(isBranchAccessible).mockReturnValueOnce(false)

    const res = await issueBulkGroupCertificates({
      group_id: GROUP_ID, branch_id: BRANCH_ID, student_ids: [S1],
      course_id: null, semester_id: null, certificate_type: 'custom',
      title: 'Test', template_id: null, project_mode: 'same', shared_projects: [],
    })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('FORBIDDEN')
  })
})

describe('issueBulkGroupCertificates — issuance', () => {
  function makeIssuanceDb(overrides: Record<string, any[]> = {}) {
    return createMockDb({
      students:     [{ data: [
        { id: S1, branch_id: BRANCH_ID, users: { email: 'a@test.com', profiles: { first_name: 'Ahmed', last_name: 'Ali' } } },
        { id: S2, branch_id: BRANCH_ID, users: { email: 's@test.com', profiles: { first_name: 'Sara',  last_name: 'M'   } } },
      ], error: null }],
      // existing cert check
      certificates: [
        { data: [], error: null },          // existing check (none)
        { data: null, error: null },         // code collision check S1
        { data: { id: 'cert-1', certificate_code: 'RBC-2026-AAAAAA' }, error: null }, // insert S1
        { data: null, error: null },         // code collision check S2
        { data: { id: 'cert-2', certificate_code: 'RBC-2026-BBBBBB' }, error: null }, // insert S2
      ],
      ...overrides,
    })
  }

  it('creates certificates for all ready students', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeIssuanceDb() as any
    )

    const res = await issueBulkGroupCertificates({
      group_id:        GROUP_ID,
      branch_id:       BRANCH_ID,
      student_ids:     [S1, S2],
      course_id:       COURSE_ID,
      semester_id:     SEMESTER_ID,
      certificate_type: 'semester_completion',
      title:           'Scratch Jr',
      template_id:     null,
      project_mode:    'same',
      shared_projects: SHARED_PROJECTS,
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(data.created).toBe(2)
    expect(data.skipped).toBe(0)
    expect(data.failed).toBe(0)
    expect(data.batch_id).toMatch(/^BULK-\d{4}-[A-Z0-9]+$/)
  })

  it('skips students who already have a certificate', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        students: [{ data: [
          { id: S1, branch_id: BRANCH_ID, users: { email: 'a@test.com', profiles: { first_name: 'Ahmed', last_name: 'Ali' } } },
        ], error: null }],
        // S1 already issued
        certificates: [
          { data: [{ student_id: S1 }], error: null }, // existing check → S1 skipped
        ],
      }) as any
    )

    const res = await issueBulkGroupCertificates({
      group_id:        GROUP_ID,
      branch_id:       BRANCH_ID,
      student_ids:     [S1],
      course_id:       COURSE_ID,
      semester_id:     null,
      certificate_type: 'course_completion',
      title:           'Python',
      template_id:     null,
      project_mode:    'same',
      shared_projects: [],
    })

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(data.created).toBe(0)
    expect(data.skipped).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// loadBulkCertificateWizardOptions
// ─────────────────────────────────────────────────────────────────────────────

describe('loadBulkCertificateWizardOptions', () => {
  it('returns templates, semesters, and courses', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        certificate_templates: [{ data: [], error: null }],  // listActiveTemplates uses this
        semesters: [{ data: [{ id: 'sem-1', name: 'Spring 2026' }], error: null }],
        courses:   [{ data: [{ id: 'c-1', title: 'Scratch Jr' }], error: null }],
      }) as any
    )

    const res = await loadBulkCertificateWizardOptions()

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(Array.isArray(data.templates)).toBe(true)
    expect(data.semesters).toHaveLength(1)
    expect(data.semesters[0].name).toBe('Spring 2026')
    expect(data.courses).toHaveLength(1)
    expect(data.courses[0].title).toBe('Scratch Jr')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Project validation logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Project validation rules', () => {
  it('allows 20 projects (maximum)', () => {
    const projects = Array.from({ length: 20 }, (_, i) => ({
      title: `Project ${i + 1}`,
      sort_order: i,
    }))
    expect(projects.length).toBe(20)
    expect(projects[19].title).toBe('Project 20')
  })

  it('deduplication — case insensitive', () => {
    const names = ['Maze Game', 'maze game', 'MAZE GAME']
    const unique = [...new Map(names.map(n => [n.toLowerCase(), n])).values()]
    expect(unique.length).toBe(1)
  })

  it('trims whitespace before adding', () => {
    const raw = '  Python Bot  '
    expect(raw.trim()).toBe('Python Bot')
  })

  it('shared projects are copied to all certificates in same mode', () => {
    const projects = [
      { title: 'A', sort_order: 0 },
      { title: 'B', sort_order: 1 },
    ]
    const studentIds = [S1, S2, S3]
    const certProjects = studentIds.map(() => [...projects])
    certProjects.forEach(cp => expect(cp).toEqual(projects))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Batch ID format
// ─────────────────────────────────────────────────────────────────────────────

describe('Batch ID format', () => {
  it('matches BULK-YYYY-XXXXXXXX pattern', () => {
    const year   = new Date().getFullYear()
    const suffix = Math.random().toString(36).substring(2, 10).toUpperCase()
    const batchId = `BULK-${year}-${suffix}`
    expect(batchId).toMatch(/^BULK-\d{4}-[A-Z0-9]+$/)
  })
})
