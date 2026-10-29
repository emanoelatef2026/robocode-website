import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstructorNextActions from '@/components/portal/instructor/InstructorNextActions'
import TodaySessionCard from '@/components/portal/instructor/TodaySessionCard'
import { instructorError, recoverInstructorAction } from '@/modules/instructor-portal/ux'
import type { TodaySession } from '@/modules/instructor-portal/types'

afterEach(cleanup)
const emptyTasks = { ongoing: [], reviews: [], reviewCount: 0 }

describe('instructor next steps and recovery', () => {
  it('prioritizes unfinished lead classes and links to the exact assistant change review', () => {
    render(<InstructorNextActions tasks={{ ongoing: [{ sessionId: 'open', groupId: 'g', groupName: 'Demo group' }], reviews: [{ sessionId: 'review', groupId: 'g', groupName: 'Demo group' }], reviewCount: 1 }} today={[]} pendingReviews={2} unavailable={false} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Continue my class')
    expect(links[0]).toHaveAttribute('href', '/portal/instructor/groups/g/sessions/open')
    expect(screen.getByRole('link', { name: 'Review changes' })).toHaveAttribute('href', '/portal/instructor/groups/g/sessions/review#change-requests')
    expect(screen.getByRole('link', { name: 'Start reviewing' })).toHaveAttribute('href', '/portal/instructor/review')
  })
  it('does not report all caught up when task loading failed', () => {
    render(<InstructorNextActions tasks={emptyTasks} today={[]} pendingReviews={0} unavailable />)
    expect(screen.queryByText(/You’re up to date/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('could not load all class tasks')
    expect(screen.getByRole('link', { name: 'View my groups' })).toBeInTheDocument()
  })
  it('opens the group for a scheduled regular class rather than bypassing the shared class selection', () => {
    render(<TodaySessionCard session={{ id: 's', group_id: 'g', status: 'scheduled', session_type: 'primary', scheduled_at: '2026-10-29T15:00:00Z', duration_minutes: 90, group_name: 'Demo group', student_count: 4 } as TodaySession} />)
    expect(screen.getByRole('link', { name: 'Open Class' })).toHaveAttribute('href', '/portal/instructor/groups/g')
  })
  it('does not display raw database or runtime errors', () => {
    expect(instructorError({ code: 'DB_ERROR', message: 'column secret_schema.field does not exist at query 42' })).not.toMatch(/secret_schema|column|query/)
    expect(instructorError({ message: 'Attendance changed. Reload the latest class before proposing changes.' })).toMatch(/Another instructor.*Reload/)
    expect(instructorError({ message: 'Session list changed. Refresh before starting.' })).toMatch(/Refresh the list/)
  })
  it('converts network exceptions into actionable failure without claiming that work was saved', async () => {
    const action = vi.fn().mockRejectedValue(new Error('Network failed'))
    const result = await recoverInstructorAction(action)(null, new FormData())
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toMatch(/could not confirm.*try again/)
  })
})
