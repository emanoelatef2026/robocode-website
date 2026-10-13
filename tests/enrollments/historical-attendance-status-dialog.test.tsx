import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoricalReconciliationDialog } from '@/components/portal/shared/HistoricalReconciliationDialog'
import { applyHistoricalReconciliationAction, previewHistoricalReconciliationAction } from '@/modules/enrollments/historical-reconciliation'
import { computeReconciliationImpact } from '@/modules/enrollments/historical-reconciliation-shared'

vi.mock('@/modules/enrollments/historical-reconciliation', () => ({
  previewHistoricalReconciliationAction: vi.fn(), applyHistoricalReconciliationAction: vi.fn(),
}))
const enrollment = { id: 'contract', enrolled_sessions: 12, consumed_sessions: 0, remaining_sessions: 12, allow_overdraft_sessions: false, net_amount: 4400 }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(previewHistoricalReconciliationAction).mockResolvedValue({ success: true, data: {
    sessions: [
      { schedule_id: 'one', session_number: 1, topic: 'First lesson', scheduled_at: '2026-10-11T10:00:00Z', attendance_status: 'absent' },
      { schedule_id: 'two', session_number: 2, topic: 'Second lesson', scheduled_at: '2026-10-12T10:00:00Z', attendance_status: 'present' },
    ], enrollment, impactAll: computeReconciliationImpact(2, 2, enrollment), impactNextOnly: computeReconciliationImpact(2, 0, enrollment),
  } })
  vi.mocked(applyHistoricalReconciliationAction).mockResolvedValue({ success: true, data: { created: 2, consumed: 2, unfunded: 0, cancelled: false } })
})

describe('historical attendance status selection', () => {
  it('allows retry after a network rejection without closing or losing choices', async () => {
    const user = userEvent.setup()
    const resolved = vi.fn()
    const close = vi.fn()
    vi.mocked(applyHistoricalReconciliationAction).mockRejectedValueOnce(new Error('Network unavailable'))
    render(<HistoricalReconciliationDialog open studentId="student" groupId="group" onResolved={resolved} onClose={close} />)
    await screen.findByRole('combobox', { name: 'Attendance for lesson 1' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance for lesson 2' }), 'absent')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText(/Your selections are still here/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(applyHistoricalReconciliationAction).toHaveBeenLastCalledWith(expect.objectContaining({ choice: { mode: 'ALL', statuses: { one: 'absent', two: 'absent' } } }))
    expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ applied: true }))
  })

  it('preserves existing absence and sends individually chosen statuses with Apply All', async () => {
    const user = userEvent.setup()
    const resolved = vi.fn()
    render(<HistoricalReconciliationDialog open studentId="student" groupId="group" enrollmentId="contract" onResolved={resolved} onClose={vi.fn()} />)
    expect(await screen.findByRole('combobox', { name: 'Attendance for lesson 1' })).toHaveValue('absent')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance for lesson 2' }), 'late')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Selected attendance')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(applyHistoricalReconciliationAction).toHaveBeenCalledWith(expect.objectContaining({ choice: { mode: 'ALL', statuses: { one: 'absent', two: 'late' } } }))
    expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ applied: true }))
  })

  it('keeps manual selections/statuses when going back, including the pre-contract resolve flow', async () => {
    const user = userEvent.setup()
    const resolved = vi.fn()
    render(<HistoricalReconciliationDialog open mode="resolve" studentId="student" groupId="group" onResolved={resolved} onClose={vi.fn()} />)
    await screen.findByRole('combobox', { name: 'Attendance for lesson 1' })
    await user.click(screen.getByRole('button', { name: /Select Manually/ }))
    await user.click(screen.getAllByRole('checkbox')[0])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance for lesson 2' }), 'absent')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Attendance for lesson 2' })).toHaveValue('absent')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ applied: false, choice: { mode: 'MANUAL', scheduleIds: ['two'], statuses: { one: 'absent', two: 'absent' } } }))
    expect(applyHistoricalReconciliationAction).not.toHaveBeenCalled()
  })

  it('retains the dialog and its chosen statuses when saving fails', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    vi.mocked(applyHistoricalReconciliationAction).mockResolvedValueOnce({ success: false, error: { code: 'DB_ERROR', message: 'Try again' } })
    render(<HistoricalReconciliationDialog open studentId="student" groupId="group" onResolved={vi.fn()} onClose={close} />)
    await screen.findByRole('combobox', { name: 'Attendance for lesson 1' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance for lesson 2' }), 'excused')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Try again')).toBeInTheDocument()
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('combobox', { name: 'Attendance for lesson 2' })).toHaveValue('excused')
  })
})
