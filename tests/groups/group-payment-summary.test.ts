import { describe, expect, it } from 'vitest'
import { summarizeGroupFinance } from '@/modules/groups/payment-summary'

describe('summarizeGroupFinance', () => {
  it('matches the group Finance tab by using each displayed student’s finance account', () => {
    const payments = summarizeGroupFinance(
      [{ group_id: 'group-1', student_id: 'student-1' }],
      [{
        id: 'account-1', student_id: 'student-1',
        paid_amount: 450, remaining_amount: 550,
      }],
    )

    expect(payments.get('group-1')).toEqual({ paid: 450, total: 1000 })
  })

  it('counts the same student finance record for every group where the student is displayed', () => {
    const payments = summarizeGroupFinance(
      [
        { group_id: 'group-1', student_id: 'student-1' },
        { group_id: 'group-2', student_id: 'student-1' },
      ],
      [
        { id: 'account-1', student_id: 'student-1', paid_amount: 300, remaining_amount: 200 },
      ],
    )

    expect(payments.get('group-1')).toEqual({ paid: 300, total: 500 })
    expect(payments.get('group-2')).toEqual({ paid: 300, total: 500 })
  })

  it('uses one finance account per student, matching the Finance tab', () => {
    const payments = summarizeGroupFinance(
      [{ group_id: 'group-1', student_id: 'student-1' }],
      [
        { id: 'account-1', student_id: 'student-1', paid_amount: 100, remaining_amount: 0 },
        { id: 'account-2', student_id: 'student-1', paid_amount: 999, remaining_amount: 0 },
      ],
    )

    expect(payments.get('group-1')).toEqual({ paid: 100, total: 100 })
  })
})
