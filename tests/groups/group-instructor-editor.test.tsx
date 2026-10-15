import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GroupFormModal from '@/app/portal/team-leader/groups/GroupFormModal'
import type { GroupOperationalRow } from '@/modules/groups/operational'

const mocks = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), add: vi.fn(), save: vi.fn() }))
vi.mock('@/modules/groups/modal-actions', () => ({ createGroupModal: mocks.save, updateGroupModal: mocks.save }))
vi.mock('@/modules/groups/allocation-actions', () => ({
  getGroupAllocationsAction: mocks.get,
  removeGroupAllocationAction: mocks.remove,
  addGroupAllocationAction: mocks.add,
  updateGroupAllocationAction: vi.fn(),
  editGroupAllocationRangeAction: vi.fn(),
}))

const group = {
  group_id: 'group-test', name: 'Test group', branch_id: 'branch-test', status: 'active',
  planned_sessions: 12, open_ended: false, enrolled_students: [],
} as unknown as GroupOperationalRow
const options = {
  branches: [{ id: 'branch-test', name: 'Test branch' }], courses: [],
  instructors: [{ id: 'old-instructor', name: 'Previous Instructor' }, { id: 'new-instructor', name: 'Replacement Instructor' }],
}
const allocation = {
  instructor_id: 'old-instructor', instructor_name: 'Previous Instructor', allocation_status: 'active',
  from_session: 1, to_session: 12, allocated_sessions: 12, lock_state: 'unlocked',
  highest_consumed_session: 0, sessions_completed: 0,
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ success: true, data: {
    group_id: 'group-test', total_sessions: 12, open_ended: false, next_from_session: 1, allocations: [allocation],
  } })
  mocks.add.mockResolvedValue({ success: true })
  mocks.save.mockResolvedValue({ success: true, data: { id: 'group-test' } })
})

describe('group instructor replacement inside edit modal', () => {
  it('keeps the draft open after confirming removal and permits selecting a replacement before group save', async () => {
    const user = userEvent.setup(), close = vi.fn(), saved = vi.fn()
    mocks.remove.mockImplementation(async () => {
      mocks.get.mockResolvedValue({ success: true, data: {
        group_id: 'group-test', total_sessions: 12, open_ended: false, next_from_session: 1, allocations: [],
      } })
      return { success: true }
    })
    render(<GroupFormModal isOpen mode="edit" group={group} options={options} studentOptions={[]} onClose={close} onSuccess={saved} />)
    const name = screen.getByDisplayValue('Test group')
    await user.clear(name)
    await user.type(name, 'Unsaved draft name')
    await user.click(await screen.findByTitle('Remove allocation'))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await screen.findByText('No instructor allocations yet. Add one below.')
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('group-test', 'old-instructor', { deferRefresh: true })
    expect(close).not.toHaveBeenCalled()
    expect(saved).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(name).toHaveValue('Unsaved draft name')
    await user.click(screen.getByRole('button', { name: 'Add Instructor Allocation' }))
    const selector = screen.getByText('— Select instructor —').closest('select')!
    await user.selectOptions(selector, 'new-instructor')
    await user.click(screen.getByRole('button', { name: 'Add Allocation' }))
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith('group-test', 'new-instructor', null, undefined, 1, { deferRefresh: true }))
    expect(close).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(name).toHaveValue('Unsaved draft name')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(saved).toHaveBeenCalledWith('group-test'))
    expect(mocks.save).toHaveBeenCalledOnce()
  })

  it('keeps the editor and allocation available when removal fails', async () => {
    mocks.remove.mockResolvedValue({ success: false, error: { message: 'Removal rejected' } })
    const user = userEvent.setup(), close = vi.fn(), saved = vi.fn()
    render(<GroupFormModal isOpen mode="edit" group={group} options={options} studentOptions={[]} onClose={close} onSuccess={saved} />)
    await user.click(await screen.findByTitle('Remove allocation'))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Removal rejected')).toBeInTheDocument()
    expect(screen.getByTitle('Remove allocation')).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()
    expect(saved).not.toHaveBeenCalled()
  })
})
