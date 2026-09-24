import { describe, expect, it } from 'vitest'
import { filterStudentOptions } from '@/app/portal/team-leader/groups/workspace/utils'
import type { GroupStudentOption } from '@/modules/groups/operational'

const student: GroupStudentOption = {
  student_id: 'student-1',
  student_name: 'Aya Ahmed',
  student_code: 'STU-000012',
  age: 11,
  branch_id: 'branch-1',
  branch_name: 'ElShrouk City',
  phone: '01000000000',
  parent_phone: '01000000001',
  group_name: 'Online Python 1',
  attendance_pct: null,
  sessions_remaining: null,
}

describe('group student picker search', () => {
  it('finds a student code whether the visible # prefix is included or not', () => {
    expect(filterStudentOptions([student], [], '#STU-000012')).toEqual([student])
    expect(filterStudentOptions([student], [], 'STU-000012')).toEqual([student])
  })
})
