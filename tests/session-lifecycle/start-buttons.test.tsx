import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { startSession, startGroupSession } from '@/modules/instructor-portal/actions'
import StartSessionButton from '@/app/portal/instructor/groups/[id]/sessions/[sid]/StartSessionButton'
import StartGroupSessionButton from '@/app/portal/instructor/groups/[id]/StartGroupSessionButton'

vi.mock('@/modules/instructor-portal/actions', () => ({ startSession: vi.fn(), startGroupSession: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.mocked(useRouter).mockReturnValue({ refresh: vi.fn(), push: vi.fn() } as never) })
afterEach(cleanup)

describe.each(['scheduled', 'new'] as const)('%s session start', mode => {
  it('shows a recoverable network error, preserves topic and permits retry', async () => {
    const action = mode === 'scheduled' ? vi.mocked(startSession) : vi.mocked(startGroupSession)
    action.mockRejectedValueOnce(new Error('Network failed'))
    if (mode === 'scheduled') render(<StartSessionButton sessionId="session" groupId="group" />)
    else {
      render(<StartGroupSessionButton groupId="group" groupCourseId="course" branchId="branch" />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test variables' } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('try again')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Session' })).toBeEnabled())
    if (mode === 'new') expect(screen.getByRole('textbox')).toHaveValue('Test variables')
    action.mockResolvedValueOnce({ success: true, data: { sessionId: 'session' } } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2))
  })
})
