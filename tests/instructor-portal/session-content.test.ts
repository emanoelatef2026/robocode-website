import { describe, expect, it } from 'vitest'
import { canEditSessionContent } from '@/modules/instructor-portal/session-content'

describe('session content editing', () => {
  it('allows educational edits after a session is completed', () => {
    expect(canEditSessionContent('completed')).toBe(true)
    expect(canEditSessionContent('ongoing')).toBe(true)
    expect(canEditSessionContent('cancelled')).toBe(false)
  })
})
