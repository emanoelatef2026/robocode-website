import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SharedSessionHub from '@/app/portal/instructor/groups/[id]/SharedSessionHub'
import SessionParticipation from '@/components/portal/instructor/SessionParticipation'
import type { SharedSessionItem } from '@/modules/instructor-portal/shared-queries'

const mocks = vi.hoisted(() => ({ open: vi.fn(), participation: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('@/modules/instructor-portal/shared-actions', () => ({ openSharedSession: mocks.open, changeParticipation: mocks.participation }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks(); mocks.participation.mockResolvedValue({ success: true, data: { sessionId: 's4', groupId: 'group', state: 'joined' } }); mocks.open.mockResolvedValue({ success: true, data: { sessionId: 's4', groupId: 'group' } }) })
const item = (overrides: Partial<SharedSessionItem> = {}): SharedSessionItem => ({ id: 's4', group_course_id: 'course', session_number: 4, scheduled_at: '2026-10-21T18:00:00Z', ended_at: null, status: 'scheduled', topic: 'Loops', attendance_revision: 0, participants: [], myState: null, joined: false, ...overrides })

describe('shared instructor sessions', () => {
  it('shows join/continue, never a new-class button while a class is ongoing', async () => {
    const user = userEvent.setup()
    render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({ status: 'ongoing' })]} />)
    expect(screen.queryByRole('button', { name: /start|create/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join session' }))
    expect(mocks.participation).toHaveBeenCalledExactlyOnceWith('s4', 'join', '')
    expect(mocks.open).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm my participation' })).toBeInTheDocument()
  })
  it('starts the exact next scheduled ID, not MAX(number)+1 or an arbitrary future row', async () => {
    const user = userEvent.setup()
    render(<SharedSessionHub groupId="group" courseId="course" sessions={[item({ id: 's12', session_number: 12 }), item(), item({ id: 's3', session_number: 3, status: 'completed', ended_at: '2026-10-14T20:00:00Z' })]} />)
    await user.type(screen.getByRole('textbox', { name: 'Session topic' }), 'Functions')
    await user.click(screen.getByRole('button', { name: 'Start next scheduled session' }))
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith('course', 's4', 's3', 'Functions')
    expect(mocks.push).toHaveBeenCalledWith('/portal/instructor/groups/group/sessions/s4')
  })
  it('confirming participation never invokes the class starter', async () => {
    const user = userEvent.setup()
    render(<SessionParticipation session={item({ status: 'ongoing', joined: true, myState: 'joined' })} />)
    mocks.participation.mockResolvedValue({ success: true, data: { state: 'confirmed' } })
    await user.click(screen.getByRole('button', { name: 'Confirm my participation' }))
    expect(mocks.participation).toHaveBeenCalledWith('s4', 'confirm', '')
    expect(mocks.open).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('participation is confirmed')
  })
  it('a previously joined co-teacher may confirm after another instructor ends the class', () => {
    render(<SessionParticipation session={item({ status: 'completed', joined: true, myState: 'joined' })} />)
    expect(screen.getByRole('button', { name: 'Confirm my participation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join session' })).not.toBeInTheDocument()
  })
  it('past classes require a reason and approval, not a fresh start', async () => {
    const user = userEvent.setup()
    mocks.participation.mockResolvedValue({ success: true, data: { state: 'requested' } })
    render(<SessionParticipation session={item({ status: 'completed' })} />)
    await user.click(screen.getByRole('button', { name: 'Request participation approval' }))
    expect(screen.getByRole('button', { name: 'Send approval request' })).toBeDisabled()
    await user.type(screen.getByRole('textbox'), 'Helped the students')
    await user.click(screen.getByRole('button', { name: 'Send approval request' }))
    expect(mocks.participation).toHaveBeenCalledWith('s4', 'request', 'Helped the students')
    expect(await screen.findByRole('status')).toHaveTextContent('Awaiting')
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('preserves the approval reason on network failure and allows retry', async () => {
    const user = userEvent.setup()
    mocks.participation.mockRejectedValueOnce(new Error('Network'))
    render(<SessionParticipation session={item({ status: 'completed' })} />)
    await user.click(screen.getByRole('button', { name: 'Request participation approval' }))
    await user.type(screen.getByRole('textbox'), 'Practical work support')
    await user.click(screen.getByRole('button', { name: 'Send approval request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry')
    expect(screen.getByRole('textbox')).toHaveValue('Practical work support')
    await user.click(screen.getByRole('button', { name: 'Send approval request' }))
    await waitFor(() => expect(mocks.participation).toHaveBeenCalledTimes(2))
  })
})
