import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../helpers/mock-db'

let mockDb: ReturnType<typeof createMockDb>

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => mockDb),
}))

import {
  resolveProgressFromAssignment,
  resolveGroupProgressContext,
} from '@/modules/progress/resolve'

// ── Shared fixture data ───────────────────────────────────────────────────────

const STUDENT_ID = 'student-1'
const ASSIGNMENT_ID = 'assignment-1'
const GROUP_ID = 'group-1'
const COURSE_ID = 'course-1'
const SEMESTER_ID = 'semester-1'

// Shared tail of the resolveProgressFromCourse chain:
// group_courses → group_students → groups
function courseChainQueues(groupId = GROUP_ID, semesterId = SEMESTER_ID) {
  return {
    group_courses:  [{ data: [{ group_id: groupId }], error: null }],
    group_students: [{ data: { group_id: groupId }, error: null }],
    groups:         [{ data: { semester_id: semesterId }, error: null }],
  }
}

describe('resolveProgressFromAssignment', () => {
  beforeEach(() => { mockDb = createMockDb({}) })

  it('resolves tuple from a module-linked assignment', async () => {
    mockDb = createMockDb({
      assignments: [{
        data: {
          module_id: 'm1',
          lesson_id: null,
          course_modules: { course_id: COURSE_ID },
          lessons: null,
        },
        error: null,
      }],
      ...courseChainQueues(),
    })

    const result = await resolveProgressFromAssignment(STUDENT_ID, ASSIGNMENT_ID)
    expect(result).toEqual({
      studentId:  STUDENT_ID,
      courseId:   COURSE_ID,
      semesterId: SEMESTER_ID,
      groupId:    GROUP_ID,
    })
  })

  it('resolves tuple from a lesson-linked assignment', async () => {
    mockDb = createMockDb({
      assignments: [{
        data: {
          module_id: null,
          lesson_id: 'l1',
          course_modules: null,
          lessons: { course_modules: { course_id: COURSE_ID } },
        },
        error: null,
      }],
      ...courseChainQueues(),
    })

    const result = await resolveProgressFromAssignment(STUDENT_ID, ASSIGNMENT_ID)
    expect(result).toEqual({
      studentId:  STUDENT_ID,
      courseId:   COURSE_ID,
      semesterId: SEMESTER_ID,
      groupId:    GROUP_ID,
    })
  })

  it('returns null when the assignment does not exist', async () => {
    mockDb = createMockDb({
      assignments: [{ data: null, error: null }],
    })
    const result = await resolveProgressFromAssignment(STUDENT_ID, ASSIGNMENT_ID)
    expect(result).toBeNull()
  })

  it('returns null when the student is not enrolled in any active group', async () => {
    mockDb = createMockDb({
      assignments: [{
        data: {
          module_id: 'm1',
          lesson_id: null,
          course_modules: { course_id: COURSE_ID },
          lessons: null,
        },
        error: null,
      }],
      group_courses:  [{ data: [{ group_id: GROUP_ID }], error: null }],
      group_students: [{ data: null, error: null }],   // not enrolled
    })
    const result = await resolveProgressFromAssignment(STUDENT_ID, ASSIGNMENT_ID)
    expect(result).toBeNull()
  })

  it('returns null when the assignment has no course context', async () => {
    mockDb = createMockDb({
      assignments: [{
        data: {
          module_id: null,
          lesson_id: null,
          course_modules: null,
          lessons: null,
        },
        error: null,
      }],
    })
    const result = await resolveProgressFromAssignment(STUDENT_ID, ASSIGNMENT_ID)
    expect(result).toBeNull()
  })
})

describe('resolveGroupProgressContext', () => {
  beforeEach(() => { mockDb = createMockDb({}) })

  it('returns one context per active group_course', async () => {
    mockDb = createMockDb({
      group_courses: [{ data: [{ course_id: 'c1' }, { course_id: 'c2' }], error: null }],
      groups:        [{ data: { semester_id: SEMESTER_ID }, error: null }],
    })

    const result = await resolveGroupProgressContext(GROUP_ID)
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ courseId: 'c1', semesterId: SEMESTER_ID, groupId: GROUP_ID })
    expect(result).toContainEqual({ courseId: 'c2', semesterId: SEMESTER_ID, groupId: GROUP_ID })
  })

  it('returns an empty array when the group has no active courses', async () => {
    mockDb = createMockDb({
      group_courses: [{ data: [], error: null }],
    })
    const result = await resolveGroupProgressContext(GROUP_ID)
    expect(result).toHaveLength(0)
  })

  it('returns an empty array when the group has no semester', async () => {
    mockDb = createMockDb({
      group_courses: [{ data: [{ course_id: 'c1' }], error: null }],
      groups:        [{ data: { semester_id: null }, error: null }],
    })
    const result = await resolveGroupProgressContext(GROUP_ID)
    expect(result).toHaveLength(0)
  })
})
