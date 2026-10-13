import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateStudentAttendanceStatusAction } from '@/modules/groups/actions/attendance-status'

const mocks = vi.hoisted(() => ({
  update: vi.fn(), inaccessible: false, missingRecord: false,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/modules/rbac/guards', () => ({ requirePermission: vi.fn(async () => ({ id: 'actor' })), isBranchAccessible: () => !mocks.inaccessible }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({
  rpc: vi.fn(async () => ({ error: null })),
  from: (table: string) => {
    let updating = false
    const chain = {
      select: () => chain, eq: vi.fn(() => chain), is: () => chain,
      update: (payload: unknown) => { updating = true; mocks.update(table, payload); return chain },
      maybeSingle: async () => ({ error: null, data: table === 'students' ? { branch_id: 'branch' } : table === 'schedules' ? { branch_id: 'branch', status: 'completed' } : mocks.missingRecord ? null : updating ? { id: 'record' } : { id: 'record', schedule_id: 'session', status: 'present' } }),
    }
    return chain
  },
}) }))
beforeEach(() => { vi.clearAllMocks(); mocks.inaccessible = false; mocks.missingRecord = false })
const input = { studentId: 'student', attendanceRecordId: 'record', status: 'absent' as const }
describe('individual attendance status editing', () => {
  it('updates only the attendance status and leaves its consumption ledger alone', async () => {
    expect(await updateStudentAttendanceStatusAction(input)).toEqual({ success: true })
    expect(mocks.update.mock.calls).toEqual([['attendance_records', { status: 'absent' }]])
  })
  it('rejects a record outside the accessible branch', async () => {
    mocks.inaccessible = true
    expect((await updateStudentAttendanceStatusAction(input)).success).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects a record that does not belong to the selected student', async () => {
    mocks.missingRecord = true
    expect((await updateStudentAttendanceStatusAction(input)).success).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
