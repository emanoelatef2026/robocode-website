import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Phase 15: Deployment safety checks ───────────────────────────────────────
// Verifies required DB objects exist before the app serves requests.
// Call from API health check or startup probe.

export interface DeploymentCheck {
  name:     string
  required: string   // table | view | index | function
  passed:   boolean
  detail:   string
  critical: boolean  // if critical and fails → app should halt
}

export interface DeploymentReport {
  all_passed:    boolean
  critical_ok:   boolean
  passed:        number
  failed:        number
  checks:        DeploymentCheck[]
  checked_at:    string
}

// ── Run all deployment checks via DB function ─────────────────────────────────

export async function runDeploymentChecks(): Promise<DeploymentReport> {
  const db = createServiceClient()
  const checkedAt = new Date().toISOString()

  const { data, error } = await db.rpc('verify_deployment_requirements')

  if (error) {
    // Function itself might not exist (pre-0052 env) — return safe fallback
    return {
      all_passed:  false,
      critical_ok: false,
      passed:      0,
      failed:      1,
      checks:      [{
        name:     'function:verify_deployment_requirements',
        required: 'function',
        passed:   false,
        detail:   `DB function missing: ${error.message}`,
        critical: true,
      }],
      checked_at: checkedAt,
    }
  }

  const rows = (data ?? []) as any[]
  const checks: DeploymentCheck[] = rows.map(r => ({
    name:     r.check_name ?? '',
    required: r.required   ?? '',
    passed:   Boolean(r.result),
    detail:   r.detail ?? '',
    critical: _isCritical(r.check_name ?? ''),
  }))

  // Add runtime checks (things we can't verify in SQL)
  checks.push(..._runtimeChecks())

  const passed      = checks.filter(c => c.passed).length
  const failed      = checks.filter(c => !c.passed).length
  const critical_ok = checks.filter(c => c.critical && !c.passed).length === 0

  return {
    all_passed:  failed === 0,
    critical_ok,
    passed,
    failed,
    checks,
    checked_at:  checkedAt,
  }
}

// ── Which checks are critical (app should fail hard) ─────────────────────────

function _isCritical(name: string): boolean {
  return [
    'table:student_enrollments',
    'table:operational_tasks',
    'table:system_event_logs',
    'view:v_finance_contract_summary',
    'view:v_integrity_audit',
    'index:idx_enrollments_student_active',
    'index:idx_tasks_active_dedup_with_enrollment',
  ].includes(name)
}

// ── Runtime checks (environment variables, etc.) ──────────────────────────────

function _runtimeChecks(): DeploymentCheck[] {
  const checks: DeploymentCheck[] = []

  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  for (const key of requiredEnv) {
    checks.push({
      name:     `env:${key}`,
      required: 'env',
      passed:   Boolean(process.env[key]),
      detail:   process.env[key] ? `${key} is set` : `${key} is MISSING`,
      critical: true,
    })
  }

  return checks
}

// ── Simple fast check (for /api/system/health) ────────────────────────────────
// Returns 200 OK or 503 Service Unavailable. Does not run full DB check.

export async function pingDatabase(): Promise<{ ok: boolean; latency_ms: number }> {
  const db    = createServiceClient()
  const start = Date.now()
  const { error } = await db.from('branches').select('id', { head: true, count: 'exact' }).limit(1)
  return { ok: !error, latency_ms: Date.now() - start }
}
