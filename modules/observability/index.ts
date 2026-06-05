import 'server-only'
import { createServiceClient }   from '@/lib/supabase/service'
import type { SystemEventInput, SystemEventRow, EventType, EventSeverity } from './types'

// ── Log a system event ────────────────────────────────────────────────────────
// Non-fatal — never throws. Logging failures are themselves silently dropped.

export async function logSystemEvent(input: SystemEventInput): Promise<void> {
  const db = createServiceClient()

  try {
    await db.from('system_event_logs').insert({
      type:          input.type,
      severity:      input.severity   ?? 'error',
      module:        input.module,
      message:       input.message,
      actor_user_id: input.actor_user_id ?? null,
      branch_id:     input.branch_id     ?? null,
      entity_type:   input.entity_type   ?? null,
      entity_id:     input.entity_id     ?? null,
      payload:       input.payload       ?? {},
    })
  } catch { /* non-fatal — logging must not break the caller */ }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function logError(
  module:  string,
  message: string,
  payload?: Record<string, unknown>
): Promise<void> {
  return logSystemEvent({ type: 'SYNC_ERROR', severity: 'error', module, message, payload })
}

export async function logAutomationFailure(
  module:    string,
  message:   string,
  context?:  { enrollment_id?: string; student_id?: string; branch_id?: string; trigger?: string }
): Promise<void> {
  return logSystemEvent({
    type:       'AUTOMATION_FAILURE',
    severity:   'error',
    module,
    message,
    branch_id:  context?.branch_id  ?? null,
    entity_type: 'student_enrollments',
    entity_id:  context?.enrollment_id ?? null,
    payload:    context ? { ...context } : {},
  })
}

export async function logJobFailure(
  jobId:   string,
  jobType: string,
  message: string,
  error?:  unknown
): Promise<void> {
  return logSystemEvent({
    type:        'JOB_FAILURE',
    severity:    'error',
    module:      'background-jobs',
    message,
    entity_type: 'background_jobs',
    entity_id:   jobId,
    payload:     { job_type: jobType, error: String(error ?? '') },
  })
}

export async function logNotificationFailure(
  notifId: string,
  message: string
): Promise<void> {
  return logSystemEvent({
    type:        'NOTIFICATION_FAILURE',
    severity:    'warning',
    module:      'notification-engine',
    message,
    entity_type: 'notification_queue',
    entity_id:   notifId,
    payload:     {},
  })
}

export async function logSlowQuery(
  module:     string,
  label:      string,
  durationMs: number,
  table?:     string
): Promise<void> {
  if (durationMs < 150) return  // only log genuinely slow queries
  return logSystemEvent({
    type:     'SLOW_QUERY',
    severity: durationMs > 1000 ? 'error' : 'warning',
    module,
    message:  `Slow query: ${label} took ${durationMs}ms`,
    payload:  { query_label: label, duration_ms: durationMs, table: table ?? '' },
  })
}

export async function logConsistencyMismatch(
  module:    string,
  entityType: string,
  entityId:  string,
  field:     string,
  tsValue:   unknown,
  sqlValue:  unknown,
  branchId?: string
): Promise<void> {
  const diff = typeof tsValue === 'number' && typeof sqlValue === 'number'
    ? Math.abs(tsValue - sqlValue)
    : null
  return logSystemEvent({
    type:        'CONSISTENCY_MISMATCH',
    severity:    'warning',
    module,
    message:     `${entityType}.${field}: TS=${tsValue}, SQL=${sqlValue}${diff != null ? ` (diff=${diff})` : ''}`,
    branch_id:   branchId ?? null,
    entity_type: entityType,
    entity_id:   entityId,
    payload:     { field, ts_value: tsValue, sql_value: sqlValue, diff },
  })
}

export async function logSecurityDenial(
  module:    string,
  userId:    string,
  resource:  string,
  branchId?: string
): Promise<void> {
  return logSystemEvent({
    type:         'SECURITY_DENIAL',
    severity:     'warning',
    module,
    message:      `Access denied to ${resource}`,
    actor_user_id: userId,
    branch_id:    branchId ?? null,
    payload:      { resource },
  })
}

export async function logRealtimeError(
  message: string,
  table:   string
): Promise<void> {
  return logSystemEvent({
    type:     'REALTIME_ERROR',
    severity: 'warning',
    module:   'realtime',
    message,
    payload:  { table },
  })
}

// ── Fetch recent events (for admin UI) ───────────────────────────────────────

export async function getSystemEvents(opts: {
  types?:       EventType[]
  severities?:  EventSeverity[]
  branchId?:    string
  module?:      string
  unresolvedOnly?: boolean
  limit?:       number
  offset?:      number
}): Promise<SystemEventRow[]> {
  const db = createServiceClient()

  let q = db
    .from('system_event_logs')
    .select('id, type, severity, module, actor_user_id, branch_id, entity_type, entity_id, message, payload, resolved, created_at')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)

  if (opts.offset)             q = q.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)
  if (opts.types?.length)      q = (q as any).in('type', opts.types)
  if (opts.severities?.length) q = (q as any).in('severity', opts.severities)
  if (opts.branchId)           q = q.eq('branch_id', opts.branchId)
  if (opts.module)             q = q.eq('module', opts.module)
  if (opts.unresolvedOnly)     q = q.eq('resolved', false)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id:          r.id,
    type:        r.type,
    severity:    r.severity,
    module:      r.module,
    actor_user_id: r.actor_user_id,
    branch_id:   r.branch_id,
    entity_type: r.entity_type,
    entity_id:   r.entity_id,
    message:     r.message,
    payload:     r.payload ?? {},
    resolved:    r.resolved,
    created_at:  r.created_at,
  }))
}

export async function resolveEvent(id: string): Promise<void> {
  const db = createServiceClient()
  await db.from('system_event_logs')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
}

// ── Profiling wrapper ─────────────────────────────────────────────────────────
// Phase 8: Wraps async operations and logs if they exceed threshold.

export async function withProfiling<T>(
  fn:          () => Promise<T>,
  label:       string,
  module:      string,
  thresholdMs = 150,
  table?:      string
): Promise<T> {
  const start = Date.now()
  const result = await fn()
  const dur = Date.now() - start
  if (dur >= thresholdMs) {
    await logSlowQuery(module, label, dur, table).catch(() => {/* non-fatal */})
  }
  return result
}

// ── Summary counts for health dashboard ──────────────────────────────────────

export async function getEventSummaryCounts(hoursBack = 24): Promise<{
  critical: number; error: number; warning: number; info: number
  automation_failures: number; slow_queries: number; consistency_mismatches: number
}> {
  const db = createServiceClient()
  const since = new Date(Date.now() - hoursBack * 3600000).toISOString()

  const { data } = await db
    .from('system_event_logs')
    .select('severity, type')
    .gte('created_at', since)
    .eq('resolved', false)

  const rows = (data ?? []) as any[]
  return {
    critical:               rows.filter(r => r.severity === 'critical').length,
    error:                  rows.filter(r => r.severity === 'error').length,
    warning:                rows.filter(r => r.severity === 'warning').length,
    info:                   rows.filter(r => r.severity === 'info').length,
    automation_failures:    rows.filter(r => r.type === 'AUTOMATION_FAILURE').length,
    slow_queries:           rows.filter(r => r.type === 'SLOW_QUERY').length,
    consistency_mismatches: rows.filter(r => r.type === 'CONSISTENCY_MISMATCH').length,
  }
}
