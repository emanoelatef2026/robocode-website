import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AcademicConfigCard from '@/app/admin/groups/[id]/AcademicConfigCard'
import TLAssignCourseForm from '@/app/portal/team-leader/groups/[id]/TLAssignCourseForm'
import type { GroupAcademicConfig } from '@/modules/groups/types'
import type { InstructorListItem } from '@/modules/instructors/types'

vi.mock('@/modules/groups/actions', () => ({ saveGroupAcademicConfig: vi.fn(), addGroupInstructor: vi.fn(), removeGroupInstructor: vi.fn(), assignGroupCourse: vi.fn() }))
afterEach(cleanup)
describe('active-only assignment UI preserves current instructor', () => {
  it('does not silently clear the Admin assignment when its instructor is no longer selectable', async () => {
    const { container } = render(<AcademicConfigCard groupId="group-a" config={{ course_id: 'course-a', instructor_id: 'inactive-current', additional_instructors: [] } as unknown as GroupAcademicConfig} courses={[]} instructors={[{ id: 'active-new', name: 'Active Instructor', branch_name: 'Test Branch' }]} />)
    const current = screen.getByRole('option', { name: /Current assignment retained/ })
    expect(current).toBeDisabled()
    const form = container.querySelector('form')!
    expect(new FormData(form).get('instructor_id')).toBe('inactive-current')
    await userEvent.setup().selectOptions(current.closest('select')!, 'active-new')
    expect(new FormData(form).get('instructor_id')).toBe('active-new')
  })
  it('does the same for the Team Leader legacy assignment form', async () => {
    const { container } = render(<TLAssignCourseForm groupId="group-a" courses={[]} instructors={[{ id: 'active-new', first_name: 'Active', last_name: 'Instructor' } as InstructorListItem]} currentCourseId="course-a" currentInstructorId="inactive-current" currentStartedAt={null} />)
    const current = screen.getByRole('option', { name: /Current assignment retained/ })
    expect(current).toBeDisabled()
    const field = container.querySelector('input[name="instructor_id"]')!
    expect(field).toHaveValue('inactive-current')
    await userEvent.setup().selectOptions(current.closest('select')!, 'active-new')
    expect(field).toHaveValue('active-new')
  })
})
