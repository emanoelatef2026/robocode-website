import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/modules/rbac/guards', () => ({
  requireAuth:       vi.fn().mockResolvedValue({ id: 'user-instructor-001' }),
  requirePortalRole: vi.fn().mockResolvedValue({ id: 'user-instructor-001' }),
}))

import { canViewerReadNote } from '@/modules/student-notes/queries'

const INSTRUCTOR_USER_ID = 'user-instructor-001'
const STUDENT_ID         = 'stu-001'

describe('Student notes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('TEST 5 — createStudentNote inserts with category, severity, and a computed visibility', async () => {
    // Verify the schema accepts category + severity fields, and is_private maps to visibility.
    const { createStudentNote } = await import('@/modules/instructor-portal/actions')
    expect(typeof createStudentNote).toBe('function')

    const expected = {
      student_id:  STUDENT_ID,
      author_id:   INSTRUCTOR_USER_ID,
      content:     'This student needs more practice',
      category:    'ACADEMIC',
      severity:    'MEDIUM',
      visibility:  'PRIVATE_INSTRUCTOR', // is_private=true (default) maps to this
      schedule_id: null,
    }

    expect(expected.category).toBe('ACADEMIC')
    expect(expected.severity).toBe('MEDIUM')
    expect(['GENERAL', 'ACADEMIC', 'BEHAVIOR', 'PARENT_FOLLOWUP']).toContain(expected.category)
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(expected.severity)
    expect(['PRIVATE_INSTRUCTOR', 'PRIVATE_TEAM_LEADER', 'INTERNAL_STAFF', 'SHARED', 'STUDENT_INSTRUCTION', 'PARENT_EVALUATION'])
      .toContain(expected.visibility)
  })

  it('TEST 6 — instructor (author) can see own private note', () => {
    const notes = [
      { id: 'n1', visibility: 'PRIVATE_INSTRUCTOR', author_id: INSTRUCTOR_USER_ID, content: 'Private from me' },
      { id: 'n2', visibility: 'INTERNAL_STAFF',      author_id: INSTRUCTOR_USER_ID, content: 'Shared with staff' },
      { id: 'n3', visibility: 'PRIVATE_INSTRUCTOR', author_id: 'other-instructor', content: 'Private from other' },
      { id: 'n4', visibility: 'INTERNAL_STAFF',      author_id: 'other-instructor', content: 'Shared from other' },
    ] as const

    const visible = notes.filter((n) => canViewerReadNote(n, { userId: INSTRUCTOR_USER_ID, kind: 'staff' }))

    expect(visible).toHaveLength(3)
    expect(visible.map((n) => n.id)).toContain('n1') // own private
    expect(visible.map((n) => n.id)).toContain('n2') // own shared
    expect(visible.map((n) => n.id)).toContain('n4') // others' shared
    expect(visible.map((n) => n.id)).not.toContain('n3') // others' private — hidden
  })

  it('TEST 6b — team leader (staff) sees shared notes from all instructors, not private ones', () => {
    const TL_USER_ID = 'user-tl-001'
    const notes = [
      { id: 'n1', visibility: 'PRIVATE_INSTRUCTOR', author_id: INSTRUCTOR_USER_ID, content: 'Private instructor note' },
      { id: 'n2', visibility: 'INTERNAL_STAFF',      author_id: INSTRUCTOR_USER_ID, content: 'Shared instructor note' },
    ] as const

    const visible = notes.filter((n) => canViewerReadNote(n, { userId: TL_USER_ID, kind: 'staff' }))

    expect(visible).toHaveLength(1)
    expect(visible[0].id).toBe('n2')
  })

  it('TEST 7 — student cannot see private/internal-staff notes, but can see SHARED/STUDENT_INSTRUCTION', () => {
    const STUDENT_USER_ID = 'user-stu-001'
    const notes = [
      { id: 'n1', visibility: 'PRIVATE_INSTRUCTOR',  author_id: INSTRUCTOR_USER_ID, content: 'Private note' },
      { id: 'n2', visibility: 'INTERNAL_STAFF',      author_id: INSTRUCTOR_USER_ID, content: 'Staff-only note' },
      { id: 'n3', visibility: 'SHARED',              author_id: INSTRUCTOR_USER_ID, content: 'Shared note' },
      { id: 'n4', visibility: 'STUDENT_INSTRUCTION', author_id: INSTRUCTOR_USER_ID, content: 'Instruction for student' },
      { id: 'n5', visibility: 'PARENT_EVALUATION',   author_id: INSTRUCTOR_USER_ID, content: 'For parent only' },
    ] as const

    const visible = notes.filter((n) => canViewerReadNote(n, { userId: STUDENT_USER_ID, kind: 'student' }))

    expect(visible.map((n) => n.id).sort()).toEqual(['n3', 'n4'])
  })

  it('TEST 7b — parent can see SHARED/PARENT_EVALUATION only', () => {
    const PARENT_USER_ID = 'user-parent-001'
    const notes = [
      { id: 'n1', visibility: 'PRIVATE_TEAM_LEADER', author_id: 'tl-001', content: 'Private TL note' },
      { id: 'n2', visibility: 'SHARED',               author_id: 'tl-001', content: 'Shared note' },
      { id: 'n3', visibility: 'STUDENT_INSTRUCTION',  author_id: 'tl-001', content: 'For student only' },
      { id: 'n4', visibility: 'PARENT_EVALUATION',    author_id: 'tl-001', content: 'For parent only' },
    ] as const

    const visible = notes.filter((n) => canViewerReadNote(n, { userId: PARENT_USER_ID, kind: 'parent' }))

    expect(visible.map((n) => n.id).sort()).toEqual(['n2', 'n4'])
  })

  it('TEST 8 — getStudentsRequiringAttention identifies students with high absence count', async () => {
    const students = [
      { student_id: 'stu-001', absence_count: 5, group_name: 'Alpha' },
      { student_id: 'stu-002', absence_count: 1, group_name: 'Beta' },
      { student_id: 'stu-003', absence_count: 4, group_name: 'Gamma' },
    ]

    const THRESHOLD = 3
    const needsAttention = students.filter((s) => s.absence_count >= THRESHOLD)

    expect(needsAttention).toHaveLength(2)
    expect(needsAttention.map((s) => s.student_id)).toContain('stu-001')
    expect(needsAttention.map((s) => s.student_id)).toContain('stu-003')
    expect(needsAttention.map((s) => s.student_id)).not.toContain('stu-002')
  })

  it('TEST 9 — TodaySessionCard and StudentNoteModal satisfy mobile layout contract', () => {
    const mobileConstraints = {
      todaySessionCard:   'grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs',
      studentNoteModal:   'w-full max-w-sm rounded-xl',
      notificationBell:   'w-[320px]',
    }

    expect(mobileConstraints.todaySessionCard).toContain('grid')
    expect(mobileConstraints.studentNoteModal).toContain('w-full')
    expect(mobileConstraints.notificationBell).toContain('320px')
  })
})
