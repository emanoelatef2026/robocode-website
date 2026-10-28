import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvaluationForm } from '@/components/portal/instructor/StudentEvaluationModal'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/modules/instructor-portal/actions', () => ({ createInstructorEvaluationBatch: (...args: unknown[]) => mocks.save(...args) }))
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ success: true, data: { evaluationIds: ['e1'] } }) })
afterEach(cleanup)
const setup = () => { render(<EvaluationForm studentId="student" groupId="group" />); return userEvent.setup() }

describe('quick evaluation stars', () => {
  it('starts unrated and calculates equal-weight averages excluding untouched skills', async () => {
    const user = setup()
    expect(screen.getByRole('button', { name: 'Save evaluation' })).toBeDisabled()
    expect(screen.getByLabelText('Overall average')).toHaveTextContent('—')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(4)
    await user.click(screen.getByRole('radio', { name: 'Understanding & application: 4 stars' }))
    await user.click(screen.getByRole('radio', { name: 'Problem Solving: 5 stars' }))
    expect(screen.getByLabelText('Overall average')).toHaveTextContent('4.5')
    expect(screen.getByText('2 rated criteria · Equal weight')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear Understanding & application rating' }))
    expect(screen.getByLabelText('Overall average')).toHaveTextContent('5.0')
  })
  it('submits all selected skills once with the audience and feedback', async () => {
    const user = setup()
    await user.click(screen.getByRole('radio', { name: 'Understanding & application: 4 stars' }))
    await user.click(screen.getByRole('radio', { name: 'Participation: 3 stars' }))
    await user.type(screen.getByLabelText(/Feedback/), 'Great effort')
    await user.click(screen.getByLabelText('Parent'))
    await user.click(screen.getByRole('button', { name: 'Save evaluation' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const data = mocks.save.mock.calls[0][1] as FormData
    expect(JSON.parse(String(data.get('ratings')))).toEqual([{ criterion: 'ACADEMIC_SKILLS', rating: 4 }, { criterion: 'PARTICIPATION', rating: 3 }])
    expect(data.get('feedback')).toBe('Great effort')
    expect(data.get('visible_to_student')).toBe('true')
    expect(data.get('visible_to_parent')).toBeNull()
  })
  it('retains stars and feedback after a save error', async () => {
    mocks.save.mockResolvedValue({ success: false, error: { message: 'Please retry' } })
    const user = setup()
    await user.type(screen.getByLabelText(/Feedback/), 'Keep building')
    await user.click(screen.getByRole('radio', { name: 'Focus & behavior: 5 stars' }))
    await user.click(screen.getByRole('button', { name: 'Save evaluation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry')
    expect(screen.getByRole('radio', { name: 'Focus & behavior: 5 stars' })).toBeChecked()
    expect(screen.getByLabelText(/Feedback/)).toHaveValue('Keep building')
    expect(screen.getByLabelText('Overall average')).toHaveTextContent('5.0')
  })
})
