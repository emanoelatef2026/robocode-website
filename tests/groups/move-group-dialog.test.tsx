import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveGroupModal } from '@/app/portal/team-leader/groups/workspace/dialogs/MoveGroupModal'
import type { GroupOperationalRow } from '@/modules/groups/operational'

const mocks = vi.hoisted(() => ({ move: vi.fn(), remove: vi.fn(), add: vi.fn() }))
vi.mock('@/modules/groups/actions/students', () => ({ moveStudentsToGroupAction: mocks.move }))
vi.mock('@/modules/groups/modal-actions', () => ({ removeStudentFromGroupAction: mocks.remove, addStudentsToGroupAction: mocks.add }))
vi.mock('@/app/portal/team-leader/groups/workspace/components/StatusChip', () => ({ StatusChip: () => null }))
const source = { group_id: 'source', name: 'Source Python', status: 'active', capacity: null, student_count: 3 } as GroupOperationalRow
const target = { group_id: 'target', name: 'Target Python', status: 'active', capacity: null, student_count: 4 } as GroupOperationalRow
beforeEach(() => { vi.clearAllMocks(); mocks.move.mockResolvedValue({ success: true }) })

describe('move group dialog', () => {
  it('moves once, never removing a student in a separate request', async () => {
    const user = userEvent.setup(), moved = vi.fn(), close = vi.fn()
    render(<MoveGroupModal isOpen currentGroup={source} allGroups={[source, target]} selectedIds={new Set(['student'])} onMoved={moved} onClose={close} />)
    await user.click(screen.getByText('Target Python'))
    await user.click(screen.getByRole('button', { name: 'Move to Target Python' }))
    expect(mocks.move).toHaveBeenCalledExactlyOnceWith('source', 'target', ['student'], 'new')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()
    expect(moved).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
  it('keeps the destination and contract choice after failure so staff can retry', async () => {
    mocks.move.mockResolvedValueOnce({ success: false, error: { message: 'Move failed safely' } })
    const user = userEvent.setup(), close = vi.fn(), moved = vi.fn()
    render(<MoveGroupModal isOpen currentGroup={source} allGroups={[source, target]} selectedIds={new Set(['student'])} onMoved={moved} onClose={close} />)
    await user.click(screen.getByText('Target Python'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Contract for moved students' }), 'continue')
    await user.click(screen.getByRole('button', { name: 'Move to Target Python' }))
    expect(await screen.findByText('Move failed safely')).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()
    expect(moved).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveValue('continue')
    await user.click(screen.getByRole('button', { name: 'Move to Target Python' }))
    expect(mocks.move).toHaveBeenLastCalledWith('source', 'target', ['student'], 'continue')
    expect(moved).toHaveBeenCalledOnce()
  })
})
