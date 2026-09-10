export interface GroupFinanceStudent {
  group_id: string
  student_id: string
}

export interface GroupFinanceAccount {
  id: string
  student_id: string
  paid_amount: number | string | null
  remaining_amount: number | string | null
}

export interface GroupPaymentSummary {
  paid: number
  total: number
}

/**
 * Mirrors the Finance tab: one financial account per visible group student.
 */
export function summarizeGroupFinance(
  groupStudents: GroupFinanceStudent[],
  accounts: GroupFinanceAccount[],
): Map<string, GroupPaymentSummary> {
  const accountByStudent = new Map<string, GroupFinanceAccount>()
  for (const account of accounts) {
    if (!accountByStudent.has(account.student_id)) accountByStudent.set(account.student_id, account)
  }

  const summary = new Map<string, GroupPaymentSummary>()
  for (const groupStudent of groupStudents) {
    const account = accountByStudent.get(groupStudent.student_id)
    if (!account) continue
    const current = summary.get(groupStudent.group_id) ?? { paid: 0, total: 0 }
    const paid = Number(account.paid_amount ?? 0)
    const balance = Number(account.remaining_amount ?? 0)
    current.paid += Number.isFinite(paid) ? paid : 0
    current.total += (Number.isFinite(paid) ? paid : 0) + (Number.isFinite(balance) ? balance : 0)
    summary.set(groupStudent.group_id, current)
  }

  return summary
}
