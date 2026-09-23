import { describe, expect, it } from 'vitest'
import { GROUP_STATUS_OPTIONS } from '@/modules/groups/lifecycle-stage'

describe('group status options', () => {
  it('calls the active database state Running in admin-facing controls', () => {
    expect(GROUP_STATUS_OPTIONS).toContainEqual({ value: 'active', label: 'Running' })
    expect(GROUP_STATUS_OPTIONS.map((option) => option.label)).not.toContain('Active')
  })
})
