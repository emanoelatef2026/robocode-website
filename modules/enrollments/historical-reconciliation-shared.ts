// Historical Enrollment Reconciliation — types + pure calculation logic.
// Split out of historical-reconciliation.ts (a 'use server' module, which may
// only export async functions) so this can be imported from both server code
// and client components (HistoricalReconciliationDialog.tsx) without pulling
// server-only dependencies into the browser bundle.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoricalSessionRow {
  schedule_id:    string
  session_number: number | null
  topic:          string | null
  scheduled_at:   string
}

export interface EnrollmentSummary {
  id:                        string
  enrolled_sessions:         number
  consumed_sessions:         number
  remaining_sessions:        number
  allow_overdraft_sessions:  boolean
  net_amount:                number
}

export interface ReconciliationImpact {
  completed_count:             number
  contract_remaining:          number
  selected_count:              number
  sessions_to_consume:         number
  remaining_after:             number
  shortfall:                   number
  amount_per_session:          number | null
  financial_impact:            number | null   // value of sessions applied — null when unknown
  requires_additional_payment: boolean
  warnings:                    string[]
}

export interface PreviewHistoricalReconciliationInput {
  studentId:     string
  groupId:       string
  courseId?:     string | null
  enrollmentId?: string | null
}

export interface PreviewHistoricalReconciliationResult {
  sessions:       HistoricalSessionRow[]
  enrollment:     EnrollmentSummary | null
  impactAll:      ReconciliationImpact
  impactNextOnly: ReconciliationImpact
}

export type ReconciliationChoice =
  | { mode: 'ALL' }
  | { mode: 'MANUAL'; scheduleIds: string[] }
  | { mode: 'NEXT_ONLY' }

export type ShortfallResolution = 'CONSUME_WHAT_FITS' | 'UNPAID_PENDING' | 'CANCEL'

export interface ApplyHistoricalReconciliationInput {
  studentId:            string
  groupId:              string
  courseId?:            string | null
  enrollmentId?:        string | null   // resolved via findActiveEnrollmentForCourse when omitted
  choice:               ReconciliationChoice
  shortfallResolution?: ShortfallResolution
  performedBy:          string
  branchId?:            string | null
}

export interface ApplyHistoricalReconciliationResult {
  created:   number
  consumed:  number
  unfunded:  number
  cancelled: boolean
}

// Client-callable wrapper input. `performedBy` is never taken from the
// caller — a client component cannot be trusted to supply its own actor id.
export type ApplyHistoricalReconciliationActionInput = Omit<ApplyHistoricalReconciliationInput, 'performedBy'>

// ── Impact calculation ────────────────────────────────────────────────────────

export function computeReconciliationImpact(
  completedCount: number,
  selectedCount:  number,
  enrollment:     EnrollmentSummary | null
): ReconciliationImpact {
  const warnings: string[] = []

  if (!enrollment) {
    if (selectedCount > 0) {
      warnings.push('No active contract for this course — historical sessions cannot be consumed until a contract exists.')
    }
    return {
      completed_count:             completedCount,
      contract_remaining:          0,
      selected_count:              selectedCount,
      sessions_to_consume:         0,
      remaining_after:             0,
      shortfall:                   selectedCount,
      amount_per_session:          null,
      financial_impact:            null,
      requires_additional_payment: selectedCount > 0,
      warnings,
    }
  }

  const remaining  = enrollment.remaining_sessions
  const unlimited  = enrollment.allow_overdraft_sessions
  const openEnded  = enrollment.enrolled_sessions === 0

  const toConsume = openEnded || unlimited ? selectedCount : Math.min(selectedCount, remaining)
  const shortfall = openEnded || unlimited ? 0 : Math.max(0, selectedCount - remaining)

  const amountPerSession = enrollment.enrolled_sessions > 0
    ? enrollment.net_amount / enrollment.enrolled_sessions
    : null
  const financialImpact = amountPerSession !== null
    ? Math.round(amountPerSession * toConsume * 100) / 100
    : null

  if (openEnded) {
    warnings.push('Contract is open-ended (no session cap) — sessions will not be tracked against a limit.')
  }
  if (shortfall > 0) {
    warnings.push(`${shortfall} session(s) exceed the remaining contract balance (${remaining} remaining).`)
  }

  return {
    completed_count:             completedCount,
    contract_remaining:          remaining,
    selected_count:              selectedCount,
    sessions_to_consume:         toConsume,
    remaining_after:             Math.max(0, remaining - toConsume),
    shortfall,
    amount_per_session:          amountPerSession,
    financial_impact:            financialImpact,
    requires_additional_payment: shortfall > 0,
    warnings,
  }
}
