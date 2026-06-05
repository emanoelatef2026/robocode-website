import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import { logSystemEvent }         from '@/modules/observability'
import { runAutomationBatch }     from '@/modules/automation-engine'
import { processCollectionPipeline } from '@/modules/collections-pipeline'

// ── Phase 11: Data Recovery Toolkit ──────────────────────────────────────────
// Safe, idempotent repair operations. All are logged to system_event_logs.
// All return result objects — never throw without logging first.

export interface RecoveryResult {
  operation:   string
  success:     boolean
  repaired:    number
  skipped:     number
  total:       number
  duration_ms: number
  error?:      string
}

// ── Repair finance balances ───────────────────────────────────────────────────
// Fixes remaining_amount = MAX(0, net_amount - paid_amount) for all drifted accounts.

export async function repairFinanceBalances(
  branchIds?: string[]
): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = branchIds?.length
      ? await db.rpc('repair_finance_balances', { p_branch_id: branchIds[0] ?? null })
      : await db.rpc('repair_finance_balances', { p_branch_id: null })

    if (error) throw new Error(error.message)

    const row     = (data as any)?.[0] ?? { repaired: 0, skipped: 0, total: 0 }
    const result: RecoveryResult = {
      operation:   'repair_finance_balances',
      success:     true,
      repaired:    Number(row.repaired ?? 0),
      skipped:     Number(row.skipped  ?? 0),
      total:       Number(row.total    ?? 0),
      duration_ms: Date.now() - start,
    }

    await logSystemEvent({
      type:     'REPAIR_ACTION',
      severity: 'info',
      module:   'recovery',
      message:  `Finance balance repair: ${result.repaired} accounts fixed`,
      payload:  result as any,
    }).catch(() => {/* non-fatal */})

    return result
  } catch (err) {
    const result: RecoveryResult = {
      operation: 'repair_finance_balances', success: false,
      repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err),
    }
    await logSystemEvent({ type: 'SYNC_ERROR', severity: 'error', module: 'recovery', message: String(err) }).catch(() => {})
    return result
  }
}

// ── Rebuild missing contract codes ────────────────────────────────────────────

export async function rebuildMissingContractCodes(): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = await db.rpc('rebuild_missing_contract_codes')
    if (error) throw new Error(error.message)

    const repaired = Number(data ?? 0)
    const result: RecoveryResult = {
      operation: 'rebuild_missing_contract_codes', success: true,
      repaired, skipped: 0, total: repaired, duration_ms: Date.now() - start,
    }
    await logSystemEvent({ type: 'REPAIR_ACTION', severity: 'info', module: 'recovery',
      message: `Contract codes rebuilt: ${repaired}`, payload: result as any }).catch(() => {})
    return result
  } catch (err) {
    return { operation: 'rebuild_missing_contract_codes', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Cleanup orphan tasks ──────────────────────────────────────────────────────

export async function cleanupOrphanTasks(): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = await db.rpc('cleanup_orphan_tasks')
    if (error) throw new Error(error.message)

    const repaired = Number(data ?? 0)
    const result: RecoveryResult = {
      operation: 'cleanup_orphan_tasks', success: true,
      repaired, skipped: 0, total: repaired, duration_ms: Date.now() - start,
    }
    await logSystemEvent({ type: 'REPAIR_ACTION', severity: 'info', module: 'recovery',
      message: `Orphan tasks dismissed: ${repaired}`, payload: result as any }).catch(() => {})
    return result
  } catch (err) {
    return { operation: 'cleanup_orphan_tasks', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Recompute session consumption ─────────────────────────────────────────────

export async function recomputeSessionConsumption(enrollmentId?: string): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = await db.rpc('recompute_session_consumption', {
      p_enrollment_id: enrollmentId ?? null
    })
    if (error) throw new Error(error.message)

    const rows    = (data ?? []) as any[]
    const fixed   = rows.filter(r => r.fixed).length
    const result: RecoveryResult = {
      operation: 'recompute_session_consumption', success: true,
      repaired: fixed, skipped: rows.length - fixed, total: rows.length, duration_ms: Date.now() - start,
    }
    await logSystemEvent({ type: 'REPAIR_ACTION', severity: 'info', module: 'recovery',
      message: `Session consumption fixed: ${fixed} enrollments`, payload: result as any }).catch(() => {})
    return result
  } catch (err) {
    return { operation: 'recompute_session_consumption', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Repair orphan payments ────────────────────────────────────────────────────

export async function repairOrphanPayments(): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = await db.rpc('repair_orphan_payments')
    if (error) throw new Error(error.message)

    const repaired = Number(data ?? 0)
    const result: RecoveryResult = {
      operation: 'repair_orphan_payments', success: true,
      repaired, skipped: 0, total: repaired, duration_ms: Date.now() - start,
    }
    await logSystemEvent({ type: 'REPAIR_ACTION', severity: 'info', module: 'recovery',
      message: `Orphan payments re-linked: ${repaired}`, payload: result as any }).catch(() => {})
    return result
  } catch (err) {
    return { operation: 'repair_orphan_payments', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Regenerate tasks for stale enrollments ────────────────────────────────────
// Re-runs the automation engine for branches without active tasks recently.

export async function regenerateTasksForBranch(branchIds: string[]): Promise<RecoveryResult> {
  const start = Date.now()

  try {
    const result = await runAutomationBatch(branchIds)
    const recoveryResult: RecoveryResult = {
      operation:   'regenerate_tasks',
      success:     true,
      repaired:    result.tasks_created,
      skipped:     result.enrollments_processed - result.tasks_created,
      total:       result.enrollments_processed,
      duration_ms: Date.now() - start,
    }
    await logSystemEvent({ type: 'REPAIR_ACTION', severity: 'info', module: 'recovery',
      message: `Tasks regenerated: ${result.tasks_created} from ${result.enrollments_processed} enrollments`,
      payload: recoveryResult as any }).catch(() => {})
    return recoveryResult
  } catch (err) {
    return { operation: 'regenerate_tasks', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Reset automation cooldowns ────────────────────────────────────────────────

export async function resetAutomationCooldowns(enrollmentId?: string): Promise<RecoveryResult> {
  const db    = createServiceClient()
  const start = Date.now()

  try {
    const { data, error } = await db.rpc('reset_automation_cooldowns', {
      p_enrollment_id: enrollmentId ?? null
    })
    if (error) throw new Error(error.message)

    const cleared = Number(data ?? 0)
    return {
      operation: 'reset_automation_cooldowns', success: true,
      repaired: cleared, skipped: 0, total: cleared, duration_ms: Date.now() - start,
    }
  } catch (err) {
    return { operation: 'reset_automation_cooldowns', success: false, repaired: 0, skipped: 0, total: 0, duration_ms: Date.now() - start, error: String(err) }
  }
}

// ── Get recovery summary ──────────────────────────────────────────────────────

export interface RecoverySummaryItem {
  check_name:  string
  count:       number
  description: string
  severity:    'critical' | 'warning' | 'ok'
}

export async function getRecoverySummary(): Promise<RecoverySummaryItem[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc('get_recovery_summary')
  if (error || !data) return []

  return ((data ?? []) as any[]).map(r => ({
    check_name:  r.check_name,
    count:       Number(r.count ?? 0),
    description: r.description ?? '',
    severity:    Number(r.count) > 0 ? (
      ['orphan_payments','balance_drifts','missing_contract_codes','dead_letter_jobs'].includes(r.check_name)
        ? 'critical' : 'warning'
    ) : 'ok' as const,
  }))
}

// ── Run full recovery suite ───────────────────────────────────────────────────

export async function runFullRecoverySuite(branchIds?: string[]): Promise<{
  results:     RecoveryResult[]
  total_fixed: number
  duration_ms: number
}> {
  const start = Date.now()

  const results = await Promise.all([
    repairFinanceBalances(branchIds),
    rebuildMissingContractCodes(),
    cleanupOrphanTasks(),
    repairOrphanPayments(),
  ])

  const total_fixed = results.reduce((s, r) => s + r.repaired, 0)

  return {
    results,
    total_fixed,
    duration_ms: Date.now() - start,
  }
}
