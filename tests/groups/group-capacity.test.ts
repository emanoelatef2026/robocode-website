import { describe, expect, it } from 'vitest'
import { updateSchema } from '@/modules/groups/actions/validators'

const GROUP_ID = '11111111-1111-4111-8111-111111111111'
const BRANCH_ID = '22222222-2222-4222-8222-222222222222'

describe('group capacity updates', () => {
  it('treats a blank capacity in edit mode as removing the limit', () => {
    const result = updateSchema.safeParse({
      id: GROUP_ID,
      branch_id: BRANCH_ID,
      name: 'Saturday App Inventor',
      type: 'class',
      capacity: '',
      status: 'active',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.capacity).toBeNull()
  })

  it('continues to reject zero as an invalid capacity', () => {
    const result = updateSchema.safeParse({
      id: GROUP_ID,
      branch_id: BRANCH_ID,
      name: 'Saturday App Inventor',
      type: 'class',
      capacity: '0',
      status: 'active',
    })

    expect(result.success).toBe(false)
  })
})
