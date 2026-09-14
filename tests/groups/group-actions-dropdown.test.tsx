import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GroupActionsDropdown } from '@/app/portal/team-leader/groups/workspace/components/GroupActionsDropdown'
import { GROUP_FORM_MODAL_LAYER } from '@/app/portal/team-leader/groups/GroupFormModal'

describe('GroupActionsDropdown', () => {
  it('closes the menu and invokes Edit Group', () => {
    const onEdit = vi.fn()

    render(
      <GroupActionsDropdown
        onRecordAttendance={vi.fn()}
        onAddStudent={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit group/i }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /edit group/i })).not.toBeInTheDocument()
  })

  it('keeps the edit form above the group workspace dialog', () => {
    expect(GROUP_FORM_MODAL_LAYER).toBe('z-[70]')
  })
})
