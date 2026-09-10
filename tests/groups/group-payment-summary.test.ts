import { describe, expect, it } from 'vitest'
import { summarizeGroupPayments } from '@/modules/groups/payment-summary'

describe('summarizeGroupPayments', () => {
  it('uses an enrollment-linked finance account when the legacy group link is empty', () => {
    const payments = summarizeGroupPayments(
      ['group-1'],
      [{ id: 'enrollment-1', group_id: 'group-1', student_id: 'student-1' }],
      [{
        id: 'account-1', group_id: null, enrollment_id: 'enrollment-1', student_id: 'student-1',
        paid_amount: 450, remaining_amount: 550,
      }],
    )

    expect(payments.get('group-1')).toEqual({ paid: 450, total: 1000 })
  })

  it('keeps legacy student-only accounts only when the student belongs to one displayed group', () => {
    const payments = summarizeGroupPayments(
      ['group-1', 'group-2'],
      [
        { id: 'enrollment-1', group_id: 'group-1', student_id: 'student-1' },
        { id: 'enrollment-2', group_id: 'group-2', student_id: 'student-2' },
        { id: 'enrollment-3', group_id: 'group-1', student_id: 'student-3' },
        { id: 'enrollment-4', group_id: 'group-2', student_id: 'student-3' },
      ],
      [
        { id: 'account-1', group_id: null, enrollment_id: null, student_id: 'student-1', paid_amount: 300, remaining_amount: 200 },
        { id: 'account-2', group_id: null, enrollment_id: null, student_id: 'student-3', paid_amount: 900, remaining_amount: 100 },
      ],
    )

    expect(payments.get('group-1')).toEqual({ paid: 300, total: 500 })
    expect(payments.get('group-2')).toBeUndefined()
  })

  it('does not count the same direct group account twice', () => {
    const payments = summarizeGroupPayments(
      ['group-1'],
      [{ id: 'enrollment-1', group_id: 'group-1', student_id: 'student-1' }],
      [{ id: 'account-1', group_id: 'group-1', enrollment_id: 'enrollment-1', student_id: 'student-1', paid_amount: 100, remaining_amount: 0 }],
    )

    expect(payments.get('group-1')).toEqual({ paid: 100, total: 100 })
  })
})
