import { describe, expect, it } from 'vitest'
import {
  checkConsumptionEligibility,
  resolveAttendanceEnrollment,
  type EnrollmentForConsumption,
} from '@/modules/academic/contract-consumption'

const consuming = new Set(['present', 'absent', 'late', 'makeup', 'excused'])

const legacy: EnrollmentForConsumption = {
  id: 'legacy', start_date: '2026-06-01', end_date: null,
  enrolled_sessions: 12, remaining_sessions: 8, allow_overdraft: false,
}

const groupContract: EnrollmentForConsumption = {
  id: 'group-contract', group_id: 'group-a', course_id: 'course-a',
  start_date: '2026-09-22', end_date: null,
  enrolled_sessions: 12, remaining_sessions: 12, allow_overdraft: false,
}

describe('group attendance contract resolution', () => {
  it('uses the group contract rather than an unrelated legacy contract', () => {
    const resolution = resolveAttendanceEnrollment([legacy, groupContract], {
      groupId: 'group-a', courseId: 'course-a', sessionDate: '2026-09-08T20:00:00.000Z',
    })

    expect(resolution.enrollment?.id).toBe('group-contract')
    expect(resolution.allowHistoricalGroupSession).toBe(true)
  })

  it('does not charge an unrelated generic contract', () => {
    const resolution = resolveAttendanceEnrollment([legacy], {
      groupId: 'group-a', courseId: 'course-a', sessionDate: '2026-09-08T20:00:00.000Z',
    })

    expect(resolution.enrollment).toBeNull()
  })

  it('consumes an admin-recorded historical group session, including absence', () => {
    const check = checkConsumptionEligibility(
      'absent',
      '2026-09-08T20:00:00.000Z',
      groupContract,
      consuming,
      { allowPreEnrollment: true },
    )

    expect(check.shouldConsume).toBe(true)
    expect(check.reason).toBe('eligible')
  })
})
