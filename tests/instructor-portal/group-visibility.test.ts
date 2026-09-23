import { describe, expect, it } from 'vitest'
import {
  INSTRUCTOR_VISIBLE_GROUP_STATUSES,
  isGroupVisibleToInstructor,
} from '@/modules/instructor-portal/group-visibility'

describe('instructor group visibility', () => {
  it('keeps only running group records visible', () => {
    expect(INSTRUCTOR_VISIBLE_GROUP_STATUSES).toEqual(['active'])
    expect(isGroupVisibleToInstructor('active')).toBe(true)
    expect(isGroupVisibleToInstructor('handoff_pending')).toBe(false)
    expect(isGroupVisibleToInstructor('completed')).toBe(false)
    expect(isGroupVisibleToInstructor('forming')).toBe(false)
  })
})
