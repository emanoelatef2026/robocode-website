import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createStudentNote, createInstructorEvaluation } from '@/modules/instructor-portal/actions'
import StudentNoteModal from '@/components/portal/instructor/StudentNoteModal'
import StudentEvaluationModal from '@/components/portal/instructor/StudentEvaluationModal'

vi.mock('@/modules/instructor-portal/actions', () => ({ createStudentNote: vi.fn(), createInstructorEvaluation: vi.fn() }))
afterEach(cleanup)

describe.each([
  ['note', StudentNoteModal, 'Add note for Test Student'],
  ['evaluation', StudentEvaluationModal, 'Quick-evaluate Test Student'],
] as const)('session %s dialog', (_name, Component, trigger) => {
  it('renders its form outside the attendance form and exposes an accessible dialog', () => {
    const { container } = render(<form aria-label="Attendance"><Component studentId="test-student" studentName="Test Student" groupId="test-group" /></form>)
    fireEvent.click(screen.getByRole('button', { name: trigger }))
    const dialog = screen.getByRole('dialog')
    expect(container.contains(dialog)).toBe(false)
    expect(dialog.querySelectorAll('form')).toHaveLength(1)
    expect(dialog.querySelector('form')?.parentElement?.closest('form')).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('type', 'button')
  })

  it('supports Escape and restores focus to the trigger without submitting attendance', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(<form onSubmit={submit}><Component studentId="test-student" studentName="Test Student" groupId="test-group" /></form>)
    const button = screen.getByRole('button', { name: trigger })
    button.focus()
    fireEvent.click(button)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits only its own action, never the attendance form', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    vi.mocked(createStudentNote).mockResolvedValue({ success: true, data: undefined } as never)
    vi.mocked(createInstructorEvaluation).mockResolvedValue({ success: true, data: undefined } as never)
    render(<form onSubmit={submit}><Component studentId="test-student" studentName="Test Student" groupId="test-group" /></form>)
    fireEvent.click(screen.getByRole('button', { name: trigger }))
    if (_name === 'note') fireEvent.change(screen.getByPlaceholderText('Note about Test Student…'), { target: { value: 'Test note' } })
    fireEvent.click(screen.getByRole('button', { name: _name === 'note' ? 'Add Note' : 'Add Evaluation' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(submit).not.toHaveBeenCalled()
  })
})
