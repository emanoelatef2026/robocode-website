import { describe, expect, it } from 'vitest'
import { isSessionWithinInstructorAllocation } from '@/modules/instructor-portal/queries'

describe('instructor session history allocation filtering', () => {
  const allocation = { from_session: 10, to_session: 12 }

  it('keeps only sessions inside the instructor allocation', () => {
    expect(isSessionWithinInstructorAllocation(9, allocation)).toBe(false)
    expect(isSessionWithinInstructorAllocation(10, allocation)).toBe(true)
    expect(isSessionWithinInstructorAllocation(12, allocation)).toBe(true)
    expect(isSessionWithinInstructorAllocation(13, allocation)).toBe(false)
  })

  it('does not hide legacy sessions without a canonical number', () => {
    expect(isSessionWithinInstructorAllocation(null, allocation)).toBe(true)
  })

  it('allows open-ended allocations to continue indefinitely', () => {
    expect(isSessionWithinInstructorAllocation(999, { from_session: 10, to_session: null })).toBe(true)
  })
})
