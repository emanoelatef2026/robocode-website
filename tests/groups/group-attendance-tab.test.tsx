import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GroupAttendanceTab } from '@/app/portal/team-leader/groups/workspace/components/GroupAttendanceTab'

vi.mock('@/modules/groups/modal-actions', () => ({
  editGroupSessionAction:       vi.fn(),
  deleteGroupSessionAction:     vi.fn(),
  rebuildGroupAttendanceAction: vi.fn(),
}))

describe('GroupAttendanceTab', () => {
  it('shows only completed sessions in the attendance history', () => {
    render(
      <GroupAttendanceTab
        sessions={[
          {
            id: 'completed-session', scheduled_at: '2026-09-01T19:00:00.000Z',
            duration_minutes: 90, type: 'regular', status: 'completed', topic: 'Servo Motor',
            meeting_url: null, session_number: 10, present_count: 4, absent_count: 0,
            course_name: null, delivery: 'offline', student_attendance: [],
          },
          {
            id: 'past-scheduled-session', scheduled_at: '2026-08-27T19:00:00.000Z',
            duration_minutes: 90, type: 'regular', status: 'scheduled', topic: null,
            meeting_url: null, session_number: 9, present_count: 0, absent_count: 0,
            course_name: null, delivery: 'offline', student_attendance: [],
          },
          {
            id: 'upcoming-scheduled-session', scheduled_at: '2026-10-01T19:00:00.000Z',
            duration_minutes: 90, type: 'regular', status: 'scheduled', topic: null,
            meeting_url: null, session_number: 11, present_count: 0, absent_count: 0,
            course_name: null, delivery: 'offline', student_attendance: [],
          },
        ] as any}
        students={[]}
        group={{ group_id: 'group-1', attendance_avg: 100, student_count: 4 } as any}
        loading={false}
        isTL
        onOpenAddSession={vi.fn()}
        onSessionsChanged={vi.fn()}
      />,
    )

    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.queryByText('scheduled')).not.toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
