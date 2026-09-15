import { describe, expect, it } from 'vitest'
import { isFeedbackEligibleAttendanceStatus } from '@/modules/feedback/queries'

describe('session feedback eligibility', () => {
  it('allows students who attended', () => {
    expect(isFeedbackEligibleAttendanceStatus('present')).toBe(true)
    expect(isFeedbackEligibleAttendanceStatus('late')).toBe(true)
    expect(isFeedbackEligibleAttendanceStatus('makeup')).toBe(true)
  })

  it('does not ask absent or unmarked students for a review', () => {
    expect(isFeedbackEligibleAttendanceStatus('absent')).toBe(false)
    expect(isFeedbackEligibleAttendanceStatus('excused')).toBe(false)
    expect(isFeedbackEligibleAttendanceStatus(null)).toBe(false)
  })
})
