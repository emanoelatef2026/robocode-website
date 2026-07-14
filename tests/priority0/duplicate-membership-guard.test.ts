import { describe, it, expect, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import type { MockResult } from '../helpers/mock-db'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({
  requirePermission:   vi.fn().mockResolvedValue({ id: 'user-test' }),
  isBranchAccessible:  vi.fn().mockReturnValue(true),
}))
vi.mock('@/modules/progress/resolve', () => ({
  resolveGroupProgressContext: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/modules/progress/safe-recalc', () => ({
  safeRecalcProgressBatch: vi.fn().mockResolvedValue(undefined),
  buildBatchTuples:        vi.fn().mockReturnValue([]),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  resolveGroupCourseId,
  closeSameCourseGroupMemberships,
  findActiveEnrollmentForCourse,
  resolvePrimaryActiveGroupId,
} from '@/modules/academic/enrollment-integrity'
import { bulkEnrollStudents } from '@/modules/groups/actions'
import { createEnrollment } from '@/modules/enrollments/actions'

function mockDb(queues: Record<string, MockResult[]>) {
  const db = createMockDb(queues)
  ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)
  return db
}

// ── resolveGroupCourseId ───────────────────────────────────────────────────────

describe('resolveGroupCourseId', () => {
  it('returns the course_id of the group\'s active group_courses row', async () => {
    const db = mockDb({
      group_courses: [{ data: { course_id: 'course-python' }, error: null }],
    })
    const courseId = await resolveGroupCourseId(db as any, 'group-1')
    expect(courseId).toBe('course-python')
  })

  it('returns null when the group has no active group_courses row', async () => {
    const db = mockDb({
      group_courses: [{ data: null, error: null }],
    })
    const courseId = await resolveGroupCourseId(db as any, 'group-1')
    expect(courseId).toBeNull()
  })
})

// ── closeSameCourseGroupMemberships ────────────────────────────────────────────
// This is the function that must distinguish valid concurrent enrollments
// (different course — e.g. Python + Robotics, STU-000072 in the diagnostic)
// from invalid duplicate memberships (same course, different group).

describe('closeSameCourseGroupMemberships', () => {
  it('short-circuits with no DB calls when courseId is null (group has no active course)', async () => {
    const db = mockDb({})
    const closed = await closeSameCourseGroupMemberships(db as any, {
      studentId: 'stu-1', courseId: null, excludeGroupId: 'group-new', reason: 'test',
    })
    expect(closed).toEqual([])
    expect(db.from).not.toHaveBeenCalled()
  })

  it('VALID concurrent case: leaves a different-course membership untouched', async () => {
    // Student's only other active membership teaches a different course —
    // the query for conflicting (same-course) rows correctly finds none.
    const db = mockDb({
      group_students: [{ data: [], error: null }],
    })
    const closed = await closeSameCourseGroupMemberships(db as any, {
      studentId: 'stu-1', courseId: 'course-python', excludeGroupId: 'group-new', reason: 'test',
    })
    expect(closed).toEqual([])
    // Only the lookup ran — no update call was queued/consumed because nothing conflicted.
    expect(db.from).toHaveBeenCalledTimes(1)
  })

  it('INVALID duplicate case: closes a same-course membership in a different group', async () => {
    // Student holds an active row in group "old-group" teaching the SAME course
    // as the group they're being added to — this is the "Python Spring +
    // Python Summer" pattern and must be closed, not left duplicated.
    const db = mockDb({
      group_students: [
        { data: [{ id: 'gs-old', notes: null }], error: null }, // conflicting row found
        { data: null, error: null },                            // the close/update call
      ],
    })
    const closed = await closeSameCourseGroupMemberships(db as any, {
      studentId: 'stu-1', courseId: 'course-python', excludeGroupId: 'group-new', reason: 'Superseded.',
    })
    expect(closed).toEqual(['gs-old'])
    expect(db.from).toHaveBeenCalledTimes(2)
  })
})

// ── findActiveEnrollmentForCourse ───────────────────────────────────────────────

describe('findActiveEnrollmentForCourse', () => {
  it('returns null immediately when courseId is null', async () => {
    const db = mockDb({})
    const existing = await findActiveEnrollmentForCourse(db as any, 'stu-1', null)
    expect(existing).toBeNull()
    expect(db.from).not.toHaveBeenCalled()
  })

  it('returns the existing ACTIVE enrollment for this student+course, if any', async () => {
    const db = mockDb({
      student_enrollments: [{ data: { id: 'enr-existing' }, error: null }],
    })
    const existing = await findActiveEnrollmentForCourse(db as any, 'stu-1', 'course-python')
    expect(existing).toEqual({ id: 'enr-existing' })
  })

  it('returns null when no ACTIVE enrollment exists for this student+course', async () => {
    const db = mockDb({
      student_enrollments: [{ data: null, error: null }],
    })
    const existing = await findActiveEnrollmentForCourse(db as any, 'stu-1', 'course-python')
    expect(existing).toBeNull()
  })
})

// ── resolvePrimaryActiveGroupId ─────────────────────────────────────────────────
// The deterministic replacement for the `order('joined_at', {ascending:false})
// .limit(1)` pattern repeated across student/parent-portal dashboard queries.

describe('resolvePrimaryActiveGroupId', () => {
  it('returns the resolved group_id when an active membership exists', async () => {
    const db = mockDb({
      group_students: [{ data: { group_id: 'group-1' }, error: null }],
    })
    const groupId = await resolvePrimaryActiveGroupId(db as any, 'stu-1')
    expect(groupId).toBe('group-1')
  })

  it('returns null when the student has no active membership', async () => {
    const db = mockDb({
      group_students: [{ data: null, error: null }],
    })
    const groupId = await resolvePrimaryActiveGroupId(db as any, 'stu-1')
    expect(groupId).toBeNull()
  })
})

// ── bulkEnrollStudents — group assignment integration ───────────────────────────

describe('bulkEnrollStudents — same-course guard wiring', () => {
  function formData(groupId: string, studentIds: string[]) {
    const fd = new FormData()
    fd.set('group_id', groupId)
    fd.set('enrollment_type', 'primary')
    for (const id of studentIds) fd.append('student_ids', id)
    return fd
  }

  it('VALID: bulk-adds a student with no conflicting same-course membership', async () => {
    const db = mockDb({
      groups:   [{ data: { branch_id: 'br-1', capacity: null }, error: null }],
      students: [{ data: [{ id: 'stu-1', student_code: 'STU-1', branch_id: 'br-1' }], error: null }],
      group_courses: [{ data: { course_id: 'course-python' }, error: null }], // resolveGroupCourseId
      group_students: [
        { data: [], error: null },              // closeSameCourseGroupMemberships: no conflicts
        { data: { id: 'gs-new' }, error: null }, // the insert
      ],
    })

    const result = await bulkEnrollStudents(undefined, formData('group-new', ['stu-1']))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enrolled).toBe(1)
      expect(result.data.skipped).toBe(0)
    }
  })

  it('INVALID: closes a same-course membership in another group before adding the new one', async () => {
    const db = mockDb({
      groups:   [{ data: { branch_id: 'br-1', capacity: null }, error: null }],
      students: [{ data: [{ id: 'stu-1', student_code: 'STU-1', branch_id: 'br-1' }], error: null }],
      group_courses: [{ data: { course_id: 'course-python' }, error: null }],
      group_students: [
        { data: [{ id: 'gs-old', notes: null }], error: null }, // conflicting same-course row found
        { data: null, error: null },                            // it gets closed
        { data: { id: 'gs-new' }, error: null },                 // the new membership is created
      ],
    })

    const result = await bulkEnrollStudents(undefined, formData('group-new', ['stu-1']))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enrolled).toBe(1)
    }
    // 3 group_students calls consumed: conflict lookup, close, insert.
    expect(db.from.mock.calls.filter(c => c[0] === 'group_students')).toHaveLength(3)
  })
})

// ── createEnrollment — enrollment creation idempotency ──────────────────────────

describe('createEnrollment — duplicate-enrollment guard', () => {
  it('reuses an existing ACTIVE enrollment for the same student+course instead of inserting a duplicate', async () => {
    const db = mockDb({
      group_courses: [
        { data: { id: 'gc-1', course_id: 'course-python', instructor_id: null }, error: null },
      ],
      group_students: [
        { data: [], error: null },              // closeSameCourseGroupMemberships: no conflicts
        { data: { id: 'gs-1' }, error: null },   // upsert result
      ],
      student_enrollments: [
        { data: { id: 'enr-existing' }, error: null }, // findActiveEnrollmentForCourse hit
      ],
    })

    const result = await createEnrollment({
      student_id: 'stu-1',
      branch_id:  'br-1', // truthy — skips the "resolve branch from group" lookup entirely
      group_id:   'group-1',
    } as any)

    expect(result.enrollmentId).toBe('enr-existing')
    // Only one student_enrollments call happened (the idempotency lookup) — no
    // insert followed it, confirming the duplicate was avoided rather than created
    // and then caught after the fact.
    expect(db.from.mock.calls.filter(c => c[0] === 'student_enrollments')).toHaveLength(1)
  })
})
