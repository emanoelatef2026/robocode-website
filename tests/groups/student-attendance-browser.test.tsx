import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentAttendancePanel from '@/app/portal/team-leader/groups/StudentAttendancePanel'
import { getStudentAttendanceBrowserAction } from '@/modules/groups/actions/attendance-browser'
import { filterStudentAttendance, summarizeStudentAttendance } from '@/modules/groups/attendance-browser'
import type { AttendanceContractOption, BrowsableAttendanceRecord } from '@/modules/groups/attendance-browser'

vi.mock('@/modules/groups/actions/attendance-browser', () => ({ getStudentAttendanceBrowserAction: vi.fn() }))

function contract(id: string, course: string, status = 'ACTIVE'): AttendanceContractOption {
  return { id, code: `CTR-${id}`, course_id: course, course_name: course, group_name: 'Group', start_date: '2026-10-01', status, enrolled_sessions: 12, consumed_sessions: 2, remaining_sessions: 10 }
}
function record(id: string, course: string, enrollment: string | null, status = 'present'): BrowsableAttendanceRecord {
  return { id, course_id: course, course_name: course, enrollment_id: enrollment, status, scheduled_at: `2026-10-${id.padStart(2, '0')}T10:00:00Z`, group_name: `Lesson ${id}`, instructor_name: null, topic: null, is_consumed: Boolean(enrollment) }
}
const records = [record('1', 'Python', 'old'), record('2', 'Python', 'new', 'absent'), record('3', 'Arduino', 'new'), record('4', 'Arduino', null, 'late')]
const data = { contracts: [contract('new', 'Python'), contract('old', 'Python', 'COMPLETED'), contract('arduino', 'Arduino')], records }

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getStudentAttendanceBrowserAction).mockResolvedValue(data) })

describe('student attendance selection', () => {
  it('shows a whole contract across groups/courses and counts actual ledger consumption, including absences', () => {
    const selected = filterStudentAttendance(records, 'Python', 'new')
    expect(selected.map(row => row.id)).toEqual(['3', '2'])
    expect(summarizeStudentAttendance(selected)).toEqual({ present: 1, absent: 1, late: 0, consumed: 2 })
    expect(summarizeStudentAttendance(records).consumed).toBe(3)
  })

  it('switches between old/new contracts and course history without another network request', async () => {
    const user = userEvent.setup()
    render(<StudentAttendancePanel studentId="student" defaultEnrollmentId="new" refreshVersion={0} onAddAttendance={vi.fn()} />)
    await screen.findByRole('combobox', { name: 'Attendance contract' })
    expect(screen.getByText('Lesson 2')).toBeInTheDocument()
    expect(screen.getByText('Lesson 3')).toBeInTheDocument()
    expect(screen.queryByText('Lesson 1')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance contract' }), 'old')
    expect(screen.getByText('Lesson 1')).toBeInTheDocument()
    expect(screen.queryByText('Lesson 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add attendance' })).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance course' }), 'Arduino')
    expect(screen.getByRole('combobox', { name: 'Attendance contract' })).toHaveValue('')
    expect(screen.getByText('Lesson 3')).toBeInTheDocument()
    expect(screen.getByText('Lesson 4')).toBeInTheDocument()
    expect(screen.queryByText('Lesson 1')).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('Filtered attendance totals')).getByText('Consumed').previousSibling).toHaveTextContent('1')
    expect(getStudentAttendanceBrowserAction).toHaveBeenCalledTimes(1)
  })

  it('adds to the selected contract, and refreshes its records after a save', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const { rerender } = render(<StudentAttendancePanel studentId="student" defaultEnrollmentId="old" refreshVersion={0} onAddAttendance={onAdd} />)
    await screen.findByRole('combobox', { name: 'Attendance contract' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Attendance contract' }), 'new')
    await user.click(screen.getByRole('button', { name: '+ Add attendance' }))
    expect(onAdd).toHaveBeenCalledWith(data.contracts[0])
    rerender(<StudentAttendancePanel studentId="student" defaultEnrollmentId="old" refreshVersion={1} onAddAttendance={onAdd} />)
    await screen.findByRole('combobox', { name: 'Attendance contract' })
    expect(screen.getByRole('combobox', { name: 'Attendance contract' })).toHaveValue('new')
    expect(getStudentAttendanceBrowserAction).toHaveBeenCalledTimes(2)
  })

  it('shows full history without contracts and recovers from a load failure', async () => {
    const user = userEvent.setup()
    vi.mocked(getStudentAttendanceBrowserAction).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce({ contracts: [], records: [records[3]] })
    render(<StudentAttendancePanel studentId="student" defaultEnrollmentId={null} refreshVersion={0} onAddAttendance={vi.fn()} />)
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Lesson 4')).toBeInTheDocument()
    expect(screen.getByText('Not charged to a contract')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add attendance' })).not.toBeInTheDocument()
  })

  it('keeps totals for all sessions while progressively revealing history beyond the old 10-record limit', async () => {
    const user = userEvent.setup()
    vi.mocked(getStudentAttendanceBrowserAction).mockResolvedValue({ contracts: [], records: Array.from({ length: 25 }, (_, i) => record(String(i + 1), 'Python', null)) })
    render(<StudentAttendancePanel studentId="student" defaultEnrollmentId={null} refreshVersion={0} onAddAttendance={vi.fn()} />)
    await screen.findByRole('combobox', { name: 'Attendance course' })
    expect(screen.queryByText('Lesson 1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show more (5 remaining)' }))
    expect(screen.getByText('Lesson 1')).toBeInTheDocument()
  })
})
