import 'server-only'
import { createServiceClient }      from '@/lib/supabase/service'
import { computeStudentRisk }        from '@/modules/operational-engine'
import { logConsistencyMismatch }    from '@/modules/observability'

// ── Phase 7: Consistency Verification ────────────────────────────────────────
// Compares TypeScript engine outputs against SQL view calculations.
// Logs mismatches to system_event_logs.

export interface ConsistencyReport {
  checked:    number
  mismatches: number
  details:    Array<{
    entity_type: string
    entity_id:   string
    field:       string
    ts_value:    unknown
    sql_value:   unknown
  }>
}

// ── Verify finance balances ───────────────────────────────────────────────────
// Compares net_amount - paid_amount against remaining_amount in the DB.

export async function verifyFinanceConsistency(
  branchIds: string[],
  opts: { limit?: number; logMismatches?: boolean } = {}
): Promise<ConsistencyReport> {
  if (!branchIds.length) return { checked: 0, mismatches: 0, details: [] }

  const db = createServiceClient()
  const { data } = await db
    .from('student_financial_accounts')
    .select('id, student_id, branch_id, net_amount, paid_amount, remaining_amount')
    .in('branch_id', branchIds)
    .limit(opts.limit ?? 500)

  const rows    = (data ?? []) as any[]
  const details: ConsistencyReport['details'] = []

  for (const row of rows) {
    const net      = Number(row.net_amount ?? 0)
    const paid     = Number(row.paid_amount ?? 0)
    const stored   = Number(row.remaining_amount ?? 0)
    const expected = Math.max(0, net - paid)

    if (Math.abs(stored - expected) > 1) {  // 1 EGP tolerance
      details.push({
        entity_type: 'student_financial_accounts',
        entity_id:   row.id,
        field:       'remaining_amount',
        ts_value:    expected,
        sql_value:   stored,
      })

      if (opts.logMismatches !== false) {
        await logConsistencyMismatch(
          'consistency-checker',
          'student_financial_accounts',
          row.id,
          'remaining_amount',
          expected,
          stored,
          row.branch_id
        ).catch(() => {/* non-fatal */})
      }
    }
  }

  return { checked: rows.length, mismatches: details.length, details }
}

// ── Verify operational risk scores ────────────────────────────────────────────
// Compares dropout_category stored on enrollment vs recomputed from live data.

export async function verifyRiskScoreConsistency(
  branchIds: string[],
  opts: { limit?: number; logMismatches?: boolean } = {}
): Promise<ConsistencyReport> {
  if (!branchIds.length) return { checked: 0, mismatches: 0, details: [] }

  const db = createServiceClient()

  // Fetch enrollments with stored dropout_category
  const { data: enrollments } = await db
    .from('student_enrollments')
    .select('id, student_id, branch_id, dropout_category, financial_status')
    .in('branch_id', branchIds)
    .eq('status', 'ACTIVE')
    .not('dropout_category', 'is', null)
    .limit(opts.limit ?? 200)

  const rows = (enrollments ?? []) as any[]
  if (!rows.length) return { checked: 0, mismatches: 0, details: [] }

  // Fetch linked financial data
  const enrollIds = rows.map(r => r.id as string)
  const { data: accountData } = await db
    .from('student_financial_accounts')
    .select('enrollment_id, remaining_amount, next_due_date, status')
    .in('enrollment_id', enrollIds)

  const accMap = new Map<string, any>()
  for (const a of (accountData ?? []) as any[]) {
    if (!accMap.has(a.enrollment_id)) accMap.set(a.enrollment_id, a)
  }

  const details: ConsistencyReport['details'] = []

  for (const row of rows) {
    const acc = accMap.get(row.id)
    if (!acc) continue

    const daysOverdue = acc.next_due_date && new Date(acc.next_due_date) < new Date()
      ? Math.floor((Date.now() - new Date(acc.next_due_date).getTime()) / 86400000)
      : 0

    const tsRisk = computeStudentRisk({
      attendance_pct:       0,  // simplified — attendance data not fetched here
      financial_status:     acc.status ?? row.financial_status,
      days_overdue:         daysOverdue,
      consecutive_absences: 0,
      sessions_attended:    0,
      remaining_amount:     Number(acc.remaining_amount ?? 0),
    })

    // Basic check: if stored says SAFE but TS says HIGH, that's a mismatch
    const storedLevel  = row.dropout_category as string
    const computedLevel = tsRisk.level

    // Only flag gross discrepancies (SAFE vs HIGH, not SAFE vs MEDIUM)
    const grossMismatch =
      (storedLevel === 'SAFE'  && computedLevel === 'HIGH') ||
      (storedLevel === 'CRITICAL' && computedLevel === 'LOW')

    if (grossMismatch) {
      details.push({
        entity_type: 'student_enrollments',
        entity_id:   row.id,
        field:       'dropout_category',
        ts_value:    computedLevel,
        sql_value:   storedLevel,
      })

      if (opts.logMismatches !== false) {
        await logConsistencyMismatch(
          'consistency-checker',
          'student_enrollments',
          row.id,
          'dropout_category',
          computedLevel,
          storedLevel,
          row.branch_id
        ).catch(() => {/* non-fatal */})
      }
    }
  }

  return { checked: rows.length, mismatches: details.length, details }
}

// ── Verify payment totals ─────────────────────────────────────────────────────
// Compares SUM(finance_payments) against paid_amount on accounts.

export async function verifyPaymentTotals(
  branchIds: string[],
  opts: { limit?: number; logMismatches?: boolean } = {}
): Promise<ConsistencyReport> {
  if (!branchIds.length) return { checked: 0, mismatches: 0, details: [] }

  const db = createServiceClient()

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('id, student_id, branch_id, paid_amount')
    .in('branch_id', branchIds)
    .limit(opts.limit ?? 300)

  const accountIds = (accounts ?? []).map((a: any) => a.id as string)
  if (!accountIds.length) return { checked: 0, mismatches: 0, details: [] }

  // Sum payments per account
  const { data: paymentSums } = await db
    .from('finance_payments')
    .select('account_id, amount')
    .in('account_id', accountIds)
    .gt('amount', 0)  // exclude reversals for this check

  const payMap = new Map<string, number>()
  for (const p of (paymentSums ?? []) as any[]) {
    payMap.set(p.account_id, (payMap.get(p.account_id) ?? 0) + Number(p.amount))
  }

  const details: ConsistencyReport['details'] = []
  for (const acc of (accounts ?? []) as any[]) {
    const sumFromPayments = payMap.get(acc.id) ?? 0
    const storedPaidAmount = Number(acc.paid_amount ?? 0)
    if (Math.abs(sumFromPayments - storedPaidAmount) > 1) {
      details.push({
        entity_type: 'student_financial_accounts',
        entity_id:   acc.id,
        field:       'paid_amount',
        ts_value:    sumFromPayments,
        sql_value:   storedPaidAmount,
      })
      if (opts.logMismatches !== false) {
        await logConsistencyMismatch(
          'consistency-checker',
          'student_financial_accounts',
          acc.id,
          'paid_amount',
          sumFromPayments,
          storedPaidAmount,
          acc.branch_id
        ).catch(() => {/* non-fatal */})
      }
    }
  }

  return { checked: (accounts ?? []).length, mismatches: details.length, details }
}

// ── Run full consistency suite ────────────────────────────────────────────────

export async function runConsistencyChecks(
  branchIds: string[]
): Promise<{ finance: ConsistencyReport; paymentTotals: ConsistencyReport; riskScores: ConsistencyReport }> {
  const [finance, paymentTotals, riskScores] = await Promise.all([
    verifyFinanceConsistency(branchIds, { limit: 500, logMismatches: true }),
    verifyPaymentTotals(branchIds, { limit: 300, logMismatches: true }),
    verifyRiskScoreConsistency(branchIds, { limit: 200, logMismatches: true }),
  ])
  return { finance, paymentTotals, riskScores }
}
