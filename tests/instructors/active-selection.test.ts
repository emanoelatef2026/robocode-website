import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorFilterOptions } from '@/modules/query-standards'
import { getInstructorAvailabilityError, isActiveInstructor } from '@/modules/instructors/availability'
import { assignGroupCourseService } from '@/modules/groups/assignment-service'
import { addGroupAllocationAction } from '@/modules/groups/allocation-actions'
import { assignGroupsModalAction } from '@/modules/instructors/modal-actions'
import { createGroupModal, updateGroupModal } from '@/modules/groups/actions/group-crud'
import { createTrialSession, createMakeupSession, bulkBookTrialFromLeads } from '@/modules/special-sessions/actions'
import { listInstructors } from '@/modules/instructors/queries'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn(async () => ({ id: 'staff-test', globalRole: 'super_admin', branchIds: ['branch-a'] })), isBranchAccessible: () => true }))
const instructorId = '00000000-0000-4000-8000-000000000001'
const branchId = '00000000-0000-4000-8000-000000000002'
beforeEach(() => vi.clearAllMocks())
const install = (db: ReturnType<typeof createMockDb>) => vi.mocked(createServiceClient).mockReturnValue(db as unknown as ReturnType<typeof createServiceClient>)

describe('active instructor eligibility', () => {
  it.each(['inactive', 'on_leave', 'archived', 'terminated'])('rejects %s status', async status => {
    const db = createMockDb({ instructors: [{ data: { id: instructorId, status, deleted_at: null }, error: null }] })
    expect(await getInstructorAvailabilityError(db as unknown as ReturnType<typeof createServiceClient>, instructorId)).toMatchObject({ code: 'INACTIVE_INSTRUCTOR' })
  })
  it('excludes deleted instructors even if status still says active', () => {
    expect(isActiveInstructor({ status: 'active', deleted_at: '2026-01-01' })).toBe(false)
    expect(isActiveInstructor({ status: 'active', deleted_at: null })).toBe(true)
  })
  it('fails closed on lookup errors and permits an explicitly unassigned group', async () => {
    const db = createMockDb({ instructors: [{ data: null, error: { message: 'offline' } }] })
    expect(await getInstructorAvailabilityError(db as unknown as ReturnType<typeof createServiceClient>, instructorId)).toMatchObject({ code: 'DB_ERROR' })
    expect(await getInstructorAvailabilityError(db as unknown as ReturnType<typeof createServiceClient>, null)).toBeNull()
    expect(db.from).toHaveBeenCalledTimes(1)
  })
})

describe('picker sources', () => {
  it('never lets group-linked or legacy visibility bring inactive instructors back', async () => {
    const row = (id: string, status: string) => ({ id, status, users: { profiles: { first_name: id, last_name: 'Instructor' } } })
    const db = createMockDb({
      instructors: [{ data: [row('active', 'active'), row('linked-inactive', 'inactive'), row('legacy-on-leave', 'on_leave')], error: null }],
      instructor_branches: [{ data: [{ instructor_id: 'linked-inactive', branch_id: 'foreign-branch' }], error: null }],
      groups: [{ data: [{ id: 'group-a' }], error: null }],
      group_instructors: [{ data: [{ instructor_id: 'linked-inactive' }], error: null }],
    })
    install(db)
    expect(await getInstructorFilterOptions(['branch-a'])).toEqual([{ id: 'active', name: 'active Instructor' }])
  })
  it('applies active-only filtering by default to legacy assignment pickers', async () => {
    const eq = vi.fn(), chain = { select: () => chain, is: () => chain, order: () => chain, eq: eq.mockImplementation(() => chain), range: async () => ({ data: [], count: 0, error: null }) }
    vi.mocked(createServiceClient).mockReturnValue({ from: () => chain } as unknown as ReturnType<typeof createServiceClient>)
    await listInstructors()
    expect(eq).toHaveBeenCalledWith('status', 'active')
  })
})

describe('new assignments recheck status before writing', () => {
  it('blocks an allocation submitted from a stale open picker', async () => {
    const db = createMockDb({ instructors: [{ data: { status: 'inactive' }, error: null }] })
    install(db)
    expect(await addGroupAllocationAction('group-a', instructorId, 12)).toMatchObject({ success: false, error: { code: 'INACTIVE_INSTRUCTOR' } })
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['instructors'])
  })
  it('rejects multi-group assignment before writing any selected group', async () => {
    const db = createMockDb({
      instructors: [{ data: { id: instructorId, branch_id: branchId, status: 'inactive' }, error: null }],
      groups: [{ data: [{ id: 'group-a', branch_id: branchId }], error: null }],
    })
    install(db)
    expect(await assignGroupsModalAction(instructorId, ['group-a'], 'lead')).toMatchObject({ success: false, error: { code: 'INACTIVE_INSTRUCTOR' } })
    expect(db.from.mock.calls.filter(call => call[0] === 'group_instructors')).toHaveLength(1) // existing-assignment read only
  })
  it('rejects initial instructor selection before even creating the group', async () => {
    const db = createMockDb({ instructors: [{ data: { status: 'inactive' }, error: null }] })
    install(db)
    const fd = new FormData()
    for (const [key, value] of Object.entries({ branch_id: branchId, name: 'Test group', type: 'class', instructor_id: instructorId })) fd.set(key, value)
    expect(await createGroupModal(null, fd)).toMatchObject({ success: false, error: { code: 'INACTIVE_INSTRUCTOR' } })
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['instructors'])
  })
  it('also rejects a stale edit selection before writing group changes', async () => {
    const db = createMockDb({
      groups: [{ data: { branch_id: branchId, status: 'active' }, error: null }],
      group_courses: [{ data: { course_id: 'different-course', instructor_id: 'previous-instructor' }, error: null }],
      instructors: [{ data: { status: 'inactive' }, error: null }],
    })
    install(db)
    const fd = new FormData()
    for (const [key, value] of Object.entries({ id: branchId, branch_id: branchId, name: 'Updated group', type: 'class', status: 'active', instructor_id: instructorId })) fd.set(key, value)
    expect(await updateGroupModal(null, fd)).toMatchObject({ success: false, error: { code: 'INACTIVE_INSTRUCTOR' } })
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['groups', 'group_courses', 'instructors'])
  })
  it.each([createTrialSession, createMakeupSession, bulkBookTrialFromLeads])('blocks new special sessions for inactive instructors', async action => {
    const db = createMockDb({ instructors: [{ data: { status: 'on_leave' }, error: null }] })
    install(db)
    const fd = new FormData()
    for (const [key, value] of Object.entries({ branch_id: branchId, instructor_id: instructorId, scheduled_at: '2026-10-20T12:00:00Z', lead_ids: JSON.stringify(['lead-test']) })) fd.set(key, value)
    expect(await action(null, fd)).toMatchObject({ success: false, error: { code: 'INACTIVE_INSTRUCTOR' } })
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['instructors'])
  })
})

describe('historical/current assignment integrity', () => {
  const current = { id: 'assignment-a', group_id: 'group-a', course_id: 'course-a', instructor_id: instructorId, status: 'active', started_at: null }
  it('keeps an existing assignment unchanged without rejecting an inactive historical instructor', async () => {
    const db = createMockDb({ group_courses: [{ data: current, error: null }] })
    expect(await assignGroupCourseService('group-a', 'course-a', instructorId, null, db as unknown as ReturnType<typeof createServiceClient>)).toEqual({ action: 'noop', row: current })
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['group_courses'])
  })
  it('cannot use that exception to assign the inactive instructor to a different course', async () => {
    const db = createMockDb({ group_courses: [{ data: current, error: null }], instructors: [{ data: { status: 'inactive' }, error: null }] })
    await expect(assignGroupCourseService('group-a', 'different-course', instructorId, null, db as unknown as ReturnType<typeof createServiceClient>)).rejects.toThrow(/no longer active/)
    expect(db.from.mock.calls.map(call => call[0])).toEqual(['group_courses', 'instructors'])
  })
  it('still permits replacing an inactive instructor with an active one', async () => {
    const db = createMockDb({
      group_courses: [{ data: current, error: null }, { data: { ...current, instructor_id: 'active-replacement' }, error: null }],
      instructors: [{ data: { status: 'active', deleted_at: null }, error: null }],
    })
    expect(await assignGroupCourseService('group-a', 'course-a', 'active-replacement', null, db as unknown as ReturnType<typeof createServiceClient>)).toMatchObject({ action: 'updated', row: { instructor_id: 'active-replacement' } })
  })
})
