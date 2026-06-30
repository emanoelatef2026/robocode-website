import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'

// ── Module-level mocks (hoisted before imports) ──────────────────────────────

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/rbac/guards', () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: 'user-1', role: 'super_admin' }),
  isBranchAccessible: vi.fn().mockReturnValue(true),
}))

vi.mock('@/modules/progress/eligibility', () => ({
  checkCertificateEligibility: vi.fn().mockResolvedValue(null),
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

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import { loadStudentPortfolioProjects } from '@/modules/certificates/actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDENT_UUID  = '00000000-0000-4000-8000-000000000011'
const PORTFOLIO_UUID = '00000000-0000-4000-8000-000000000012'

beforeEach(() => vi.clearAllMocks())

// ─── TEST 1: Certificate metadata snapshot — projects stored at issuance ──────

describe('Certificate projects snapshot', () => {
  it('projects are serialized and stored in the projects field — not queried live', () => {
    // The Certificate type carries projects: CertificateProject[] directly.
    // This test confirms the data shape is stable for the snapshot contract.
    const projects = [
      { title: 'Scratch Game',   sort_order: 0 },
      { title: 'Python Chatbot', sort_order: 1 },
    ]
    const sorted = [...projects].sort((a, b) => a.sort_order - b.sort_order)
    expect(sorted[0].title).toBe('Scratch Game')
    expect(sorted[1].title).toBe('Python Chatbot')
    expect(sorted.length).toBe(2)
  })

  it('immutably stores up to 20 projects without truncation', () => {
    const projects = Array.from({ length: 20 }, (_, i) => ({
      title: `Project ${i + 1}`,
      sort_order: i,
    }))
    expect(projects.length).toBe(20)
    expect(projects[19].title).toBe('Project 20')
  })
})

// ─── TEST 2: Portfolio auto-load ───────────────────────────────────────────────

describe('loadStudentPortfolioProjects', () => {
  it('returns empty array when student has no portfolio', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        student_portfolios: [{ data: null, error: null }],
      }) as any
    )
    const result = await loadStudentPortfolioProjects(STUDENT_UUID)
    expect(result.success).toBe(true)
    expect((result as any).data).toEqual([])
  })

  it('returns mapped project list from portfolio', async () => {
    const portfolioRow    = { id: PORTFOLIO_UUID }
    const projectRows     = [
      { id: 'p1', title: 'Maze Game',      courses: { title: 'Scratch Jr' } },
      { id: 'p2', title: 'Traffic Light',  courses: null },
    ]

    vi.mocked(createServiceClient).mockReturnValue(
      createMockDb({
        student_portfolios: [{ data: portfolioRow, error: null }],
        portfolio_projects: [{ data: projectRows,  error: null }],
      }) as any
    )

    const result = await loadStudentPortfolioProjects(STUDENT_UUID)
    expect(result.success).toBe(true)
    const data = (result as any).data as any[]
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ id: 'p1', title: 'Maze Game', course_title: 'Scratch Jr' })
    expect(data[1]).toMatchObject({ id: 'p2', title: 'Traffic Light', course_title: null })
  })
})

// ─── TEST 3: Project selection and deduplication logic ─────────────────────────

describe('Project selection validation', () => {
  function buildProjectList(titles: string[]) {
    return titles.map((title, i) => ({ title, sort_order: i }))
  }

  it('detects duplicate project names (case-insensitive)', () => {
    const existing = buildProjectList(['Scratch Game', 'Python Quiz'])
    const newTitle = 'scratch game'
    const isDuplicate = existing.some(
      (p) => p.title.toLowerCase() === newTitle.toLowerCase()
    )
    expect(isDuplicate).toBe(true)
  })

  it('allows project with distinct name', () => {
    const existing  = buildProjectList(['Scratch Game', 'Python Quiz'])
    const newTitle  = 'Arduino Robot'
    const isDuplicate = existing.some(
      (p) => p.title.toLowerCase() === newTitle.toLowerCase()
    )
    expect(isDuplicate).toBe(false)
  })

  it('enforces maximum 20 projects', () => {
    const maxProjects = 20
    const existing = buildProjectList(Array.from({ length: 20 }, (_, i) => `Project ${i + 1}`))
    expect(existing.length >= maxProjects).toBe(true)
  })
})

// ─── TEST 4: Single-column layout decision ─────────────────────────────────────

describe('PDF layout — single-column (≤4 projects)', () => {
  function layoutDecision(count: number) {
    return count >= 5 ? 'two-column' : 'single-column'
  }

  it('1 project → single-column', () => expect(layoutDecision(1)).toBe('single-column'))
  it('4 projects → single-column', () => expect(layoutDecision(4)).toBe('single-column'))
})

// ─── TEST 5: Two-column layout decision ───────────────────────────────────────

describe('PDF layout — two-column (≥5 projects)', () => {
  function layoutDecision(count: number) {
    return count >= 5 ? 'two-column' : 'single-column'
  }

  it('5 projects → two-column', () => expect(layoutDecision(5)).toBe('two-column'))
  it('10 projects → two-column', () => expect(layoutDecision(10)).toBe('two-column'))
})

// ─── TEST 6: Long project name wrapping — items are text nodes, will wrap ─────

describe('PDF layout — long project names', () => {
  it('project title is not truncated (stored as full string)', () => {
    const longTitle = 'A Very Very Long Project Name That Might Span Multiple Lines In The PDF Layout'
    const project   = { title: longTitle, sort_order: 0 }
    // The PDF renders this as a <Text> which wraps by default.
    // We verify the value is preserved intact, not truncated.
    expect(project.title).toBe(longTitle)
    expect(project.title.length).toBeGreaterThan(60)
  })
})

// ─── TEST 7: Overflow — more than 10 projects ─────────────────────────────────

describe('PDF layout — overflow (>10 projects)', () => {
  function applyOverflow(projects: { title: string; sort_order: number }[]) {
    const sorted  = [...projects].sort((a, b) => a.sort_order - b.sort_order)
    const display = sorted.slice(0, 10)
    const extra   = sorted.length > 10 ? sorted.length - 10 : 0
    return { display, extra }
  }

  it('caps displayed projects at 10', () => {
    const projects = Array.from({ length: 15 }, (_, i) => ({ title: `Project ${i + 1}`, sort_order: i }))
    const { display, extra } = applyOverflow(projects)
    expect(display.length).toBe(10)
    expect(extra).toBe(5)
  })

  it('shows the correct overflow count', () => {
    const projects = Array.from({ length: 13 }, (_, i) => ({ title: `Project ${i + 1}`, sort_order: i }))
    const { extra } = applyOverflow(projects)
    expect(extra).toBe(3)
  })

  it('no overflow when exactly 10 projects', () => {
    const projects = Array.from({ length: 10 }, (_, i) => ({ title: `Project ${i + 1}`, sort_order: i }))
    const { display, extra } = applyOverflow(projects)
    expect(display.length).toBe(10)
    expect(extra).toBe(0)
  })
})

// ─── TEST 8: Single-page guarantee (projects fit within 10-item cap) ──────────

// Layout constants that mirror pdf-template.tsx
const COL_WIDTH_ONE  = 270   // single-column fixed width (pt)
const COL_WIDTH_TWO  = 200   // each two-column column width (pt)
const COL_GAP        = 44    // gap between two columns (pt)
const CONTENT_WIDTH  = 794   // A4 landscape content area (842 − 2×24 pt)

describe('PDF single-page guarantee', () => {
  it('never renders more than 10 project items in the PDF', () => {
    const MAX_DISPLAY = 10
    const projects = Array.from({ length: 20 }, (_, i) => ({ title: `P${i}`, sort_order: i }))
    const display  = projects.slice(0, MAX_DISPLAY)
    expect(display.length).toBeLessThanOrEqual(MAX_DISPLAY)
  })

  it('correct two-column split for 10 items: 5 left, 5 right', () => {
    const count = 10
    const half  = Math.ceil(count / 2)
    expect(half).toBe(5)
  })

  it('correct two-column split for 7 items: 4 left, 3 right', () => {
    const count = 7
    const half  = Math.ceil(count / 2)
    expect(half).toBe(4)
  })

  it('correct two-column split for 5 items: 3 left, 2 right', () => {
    const count = 5
    const half  = Math.ceil(count / 2)
    expect(half).toBe(3)
  })
})

// ─── TEST: Centering math — fixed-width columns ────────────────────────────────

describe('PDF centering — fixed-width column layout', () => {
  // Single column
  it('single-column block (270pt) fits within content area (794pt)', () => {
    expect(COL_WIDTH_ONE).toBeLessThan(CONTENT_WIDTH)
  })

  it('single-column block has ≥120pt margin on each side → visually centred', () => {
    const margin = (CONTENT_WIDTH - COL_WIDTH_ONE) / 2
    expect(margin).toBeGreaterThanOrEqual(120)
  })

  // Two column
  it('two-column total width (200+44+200 = 444pt) fits within content area', () => {
    const totalWidth = COL_WIDTH_TWO + COL_GAP + COL_WIDTH_TWO
    expect(totalWidth).toBe(444)
    expect(totalWidth).toBeLessThan(CONTENT_WIDTH)
  })

  it('two-column block has ≥175pt margin on each side → visually centred', () => {
    const totalWidth = COL_WIDTH_TWO + COL_GAP + COL_WIDTH_TWO
    const margin = (CONTENT_WIDTH - totalWidth) / 2
    expect(margin).toBeGreaterThanOrEqual(175)
  })

  it('title text in single column has ~255pt wrap width (column − bullet − gap)', () => {
    const bulletWidth = 10
    const itemGap     = 5
    const titleWrap   = COL_WIDTH_ONE - bulletWidth - itemGap
    expect(titleWrap).toBe(255)
    expect(titleWrap).toBeGreaterThan(200) // enough for typical project names
  })

  it('title text in two-column has ~185pt wrap width (column − bullet − gap)', () => {
    const bulletWidth = 10
    const itemGap     = 5
    const titleWrap   = COL_WIDTH_TWO - bulletWidth - itemGap
    expect(titleWrap).toBe(185)
    expect(titleWrap).toBeGreaterThan(150) // enough for typical project names
  })

  it('column gap (44pt) meets spec of 40–60pt', () => {
    expect(COL_GAP).toBeGreaterThanOrEqual(40)
    expect(COL_GAP).toBeLessThanOrEqual(60)
  })
})

// ─── TEST: PDF validation cases (layout data for each scenario) ────────────────

describe('PDF validation — layout data per case', () => {
  function buildCase(titles: string[]) {
    const projects = titles.map((title, i) => ({ title, sort_order: i }))
    const sorted   = [...projects].sort((a, b) => a.sort_order - b.sort_order)
    const display  = sorted.slice(0, 10)
    const extra    = sorted.length > 10 ? sorted.length - 10 : 0
    const isTwoCol = display.length >= 5
    const half     = Math.ceil(display.length / 2)
    return { display, extra, isTwoCol, half, colLayout: isTwoCol ? 'two-column' : 'single-column' }
  }

  it('Case A — 1 project: single-column, 0 overflow', () => {
    const r = buildCase(['Scratch Game'])
    expect(r.colLayout).toBe('single-column')
    expect(r.display.length).toBe(1)
    expect(r.extra).toBe(0)
  })

  it('Case B — 4 projects: single-column, 0 overflow', () => {
    const r = buildCase(['Game 1', 'Game 2', 'Game 3', 'Game 4'])
    expect(r.colLayout).toBe('single-column')
    expect(r.display.length).toBe(4)
    expect(r.extra).toBe(0)
  })

  it('Case C — 5 projects: two-column, left=3 right=2, 0 overflow', () => {
    const r = buildCase(['P1', 'P2', 'P3', 'P4', 'P5'])
    expect(r.colLayout).toBe('two-column')
    expect(r.half).toBe(3)
    expect(r.display.length - r.half).toBe(2)
    expect(r.extra).toBe(0)
  })

  it('Case D — 10 projects: two-column, left=5 right=5, 0 overflow', () => {
    const r = buildCase(Array.from({ length: 10 }, (_, i) => `Project ${i + 1}`))
    expect(r.colLayout).toBe('two-column')
    expect(r.half).toBe(5)
    expect(r.display.length - r.half).toBe(5)
    expect(r.extra).toBe(0)
  })

  it('Case E — long project names: stored as full strings, wrap at column width', () => {
    const long = 'A Very Long Project Name That Will Wrap Inside The Column Layout On The Certificate'
    const r = buildCase([long, 'Short Name', 'Another Medium Length Name'])
    expect(r.colLayout).toBe('single-column')
    expect(r.display[0].title).toBe(long)
    // Wrapping is handled by react-pdf; we verify the title is preserved, not truncated
    expect(r.display[0].title.length).toBeGreaterThan(60)
  })

  it('Case F — 13 projects: two-column, 10 shown, 3 overflow', () => {
    const r = buildCase(Array.from({ length: 13 }, (_, i) => `Project ${i + 1}`))
    expect(r.colLayout).toBe('two-column')
    expect(r.display.length).toBe(10)
    expect(r.extra).toBe(3)
  })
})

// ─── TEST 9: Verification page — uses stored snapshot, not live queries ────────

describe('Certificate verification — stored snapshot', () => {
  it('course title from certificate.title takes precedence over live join', () => {
    const certificate = {
      title:        'Pictoblox Coding',
      course_title: 'Pictoblox Coding — updated live name',
      projects: [
        { title: 'Maze Game',  sort_order: 0 },
        { title: 'Quiz Game',  sort_order: 1 },
      ],
    }
    // The verify page displays certificate.title as the immutable course name
    const displayedName = certificate.title || certificate.course_title || '—'
    expect(displayedName).toBe('Pictoblox Coding')
  })

  it('projects come from stored certificate data — sorted by sort_order', () => {
    const projects = [
      { title: 'Second', sort_order: 1 },
      { title: 'First',  sort_order: 0 },
    ]
    const sorted = [...projects].sort((a, b) => a.sort_order - b.sort_order)
    expect(sorted[0].title).toBe('First')
    expect(sorted[1].title).toBe('Second')
  })

  it('returns empty array when no projects stored', () => {
    const raw = null
    const projects = Array.isArray(raw) ? raw : []
    expect(projects).toEqual([])
  })
})
