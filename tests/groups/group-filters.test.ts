import { describe, expect, it } from 'vitest'
import { applyFilters } from '@/app/portal/team-leader/groups/workspace/utils'
import type { GroupOperationalRow } from '@/modules/groups/operational'

function group(name: string, day_of_week: string | null): GroupOperationalRow {
  return {
    group_id: name, branch_id: 'branch-1', branch_name: 'Main', name, code: null,
    type: 'class', status: 'active', capacity: 12, student_count: 4, capacity_pct: 33,
    day_of_week, start_time: '18:00', duration_minutes: 90, start_date: null, end_date: null,
    meeting_link: null, notes: null, course_id: 'course-1', course_name: 'Python',
    lead_instructor_id: 'instructor-1', lead_instructor_name: 'Instructor',
    asst_instructor_id: null, asst_instructor_name: null, active_allocation: null,
    has_instructor: true, has_course: true, attendance_avg: 90, assignment_avg: 90,
    portfolio_avg: 90, health_score: 90, is_low_attendance: false, is_low_capacity: true,
    is_overloaded: false, starts_soon: false, enrolled_students: [], completed_sessions: 4,
    planned_sessions: 12, open_ended: false, robocode_share_percent: 100,
    graduated_at: null, graduated_to_group_id: null, graduated_from_group_id: null,
    payment_completion_pct: null, payment_paid_amount: 0, payment_total_amount: 0,
  }
}

describe('applyFilters', () => {
  it('limits groups to the selected teaching day', () => {
    const groups = [group('Thursday Python', 'thursday'), group('Friday Robotics', 'friday')]

    const visible = applyFilters(groups, {
      q: '', branch_id: '', quickFilter: '', day_of_week: 'thursday',
    } as any)

    expect(visible.map(g => g.name)).toEqual(['Thursday Python'])
  })
})
