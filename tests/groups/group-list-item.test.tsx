import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GroupListItem } from '@/app/portal/team-leader/groups/workspace/components/GroupListItem'
import type { GroupOperationalRow } from '@/modules/groups/operational'

const group = {
  group_id: 'group-1', branch_id: 'branch-1', branch_name: 'Main Branch', name: 'Python L1 Thursday',
  code: 'PY-L1-THU', type: 'class', status: 'active', capacity: 12, student_count: 8, capacity_pct: 67,
  day_of_week: 'thursday', start_time: '18:00', duration_minutes: 90, start_date: '2026-08-01', end_date: null,
  meeting_link: null, notes: null, course_id: 'course-1', course_name: 'Python', lead_instructor_id: 'inst-1',
  lead_instructor_name: 'Ahmed Ali', asst_instructor_id: null, asst_instructor_name: null, active_allocation: null,
  has_instructor: true, has_course: true, attendance_avg: 88, assignment_avg: 75, portfolio_avg: 70,
  health_score: 82, is_low_attendance: false, is_low_capacity: false, is_overloaded: false, starts_soon: false,
  enrolled_students: [], completed_sessions: 4, planned_sessions: 12, open_ended: false,
  robocode_share_percent: 100, graduated_at: null, graduated_to_group_id: null, graduated_from_group_id: null,
  payment_completion_pct: 65, payment_paid_amount: 5200, payment_total_amount: 8000,
} as unknown as GroupOperationalRow

describe('GroupListItem', () => {
  it('presents session and payment completion at a glance', () => {
    render(<GroupListItem group={group} selected={false} onClick={() => {}} isSuperAdmin />)

    expect(screen.getByText('4 / 12 sessions')).toBeInTheDocument()
    expect(screen.getByText('65% collected')).toBeInTheDocument()
    expect(screen.getByText(/Thursday · 6:00 PM/)).toBeInTheDocument()
    expect(screen.getByText(/Started 1 Aug/)).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('data-group-stage', 'running')
    expect(screen.getByRole('button')).toHaveClass('p-2')
    expect(screen.getByRole('button')).toHaveAttribute('data-payment-status', 'follow-up')
    expect(screen.getByText('EGP 5,200 paid')).toHaveClass('text-[#15803D]')
    const feesBar = screen.getByRole('progressbar', { name: 'Fees completion' })
    expect(feesBar).toHaveAttribute('aria-valuenow', '65')
    expect(feesBar.nextElementSibling).toHaveTextContent('EGP 2,800 remaining')
  })

  it('keeps group financial totals hidden for Team Leaders', () => {
    render(<GroupListItem group={group} selected={false} onClick={() => {}} />)
    expect(screen.getByRole('progressbar', { name: 'Sessions completion' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: 'Fees completion' })).not.toBeInTheDocument()
    expect(screen.queryByText(/EGP/)).not.toBeInTheDocument()
    expect(screen.getByRole('button')).not.toHaveAttribute('data-payment-status')
  })

  it('shows 0% and the full remaining amount for an unpaid priced contract', () => {
    render(<GroupListItem group={{ ...group, payment_paid_amount: 0, payment_completion_pct: 100 }} selected={false} onClick={() => {}} isSuperAdmin />)
    expect(screen.getByText('0% collected')).toBeInTheDocument()
    expect(screen.getByText('EGP 8,000 remaining')).toBeInTheDocument()
  })

  it('distinguishes missing payment plans from unpaid contracts', () => {
    render(<GroupListItem group={{ ...group, payment_paid_amount: 0, payment_total_amount: 0 }} selected={false} onClick={() => {}} isSuperAdmin />)
    expect(screen.getByText('No payment plan')).toBeInTheDocument()
    expect(screen.getByText('Add a contract to track fees')).toBeInTheDocument()
    expect(screen.queryByText(/% collected/)).not.toBeInTheDocument()
  })

  it('caps the bar at 100% and never displays negative remaining money', () => {
    render(<GroupListItem group={{ ...group, payment_paid_amount: 9000 }} selected={false} onClick={() => {}} isSuperAdmin />)
    expect(screen.getByRole('progressbar', { name: 'Fees completion' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('EGP 0 remaining')).toBeInTheDocument()
  })
})
