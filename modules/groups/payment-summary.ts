export interface GroupPaymentEnrollment {
  id: string
  group_id: string | null
  student_id: string
}

export interface GroupPaymentAccount {
  id: string
  group_id: string | null
  enrollment_id: string | null
  student_id: string
  paid_amount: number | string | null
  remaining_amount: number | string | null
}

export interface GroupPaymentSummary {
  paid: number
  total: number
}

/**
 * Resolves finance accounts to groups without attributing a student's legacy,
 * student-only account to multiple groups.
 */
export function summarizeGroupPayments(
  groupIds: string[],
  enrollments: GroupPaymentEnrollment[],
  accounts: GroupPaymentAccount[],
): Map<string, GroupPaymentSummary> {
  const allowedGroupIds = new Set(groupIds)
  const enrollmentToGroup = new Map<string, string>()
  const studentGroups = new Map<string, Set<string>>()

  for (const enrollment of enrollments) {
    if (!enrollment.group_id || !allowedGroupIds.has(enrollment.group_id)) continue
    enrollmentToGroup.set(enrollment.id, enrollment.group_id)
    const groups = studentGroups.get(enrollment.student_id) ?? new Set<string>()
    groups.add(enrollment.group_id)
    studentGroups.set(enrollment.student_id, groups)
  }

  const summary = new Map<string, GroupPaymentSummary>()
  const seenAccountIds = new Set<string>()

  for (const account of accounts) {
    if (seenAccountIds.has(account.id)) continue
    seenAccountIds.add(account.id)

    const groupId = account.group_id && allowedGroupIds.has(account.group_id)
      ? account.group_id
      : account.enrollment_id
        ? enrollmentToGroup.get(account.enrollment_id)
        : (() => {
            const groups = studentGroups.get(account.student_id)
            return groups?.size === 1 ? [...groups][0] : undefined
          })()

    if (!groupId) continue
    const current = summary.get(groupId) ?? { paid: 0, total: 0 }
    const paid = Number(account.paid_amount ?? 0)
    const balance = Number(account.remaining_amount ?? 0)
    current.paid += Number.isFinite(paid) ? paid : 0
    current.total += (Number.isFinite(paid) ? paid : 0) + (Number.isFinite(balance) ? balance : 0)
    summary.set(groupId, current)
  }

  return summary
}
