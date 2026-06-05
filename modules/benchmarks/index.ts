import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { logSlowQuery }        from '@/modules/observability'

// ── Phase 8: Query Benchmark Harness ─────────────────────────────────────────
// Wraps key operational queries with timing. Logs slow results.
// Used by the /api/admin/benchmark endpoint and production readiness page.

export interface BenchmarkResult {
  label:       string
  duration_ms: number
  status:      'fast' | 'ok' | 'slow' | 'critical' | 'error'
  target_ms:   number   // SLA target
  row_count?:  number
  error?:      string
}

// SLA targets (ms)
const TARGETS: Record<string, number> = {
  dashboard_load:     500,
  finance_list:       500,
  global_search:      150,
  student_ops_list:   500,
  enrollment_create:  200,
  attendance_save:    200,
  payment_create:     200,
  integrity_check:    1000,
  task_count:         100,
  work_queue_load:    500,
}

function status(ms: number, target: number): BenchmarkResult['status'] {
  if (ms <= target * 0.5) return 'fast'
  if (ms <= target)        return 'ok'
  if (ms <= target * 2)    return 'slow'
  return 'critical'
}

// ── Run individual benchmark ──────────────────────────────────────────────────
// fn can return any thenable (Supabase query builders are PromiseLike, not Promise)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bench(
  label:    string,
  fn:       () => any,
  targetMs: number
): Promise<BenchmarkResult> {
  const start = Date.now()
  try {
    const result  = await fn()
    const ms      = Date.now() - start
    const rows    = result.count ?? (Array.isArray(result.data) ? result.data.length : undefined)
    const st      = status(ms, targetMs)

    if (ms >= targetMs) {
      await logSlowQuery('benchmarks', label, ms).catch(() => {/* non-fatal */})
    }

    return { label, duration_ms: ms, status: st, target_ms: targetMs, row_count: rows }
  } catch (err) {
    return {
      label, duration_ms: Date.now() - start,
      status: 'error', target_ms: targetMs, error: String(err),
    }
  }
}

// ── Core benchmark suite ──────────────────────────────────────────────────────

export async function runBenchmarks(branchIds: string[]): Promise<{
  results:    BenchmarkResult[]
  summary:    { fast: number; ok: number; slow: number; critical: number; error: number }
  passed_sla: boolean
  duration_ms: number
}> {
  const db    = createServiceClient()
  const start = Date.now()
  const bid   = branchIds[0] ?? null  // use first branch for single-branch tests

  const results = await Promise.all([

    // 1. Dashboard load — count active KPIs
    bench('dashboard_load', () =>
      db.from('student_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE')
        .in('branch_id', branchIds),
      TARGETS.dashboard_load
    ),

    // 2. Finance contract summary view
    bench('finance_list', () =>
      db.from('v_finance_contract_summary')
        .select('enrollment_id, student_name, remaining_amount, financial_status')
        .in('branch_id', branchIds)
        .eq('enrollment_status', 'ACTIVE')
        .limit(50),
      TARGETS.finance_list
    ),

    // 3. Global search (by name prefix)
    bench('global_search', () =>
      db.from('profiles').select('user_id, first_name, last_name').ilike('first_name', 'A%').limit(20),
      TARGETS.global_search
    ),

    // 4. Student operations list
    bench('student_ops_list', () =>
      db.from('v_finance_contract_summary')
        .select('*')
        .in('branch_id', branchIds)
        .limit(100),
      TARGETS.student_ops_list
    ),

    // 5. Task count query
    bench('task_count', () =>
      db.from('operational_tasks')
        .select('id', { count: 'exact', head: true })
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .in('branch_id', branchIds),
      TARGETS.task_count
    ),

    // 6. Work queue load (simulates getWorkQueues)
    bench('work_queue_load', () =>
      db.from('student_enrollments')
        .select('id, student_id, remaining_sessions, financial_status, enrolled_sessions')
        .eq('status', 'ACTIVE')
        .in('branch_id', branchIds)
        .limit(1000),
      TARGETS.work_queue_load
    ),

    // 7. Integrity check (v_integrity_audit)
    bench('integrity_check', () =>
      db.from('v_integrity_audit')
        .select('issue_type, severity')
        .limit(100),
      TARGETS.integrity_check
    ),

    // 8. Notification queue pending
    bench('notification_queue', () =>
      db.from('notification_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      100
    ),

    // 9. Timeline events for a branch
    bench('timeline_events', () =>
      db.from('student_timeline_events')
        .select('id, event_type, created_at')
        .eq('branch_id', bid!)
        .order('created_at', { ascending: false })
        .limit(50),
      300
    ),

    // 10. Branch performance view
    bench('branch_performance', () =>
      db.from('v_branch_performance').select('*').limit(20),
      500
    ),
  ])

  const summary = {
    fast:     results.filter(r => r.status === 'fast').length,
    ok:       results.filter(r => r.status === 'ok').length,
    slow:     results.filter(r => r.status === 'slow').length,
    critical: results.filter(r => r.status === 'critical').length,
    error:    results.filter(r => r.status === 'error').length,
  }

  return {
    results,
    summary,
    passed_sla:  summary.critical === 0 && summary.error === 0,
    duration_ms: Date.now() - start,
  }
}

// ── Status display helpers ────────────────────────────────────────────────────

export const BENCHMARK_STATUS_CONFIG: Record<BenchmarkResult['status'], {
  label: string; color: string; text: string; icon: string
}> = {
  fast:     { label: 'Fast',     color: 'bg-emerald-100', text: 'text-emerald-700', icon: '⚡' },
  ok:       { label: 'OK',       color: 'bg-blue-100',    text: 'text-blue-700',    icon: '✓' },
  slow:     { label: 'Slow',     color: 'bg-amber-100',   text: 'text-amber-700',   icon: '⚠' },
  critical: { label: 'Critical', color: 'bg-red-100',     text: 'text-red-700',     icon: '🔴' },
  error:    { label: 'Error',    color: 'bg-red-200',     text: 'text-red-800',     icon: '✗' },
}
