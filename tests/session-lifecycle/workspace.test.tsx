import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttendanceForm from '@/app/portal/instructor/groups/[id]/sessions/[sid]/AttendanceForm'
import SessionWorkspace from '@/app/portal/instructor/groups/[id]/sessions/[sid]/SessionWorkspace'
import type { SessionDetail } from '@/modules/instructor-portal/types'

const mocks = vi.hoisted(() => ({ save: vi.fn(), end: vi.fn(), refresh: vi.fn() }))
vi.mock('@/modules/instructor-portal/actions', () => ({
  saveAttendance: mocks.save, saveAndEndSession: mocks.end,
  updateSession: vi.fn(), addSessionRecording: vi.fn(), removeSessionRecording: vi.fn(),
  updateSessionResources: vi.fn(), createSessionHomework: vi.fn(), updateSessionHomework: vi.fn(),
  cancelSession: vi.fn(), postponeSession: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/components/portal/instructor/StudentNoteModal', () => ({ default: () => <button type="button">Student note</button> }))
vi.mock('@/components/portal/instructor/StudentEvaluationModal', () => ({ default: () => <button type="button">Evaluate student</button> }))

const rows = [
  { student_id: 's1', student_name: 'Ada', status: null, notes: null },
  { student_id: 's2', student_name: 'Lin', status: 'late', notes: 'Traffic' },
] as React.ComponentProps<typeof AttendanceForm>['rows']
const setup = (sessionStatus = 'ongoing') => {
  const user = userEvent.setup()
  render(<AttendanceForm sessionId="session" groupId="group" rows={rows} currentTopic="Loops" sessionStatus={sessionStatus} />)
  return user
}
beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue({ success: true }); mocks.end.mockResolvedValue({ success: true }) })
afterEach(cleanup)

describe('session attendance workspace', () => {
  it('lets an assistant propose attendance but never offers to end the class', async () => {
    const user = userEvent.setup()
    render(<AttendanceForm sessionId="session" groupId="group" rows={rows} currentTopic="Loops" sessionStatus="ongoing" isLead={false} canPropose />)
    expect(screen.queryByRole('button', { name: 'Save & end session' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ada: Absent' }))
    await user.click(screen.getByRole('button', { name: 'Submit attendance for review' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(screen.getByRole('status')).toHaveTextContent('Not published')
    expect(mocks.end).not.toHaveBeenCalled()
  })
  it('keeps a non-participating instructor read-only', () => {
    render(<AttendanceForm sessionId="session" groupId="group" rows={rows} currentTopic="Loops" sessionStatus="ongoing" isLead={false} canPropose={false} />)
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Submit attendance|Save attendance|Save & end/ })).not.toBeInTheDocument()
  })
  it('requires starting a scheduled session before recording attendance', () => {
    setup('scheduled')
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toBeDisabled()
    expect(screen.getByLabelText('Session topic')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save & end session' })).not.toBeInTheDocument()
  })
  it('keeps unset attendance blank and saves only explicit statuses', async () => {
    const user = setup()
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const fd = mocks.save.mock.calls[0][1] as FormData
    expect(fd.getAll('student_ids[]')).toEqual(['s2'])
    expect(fd.has('status_s1')).toBe(false)
    expect(fd.get('status_s2')).toBe('late')
    expect(fd.get('intent')).toBe('save')
  })

  it('confirms ending with the current draft and refreshes on success', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Ada: Absent' }))
    await user.clear(screen.getByLabelText('Session topic'))
    await user.type(screen.getByLabelText('Session topic'), 'Functions')
    await user.click(screen.getByRole('button', { name: 'Save & end session' }))
    expect(mocks.end).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Confirm session completion' })).toHaveTextContent('1 absent')
    await user.click(screen.getByRole('button', { name: 'Confirm save & end' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    const fd = mocks.end.mock.calls[0][1] as FormData
    expect(fd.get('topic')).toBe('Functions')
    expect(fd.get('status_s1')).toBe('absent')
    expect(fd.get('intent')).toBe('end')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save & end session' })).not.toBeInTheDocument()
  })

  it('preserves choices after an action error and allows retry', async () => {
    mocks.end.mockResolvedValueOnce({ success: false, error: { message: 'Please review attendance.' } })
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Ada: Present' }))
    await user.click(screen.getByRole('button', { name: 'Save & end session' }))
    await user.click(screen.getByRole('button', { name: 'Confirm save & end' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Please review attendance.')
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/end anyway/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
  })

  it('blocks concurrent save/end and editing while saving', async () => {
    let resolve!: (value: { success: true }) => void
    mocks.save.mockReturnValue(new Promise(r => { resolve = r }))
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save & end session' })).toBeDisabled())
    expect(screen.getByLabelText('Session topic')).toBeDisabled()
    await act(async () => resolve({ success: true }))
    expect(mocks.end).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('completed attendance is read-only and cannot be resubmitted by a co-teacher', () => {
    setup('completed')
    expect(screen.queryByRole('button', { name: 'Save & end session' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ada: Excused' })).toBeDisabled()
  })

  it('warns before leaving with unsaved changes and clears the warning after save', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Ada: Present' }))
    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
    const savedEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(savedEvent)
    expect(savedEvent.defaultPrevented).toBe(false)
  })

  it('keeps choices and notes through tabs, focuses missing attendance, and never nests forms', async () => {
    const user = userEvent.setup()
    const session = { id: 'session', status: 'ongoing', topic: 'Loops', attendance: rows, notes: null, resources_links: [], recordings: [], course_modules: [], session_homework: [] } as unknown as SessionDetail
    const { container } = render(<SessionWorkspace session={session} groupId="group" />)
    await user.click(screen.getByRole('button', { name: 'Add attendance note for Ada' }))
    await user.type(screen.getByLabelText('Attendance note for Ada'), 'Bring workbook')
    await user.click(screen.getByRole('tab', { name: 'Session content' }))
    expect(screen.getByLabelText('Session topic')).toHaveValue('Loops')
    expect(screen.queryByRole('button', { name: 'Ada: Present' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save & end session' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Attendance' })).toHaveAttribute('aria-selected', 'true'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ada: Present' })).toHaveFocus())
    expect(screen.getByLabelText('Attendance note for Ada')).toHaveValue('Bring workbook')
    expect(mocks.end).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Ada: Present' }))
    await user.click(screen.getByRole('tab', { name: 'Notes & evaluations' }))
    expect(container.querySelector('form form')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Attendance' }))
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('retains the draft after an unexpected failure', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Network unavailable'))
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Ada: Makeup' }))
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is kept')
    expect(screen.getByRole('button', { name: 'Ada: Makeup' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeEnabled()
  })

  it('requires a topic with focus guidance and cannot end a scheduled session', async () => {
    const user = setup()
    await user.clear(screen.getByLabelText('Session topic'))
    await user.click(screen.getByRole('button', { name: 'Save & end session' }))
    expect(screen.getByLabelText('Session topic')).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a session topic')
    expect(mocks.end).not.toHaveBeenCalled()
    cleanup()
    setup('scheduled')
    expect(screen.queryByRole('button', { name: 'Save & end session' })).not.toBeInTheDocument()
  })

  it('shows all five statuses directly and keeps the entire register visible', async () => {
    const user = setup()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Attendance for Ada' }).querySelectorAll('button')).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Lin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ada: Present' }))
    expect(screen.getByRole('link', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const fd = mocks.save.mock.calls[0][1] as FormData
    expect(fd.getAll('student_ids[]')).toEqual(['s1', 's2'])
    expect(fd.get('status_s1')).toBe('present')
    expect(fd.get('status_s2')).toBe('late')
    expect(fd.get('notes_s2')).toBe('Traffic')
    expect(screen.getByRole('button', { name: 'Ada: Present' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('saves an excused status directly without changing other students', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Ada: Excused' }))
    await user.click(screen.getByRole('button', { name: 'Save attendance' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const fd = mocks.save.mock.calls[0][1] as FormData
    expect(fd.get('status_s1')).toBe('excused')
    expect(fd.get('status_s2')).toBe('late')
  })

  it('requires confirmation before bulk absent replaces attendance', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = setup()
    const bulk = screen.getByRole('button', { name: 'Mark all absent' })
    await user.click(bulk)
    expect(screen.getByRole('button', { name: 'Lin: Late' })).toHaveAttribute('aria-pressed', 'true')
    confirmation.mockReturnValue(true)
    await user.click(bulk)
    expect(screen.getByRole('button', { name: 'Ada: Absent' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Lin: Absent' })).toHaveAttribute('aria-pressed', 'true')
    confirmation.mockRestore()
  })
})
