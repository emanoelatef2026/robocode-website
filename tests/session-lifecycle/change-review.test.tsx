import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SessionChangeReview from '@/components/portal/instructor/SessionChangeReview'
import { reviewSessionChange } from '@/modules/instructor-portal/shared-actions'
vi.mock('@/modules/instructor-portal/shared-actions', () => ({ reviewSessionChange: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())
const requests = [{ id: 'request', instructor_id: 'assistant', kind: 'attendance' as const, status: 'pending', created_at: '2026-10-28', payload: { attendance: [{ student_id: 'student', status: 'absent' }] } }]
const props = { requests, students: [{ student_id: 'student', student_name: 'Test student' }] as never, participants: [{ instructor_id: 'assistant', name: 'Test assistant' }] }
it('shows assistants their proposals without approval controls', async () => {
  render(<SessionChangeReview {...props} isLead={false} />)
  await userEvent.click(screen.getByText(/Attendance · Test assistant/))
  expect(screen.getByText(/Test student:/)).toHaveTextContent('absent')
  expect(screen.queryByRole('button', { name: /Approve|Decline/ })).not.toBeInTheDocument()
})
it('retains a stale request after a failed approval and permits declining it', async () => {
  vi.mocked(reviewSessionChange).mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION', message: 'Class changed. Ask assistant to resubmit.' } }).mockResolvedValueOnce({ success: true, data: { sessionId: 'session', groupId: 'group' } })
  const user = userEvent.setup()
  render(<SessionChangeReview {...props} isLead />)
  await user.click(screen.getByText(/Attendance · Test assistant/))
  await user.click(screen.getByRole('button', { name: 'Approve & apply changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Class changed')
  await user.click(screen.getByRole('button', { name: 'Decline changes' }))
  await waitFor(() => expect(screen.getByText('rejected')).toBeInTheDocument())
  expect(reviewSessionChange).toHaveBeenLastCalledWith('request', false)
})
