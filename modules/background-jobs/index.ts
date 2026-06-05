import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { logJobFailure }       from '@/modules/observability'

// ── Types ──────────────────────────────────────────────────────────────────────

export type JobType =
  | 'RECOMPUTE_SUMMARIES'
  | 'DETECT_STALE_BALANCES'
  | 'REFRESH_VIEWS'
  | 'PROCESS_AUTOMATION'
  | 'SEND_NOTIFICATIONS'
  | 'RECOMPUTE_SCORES'
  | 'ARCHIVE_EVENTS'
  | 'REPAIR_INTEGRITY'
  | 'PROCESS_COLLECTIONS'

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

export interface JobRow {
  id:           string
  type:         JobType
  status:       JobStatus
  payload:      Record<string, unknown>
  result:       Record<string, unknown> | null
  error:        string | null
  attempts:     number
  max_attempts: number
  scheduled_for: string
  started_at:   string | null
  completed_at: string | null
  branch_id:    string | null
  created_at:   string
}

// ── Enqueue a job ─────────────────────────────────────────────────────────────

export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown> = {},
  opts: {
    branchId?:     string
    scheduledFor?: string     // ISO timestamp (default: NOW)
    maxAttempts?:  number
  } = {}
): Promise<string> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('background_jobs')
    .insert({
      type,
      status:        'PENDING',
      payload,
      branch_id:     opts.branchId     ?? null,
      scheduled_for: opts.scheduledFor ?? new Date().toISOString(),
      max_attempts:  opts.maxAttempts  ?? 3,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to enqueue job')
  return data.id
}

// ── Claim the next pending job (atomic) ──────────────────────────────────────

export async function claimNextJob(
  types?: JobType[]
): Promise<JobRow | null> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  let q = db
    .from('background_jobs')
    .select('*')
    .eq('status', 'PENDING')
    .lte('scheduled_for', now)
    .lt('attempts', 3)   // raw column check before max_attempts
    .order('scheduled_for', { ascending: true })
    .limit(1)

  if (types?.length) q = (q as any).in('type', types)

  const { data } = await q
  if (!data?.length) return null

  const job = data[0] as any

  // Mark as running (optimistic lock)
  const { error } = await db
    .from('background_jobs')
    .update({
      status:     'RUNNING',
      started_at: now,
      attempts:   job.attempts + 1,
    })
    .eq('id', job.id)
    .eq('status', 'PENDING')   // ensure we won the race

  if (error) return null   // another worker claimed it

  return {
    id:           job.id,
    type:         job.type,
    status:       'RUNNING',
    payload:      job.payload ?? {},
    result:       null,
    error:        null,
    attempts:     job.attempts + 1,
    max_attempts: job.max_attempts,
    scheduled_for: job.scheduled_for,
    started_at:   now,
    completed_at: null,
    branch_id:    job.branch_id,
    created_at:   job.created_at,
  }
}

// ── Complete / fail a job ─────────────────────────────────────────────────────

export async function completeJob(
  id: string,
  result: Record<string, unknown> = {},
  startedAt?: number   // Date.now() when job started — used for duration tracking
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const update: Record<string, unknown> = {
    status:       'COMPLETED',
    completed_at: now,
    result,
    error:        null,
  }
  if (startedAt !== undefined) {
    update.duration_ms = Date.now() - startedAt
  }

  await db.from('background_jobs').update(update).eq('id', id)
}

export async function failJob(
  id:        string,
  error:     string,
  retryable  = true,
  jobType?:  string,
  startedAt?: number
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data: job } = await db
    .from('background_jobs')
    .select('attempts, max_attempts, type')
    .eq('id', id)
    .single()

  const exhausted = job ? job.attempts >= job.max_attempts : true
  const newStatus: JobStatus = exhausted ? 'FAILED' : 'PENDING'
  const retryAt   = retryable && !exhausted
    ? new Date(Date.now() + 5 * 60000).toISOString()
    : now

  const update: Record<string, unknown> = {
    status:        newStatus,
    last_error:    error,
    error:         exhausted ? error : null,
    completed_at:  exhausted ? now  : null,
    scheduled_for: retryAt,
  }
  if (startedAt !== undefined) update.duration_ms = Date.now() - startedAt

  await db.from('background_jobs').update(update).eq('id', id)

  // Log to observability if dead-lettered
  if (exhausted) {
    await logJobFailure(id, jobType ?? job?.type ?? 'UNKNOWN', error).catch(() => {/* non-fatal */})
  }
}

// ── Dead letter job management ────────────────────────────────────────────────

export async function getDeadLetterJobs(limit = 50): Promise<JobRow[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('v_dead_letter_jobs')
    .select('*')
    .limit(limit)

  return ((data ?? []) as any[]).map(r => ({
    id:           r.id,
    type:         r.type,
    status:       'FAILED' as JobStatus,
    payload:      r.payload ?? {},
    result:       null,
    error:        r.error ?? r.last_error ?? null,
    attempts:     r.attempts,
    max_attempts: r.max_attempts,
    scheduled_for: r.scheduled_for,
    started_at:   r.started_at,
    completed_at: r.completed_at,
    branch_id:    r.branch_id,
    created_at:   r.created_at,
  }))
}

export async function getJobMetrics(): Promise<Array<{
  type: JobType; status: JobStatus; count: number
  avg_duration_ms: number | null; retry_count: number
}>> {
  const db = createServiceClient()
  const { data } = await db.from('v_job_metrics').select('*')
  return ((data ?? []) as any[]).map(r => ({
    type:            r.type,
    status:          r.status,
    count:           Number(r.count ?? 0),
    avg_duration_ms: r.avg_duration_ms != null ? Math.round(Number(r.avg_duration_ms)) : null,
    retry_count:     Number(r.retry_count ?? 0),
  }))
}

// ── List recent jobs (for admin visibility) ───────────────────────────────────

export async function listRecentJobs(opts: {
  limit?:   number
  types?:   JobType[]
  statuses?: JobStatus[]
} = {}): Promise<JobRow[]> {
  const db = createServiceClient()

  let q = db
    .from('background_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)

  if (opts.types?.length)    q = (q as any).in('type', opts.types)
  if (opts.statuses?.length) q = (q as any).in('status', opts.statuses)

  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id:           r.id,
    type:         r.type,
    status:       r.status,
    payload:      r.payload ?? {},
    result:       r.result ?? null,
    error:        r.error ?? null,
    attempts:     r.attempts,
    max_attempts: r.max_attempts,
    scheduled_for: r.scheduled_for,
    started_at:   r.started_at,
    completed_at: r.completed_at,
    branch_id:    r.branch_id,
    created_at:   r.created_at,
  }))
}

// ── Job type labels ────────────────────────────────────────────────────────────

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  RECOMPUTE_SUMMARIES:   'Recompute Summaries',
  DETECT_STALE_BALANCES: 'Detect Stale Balances',
  REFRESH_VIEWS:         'Refresh Materialized Views',
  PROCESS_AUTOMATION:    'Process Automation Triggers',
  SEND_NOTIFICATIONS:    'Send Notifications',
  RECOMPUTE_SCORES:      'Recompute Dropout Scores',
  ARCHIVE_EVENTS:        'Archive Old Events',
  REPAIR_INTEGRITY:      'Repair Data Integrity',
  PROCESS_COLLECTIONS:   'Advance Collection Stages',
}
