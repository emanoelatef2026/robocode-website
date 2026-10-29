import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstructorFormModal } from '@/app/portal/team-leader/instructors/workspace/dialogs/InstructorFormModal'
import { updateInstructorModalAction } from '@/modules/instructors/modal-actions'
import type { FullInstructor, InstructorFormOptions } from '@/modules/instructors/types'

vi.mock('@/modules/instructors/modal-actions', () => ({
  createInstructorModalAction: vi.fn(),
  updateInstructorModalAction: vi.fn().mockResolvedValue({ success: true }),
}))
const instructor = { id: 'test-instructor', first_name: 'Test', last_name: 'Instructor', branch_ids: ['test-branch'], salary_per_session: 200, assistant_salary_per_session: 100 } as FullInstructor
const options = { branches: [{ id: 'test-branch', name: 'Test Branch' }] } as InstructorFormOptions
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('instructor teaching rates', () => {
  it('lets the super admin open Financial and save both role rates', async () => {
    const user = userEvent.setup()
    render(<InstructorFormModal instructor={instructor} options={options} canManageRates onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Financial' }))
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0]).toHaveValue(200)
    expect(inputs[1]).toHaveValue(100)
    await user.clear(inputs[0]); await user.type(inputs[0], '250')
    await user.clear(inputs[1]); await user.type(inputs[1], '125')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateInstructorModalAction).toHaveBeenCalledOnce())
    const form = vi.mocked(updateInstructorModalAction).mock.calls[0][0]
    expect(form.get('salary_per_session')).toBe('250')
    expect(form.get('assistant_salary_per_session')).toBe('125')
  })

  it('keeps rates out of the team leader form submission', async () => {
    render(<InstructorFormModal instructor={instructor} options={options} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Financial' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateInstructorModalAction).toHaveBeenCalledOnce())
    const form = vi.mocked(updateInstructorModalAction).mock.calls[0][0]
    expect(form.has('salary_per_session')).toBe(false)
    expect(form.has('assistant_salary_per_session')).toBe(false)
  })
})
