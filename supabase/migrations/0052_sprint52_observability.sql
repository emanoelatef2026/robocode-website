-- Sprint 52: Observability + Stability + Scale Hardening
-- All additive. ZERO destructive operations.

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: system_event_logs
-- Central event bus for all failures, warnings, and critical events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_event_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,            -- AUTOMATION_FAILURE|REALTIME_ERROR|JOB_FAILURE|NOTIFICATION_FAILURE|CONSISTENCY_MISMATCH|SECURITY_DENIAL|SLOW_QUERY|SYNC_ERROR|REPAIR_ACTION|DEPLOYMENT_CHECK
  severity       TEXT NOT NULL DEFAULT 'error', -- info|warning|error|critical
  module         TEXT NOT NULL,            -- which module logged this (automation-engine, background-jobs, etc.)
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id      UUID REFERENCES branches(id) ON DELETE CASCADE,
  entity_type    TEXT,                     -- student_enrollments|operational_tasks|background_jobs|etc.
  entity_id      UUID,
  message        TEXT NOT NULL,
  payload        JSONB DEFAULT '{}',
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_type_severity
  ON system_event_logs(type, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_module
  ON system_event_logs(module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_branch
  ON system_event_logs(branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_logs_unresolved
  ON system_event_logs(severity, created_at DESC)
  WHERE resolved = FALSE;

GRANT SELECT, INSERT ON system_event_logs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: automation_execution_log
-- Prevents the same trigger from firing for the same entity within a cooldown.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_execution_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type   TEXT NOT NULL,
  enrollment_id  UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES students(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES branches(id) ON DELETE CASCADE,
  executed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  skipped_reason TEXT,                    -- null = was executed; non-null = skipped (cooldown, etc.)
  result         TEXT,                    -- task_created|task_exists|no_action|skipped
  cooldown_hours SMALLINT NOT NULL DEFAULT 6,
  payload        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_automation_log_enrollment_trigger
  ON automation_execution_log(enrollment_id, trigger_type, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_log_student
  ON automation_execution_log(student_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_log_branch
  ON automation_execution_log(branch_id, executed_at DESC)
  WHERE branch_id IS NOT NULL;

GRANT SELECT, INSERT ON automation_execution_log TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: Task deduplication — unique partial index
-- Prevents duplicate active tasks for the same enrollment+type combination.
-- ─────────────────────────────────────────────────────────────────────────────

-- With enrollment (most specific — preferred)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_active_dedup_with_enrollment
  ON operational_tasks(enrollment_id, type)
  WHERE status IN ('OPEN', 'IN_PROGRESS') AND enrollment_id IS NOT NULL;

-- Without enrollment (fallback for student-level tasks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_active_dedup_student_only
  ON operational_tasks(student_id, type)
  WHERE status IN ('OPEN', 'IN_PROGRESS') AND enrollment_id IS NULL AND student_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: Background job improvements
-- Duration tracking + dead letter visibility
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS duration_ms INT,         -- how long the job ran (ms)
  ADD COLUMN IF NOT EXISTS last_error  TEXT,        -- most recent error message
  ADD COLUMN IF NOT EXISTS worker_id   TEXT;        -- which worker claimed the job

-- Dead letter jobs view — failed jobs with no retries left
CREATE OR REPLACE VIEW v_dead_letter_jobs AS
SELECT
  id, type, status, error, last_error, attempts, max_attempts,
  payload, scheduled_for, started_at, completed_at, branch_id, created_at
FROM background_jobs
WHERE status = 'FAILED'
  AND attempts >= max_attempts
ORDER BY created_at DESC;

GRANT SELECT ON v_dead_letter_jobs TO authenticated;

-- Job metrics view — counts by type/status for admin dashboard
CREATE OR REPLACE VIEW v_job_metrics AS
SELECT
  type,
  status,
  COUNT(*)                               AS count,
  AVG(duration_ms)                       AS avg_duration_ms,
  MAX(duration_ms)                       AS max_duration_ms,
  COUNT(*) FILTER (WHERE attempts > 1)   AS retry_count,
  MIN(created_at)                        AS oldest_at
FROM background_jobs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY type, status
ORDER BY type, status;

GRANT SELECT ON v_job_metrics TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 12: Notification delivery tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS opened_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_attempts SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at   TIMESTAMPTZ;

-- Delivery stats view
CREATE OR REPLACE VIEW v_notification_delivery_stats AS
SELECT
  type,
  channel,
  COUNT(*) FILTER (WHERE status = 'PENDING')     AS pending,
  COUNT(*) FILTER (WHERE status = 'SENT')        AS sent,
  COUNT(*) FILTER (WHERE status = 'FAILED')      AS failed,
  COUNT(*) FILTER (WHERE status = 'SUPPRESSED')  AS suppressed,
  COUNT(*) FILTER (WHERE opened_at IS NOT NULL)  AS opened,
  COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
  CASE WHEN COUNT(*) FILTER (WHERE status IN ('SENT','FAILED')) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'SENT') /
               NULLIF(COUNT(*) FILTER (WHERE status IN ('SENT','FAILED')), 0))
    ELSE NULL
  END                                            AS delivery_rate_pct,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
FROM notification_queue
GROUP BY type, channel;

GRANT SELECT ON v_notification_delivery_stats TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: Materialized views for dashboard performance
-- Refreshed by REFRESH_VIEWS background job — NOT on every write.
-- ─────────────────────────────────────────────────────────────────────────────

-- mv_branch_metrics: heavy join pre-computed per branch
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_branch_metrics AS
SELECT
  b.id                                   AS branch_id,
  b.name                                 AS branch_name,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active' AND s.deleted_at IS NULL)
                                         AS active_students,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')
                                         AS active_contracts,
  COALESCE(SUM(sfa.paid_amount)    FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                         AS revenue_collected,
  COALESCE(SUM(sfa.remaining_amount) FILTER (WHERE se.status = 'ACTIVE'), 0)
                                         AS outstanding,
  COUNT(DISTINCT sfa.id) FILTER (WHERE sfa.status = 'OVERDUE')
                                         AS overdue_count,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE' AND se.remaining_sessions <= 2 AND se.enrolled_sessions > 0)
                                         AS renewal_urgent,
  NOW()                                  AS refreshed_at
FROM branches b
LEFT JOIN students s   ON s.branch_id  = b.id
LEFT JOIN student_enrollments se ON se.branch_id = b.id
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_branch_metrics_pk
  ON mv_branch_metrics(branch_id);

GRANT SELECT ON mv_branch_metrics TO authenticated;

-- mv_retention_metrics: course retention pre-computed
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_retention_metrics AS
SELECT
  c.id                                   AS course_id,
  c.title,
  COUNT(DISTINCT se.id)                  AS total_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')     AS active_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED')  AS completed_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')    AS dropped_enrollments,
  COALESCE(SUM(sfa.paid_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                         AS total_collected,
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')
               / COUNT(DISTINCT se.id))
    ELSE 0
  END                                    AS dropout_pct,
  NOW()                                  AS refreshed_at
FROM courses c
LEFT JOIN group_courses gc ON gc.course_id = c.id
LEFT JOIN student_enrollments se ON (se.group_course_id = gc.id OR se.course_id = c.id)
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.title;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_retention_metrics_pk
  ON mv_retention_metrics(course_id);

GRANT SELECT ON mv_retention_metrics TO authenticated;

-- Function to refresh all materialized views (called by REFRESH_VIEWS job)
CREATE OR REPLACE FUNCTION refresh_operational_views()
RETURNS TABLE(view_name TEXT, success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_metrics;
    RETURN QUERY SELECT 'mv_branch_metrics'::TEXT, TRUE, NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'mv_branch_metrics'::TEXT, FALSE, SQLERRM;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_retention_metrics;
    RETURN QUERY SELECT 'mv_retention_metrics'::TEXT, TRUE, NULL::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'mv_retention_metrics'::TEXT, FALSE, SQLERRM;
  END;
END; $$;

GRANT EXECUTE ON FUNCTION refresh_operational_views() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 13: Executive alerts view
-- Detects critical operational conditions academy-wide.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_executive_alerts AS

-- Collection rate collapse (< 70%)
SELECT
  'COLLECTION_RATE_LOW'     AS alert_type,
  CASE WHEN bp.collection_rate_pct < 50 THEN 'CRITICAL'
       WHEN bp.collection_rate_pct < 70 THEN 'HIGH'
       ELSE 'WARNING'
  END                       AS severity,
  bp.branch_id,
  bp.branch_name,
  'Collection rate at ' || bp.collection_rate_pct || '%' AS message,
  bp.collection_rate_pct    AS metric_value
FROM v_branch_performance bp
WHERE bp.collection_rate_pct < 70

UNION ALL

-- Overdue explosion (> 10 overdue)
SELECT
  'OVERDUE_EXPLOSION',
  CASE WHEN bp.overdue_count > 25 THEN 'CRITICAL'
       WHEN bp.overdue_count > 10 THEN 'HIGH'
       ELSE 'WARNING'
  END,
  bp.branch_id, bp.branch_name,
  bp.overdue_count || ' overdue accounts',
  bp.overdue_count
FROM v_branch_performance bp
WHERE bp.overdue_count > 10

UNION ALL

-- Risk student concentration (> 20% of students at risk)
SELECT
  'HIGH_RISK_CONCENTRATION',
  'HIGH',
  bp.branch_id, bp.branch_name,
  bp.risk_students || ' at-risk students (' ||
    ROUND(100.0 * bp.risk_students / NULLIF(bp.active_students, 0)) || '%)',
  bp.risk_students
FROM v_branch_performance bp
WHERE bp.active_students > 0
  AND (100.0 * bp.risk_students / bp.active_students) > 20

UNION ALL

-- Failed automation jobs spike
SELECT
  'AUTOMATION_FAILURE_SPIKE',
  'HIGH',
  NULL::UUID, NULL::TEXT,
  COUNT(*) || ' failed automation tasks in the last 24h',
  COUNT(*)::NUMERIC
FROM background_jobs
WHERE type = 'PROCESS_AUTOMATION'
  AND status = 'FAILED'
  AND created_at >= NOW() - INTERVAL '24 hours'
HAVING COUNT(*) >= 3

UNION ALL

-- Dead letter jobs accumulating
SELECT
  'DEAD_LETTER_JOBS',
  'HIGH',
  NULL::UUID, NULL::TEXT,
  COUNT(*) || ' dead letter jobs requiring attention',
  COUNT(*)::NUMERIC
FROM background_jobs
WHERE status = 'FAILED'
  AND attempts >= max_attempts
  AND created_at >= NOW() - INTERVAL '7 days'
HAVING COUNT(*) >= 5

UNION ALL

-- Critical open tasks per branch
SELECT
  'CRITICAL_TASK_OVERLOAD',
  'HIGH',
  t.branch_id, b.name,
  COUNT(*) || ' critical open tasks',
  COUNT(*)::NUMERIC
FROM operational_tasks t
JOIN branches b ON b.id = t.branch_id
WHERE t.severity = 'CRITICAL'
  AND t.status IN ('OPEN', 'IN_PROGRESS')
GROUP BY t.branch_id, b.name
HAVING COUNT(*) >= 5;

GRANT SELECT ON v_executive_alerts TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 15: Deployment verification function
-- Returns pass/fail for each required DB object.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_deployment_requirements()
RETURNS TABLE (check_name TEXT, required TEXT, result BOOLEAN, detail TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tbl_exists BOOLEAN;
  view_exists BOOLEAN;
  idx_exists BOOLEAN;
BEGIN
  -- Required tables
  FOREACH tbl_exists IN ARRAY ARRAY[
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_enrollments')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='operational_tasks')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_queue')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='background_jobs')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_event_logs')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_execution_log')),
    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_timeline_events'))
  ] LOOP END LOOP;

  -- Check required views exist
  RETURN QUERY SELECT 'view:v_finance_contract_summary'::TEXT, 'view'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_finance_contract_summary'),
    'Finance contract summary view'::TEXT;

  RETURN QUERY SELECT 'view:v_executive_overview'::TEXT, 'view'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_executive_overview'),
    'Executive overview view'::TEXT;

  RETURN QUERY SELECT 'view:v_integrity_audit'::TEXT, 'view'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_integrity_audit'),
    'Integrity audit view'::TEXT;

  RETURN QUERY SELECT 'view:v_dead_letter_jobs'::TEXT, 'view'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_dead_letter_jobs'),
    'Dead letter jobs view'::TEXT;

  -- Required tables
  RETURN QUERY SELECT 'table:student_enrollments'::TEXT, 'table'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_enrollments'),
    'Student enrollments table'::TEXT;

  RETURN QUERY SELECT 'table:operational_tasks'::TEXT, 'table'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='operational_tasks'),
    'Operational tasks table'::TEXT;

  RETURN QUERY SELECT 'table:notification_queue'::TEXT, 'table'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_queue'),
    'Notification queue table'::TEXT;

  RETURN QUERY SELECT 'table:system_event_logs'::TEXT, 'table'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_event_logs'),
    'System event logs table'::TEXT;

  RETURN QUERY SELECT 'table:automation_execution_log'::TEXT, 'table'::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_execution_log'),
    'Automation execution log table'::TEXT;

  -- Required indexes
  RETURN QUERY SELECT 'index:idx_enrollments_student_active'::TEXT, 'index'::TEXT,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_enrollments_student_active'),
    'Active enrollments index'::TEXT;

  RETURN QUERY SELECT 'index:idx_tasks_active_dedup_with_enrollment'::TEXT, 'index'::TEXT,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_tasks_active_dedup_with_enrollment'),
    'Task dedup unique index'::TEXT;

  -- Required functions
  RETURN QUERY SELECT 'function:refresh_operational_views'::TEXT, 'function'::TEXT,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='refresh_operational_views'),
    'Materialized view refresh function'::TEXT;

  RETURN QUERY SELECT 'function:verify_deployment_requirements'::TEXT, 'function'::TEXT,
    TRUE,
    'This function itself'::TEXT;

END; $$;

GRANT EXECUTE ON FUNCTION verify_deployment_requirements() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8: Query performance baseline
-- Slow query tracking index + view
-- ─────────────────────────────────────────────────────────────────────────────

-- View for slow query events from system_event_logs
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT
  id,
  (payload->>'query_label')  AS query_label,
  (payload->>'duration_ms')::INT AS duration_ms,
  (payload->>'table')        AS table_name,
  branch_id,
  created_at
FROM system_event_logs
WHERE type = 'SLOW_QUERY'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY (payload->>'duration_ms')::INT DESC;

GRANT SELECT ON v_slow_queries TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 7: Consistency verification log
-- Stores mismatches between TypeScript engine and SQL views.
-- ─────────────────────────────────────────────────────────────────────────────

-- Reuses system_event_logs with type = 'CONSISTENCY_MISMATCH'
-- No separate table needed.

-- View for recent consistency mismatches
CREATE OR REPLACE VIEW v_consistency_mismatches AS
SELECT
  id,
  module,
  message,
  payload,
  entity_type,
  entity_id,
  branch_id,
  created_at
FROM system_event_logs
WHERE type = 'CONSISTENCY_MISMATCH'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

GRANT SELECT ON v_consistency_mismatches TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 14: System health score 2.0
-- Extended v_system_health_score (replaces/extends integrity audit)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_system_health_2 AS
WITH

-- Base integrity issues
integrity_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE severity = 'CRITICAL') AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'HIGH')     AS high_count,
    COUNT(*) FILTER (WHERE severity = 'MEDIUM')   AS medium_count,
    COUNT(*) FILTER (WHERE severity = 'LOW')      AS low_count
  FROM v_integrity_audit
),

-- System event issues (last 24h)
event_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE severity = 'critical' AND resolved = FALSE) AS critical_events,
    COUNT(*) FILTER (WHERE severity = 'error'    AND resolved = FALSE) AS error_events,
    COUNT(*) FILTER (WHERE type = 'SLOW_QUERY')                        AS slow_queries,
    COUNT(*) FILTER (WHERE type = 'AUTOMATION_FAILURE')                AS automation_failures,
    COUNT(*) FILTER (WHERE type = 'CONSISTENCY_MISMATCH')              AS consistency_mismatches
  FROM system_event_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),

-- Job health (last 24h)
job_health AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'FAILED' AND attempts >= max_attempts) AS dead_jobs,
    COUNT(*) FILTER (WHERE status = 'PENDING' AND scheduled_for < NOW() - INTERVAL '1 hour') AS stale_pending,
    COUNT(*) FILTER (WHERE status IN ('PENDING', 'RUNNING')) AS in_flight
  FROM background_jobs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),

-- Notification health (last 24h)
notif_health AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_notifications
  FROM notification_queue
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),

-- Duplicate tasks
task_health AS (
  SELECT
    COUNT(*) FILTER (
      WHERE status IN ('OPEN','IN_PROGRESS')
        AND due_date < CURRENT_DATE
    )                                          AS overdue_open_tasks
  FROM operational_tasks
)

SELECT
  NOW()                                        AS computed_at,
  -- Raw counts
  ic.critical_count,
  ic.high_count,
  ec.critical_events,
  ec.automation_failures,
  ec.slow_queries,
  ec.consistency_mismatches,
  jh.dead_jobs,
  jh.stale_pending,
  nh.failed_notifications,
  th.overdue_open_tasks,

  -- Health score (0-100)
  GREATEST(0,
    100
    - LEAST(40, ic.critical_count * 8)
    - LEAST(20, ic.high_count * 3)
    - LEAST(20, ec.critical_events * 10)
    - LEAST(10, ec.automation_failures * 2)
    - LEAST(10, jh.dead_jobs * 3)
    - LEAST(5,  nh.failed_notifications)
    - LEAST(5,  ec.slow_queries)
  )                                            AS health_score,

  -- Category
  CASE
    WHEN GREATEST(0,
      100
      - LEAST(40, ic.critical_count * 8)
      - LEAST(20, ic.high_count * 3)
      - LEAST(20, ec.critical_events * 10)
      - LEAST(10, ec.automation_failures * 2)
      - LEAST(10, jh.dead_jobs * 3)
      - LEAST(5,  nh.failed_notifications)
      - LEAST(5,  ec.slow_queries)
    ) >= 90 THEN 'excellent'
    WHEN GREATEST(0,
      100
      - LEAST(40, ic.critical_count * 8)
      - LEAST(20, ic.high_count * 3)
      - LEAST(20, ec.critical_events * 10)
      - LEAST(10, ec.automation_failures * 2)
      - LEAST(10, jh.dead_jobs * 3)
      - LEAST(5,  nh.failed_notifications)
      - LEAST(5,  ec.slow_queries)
    ) >= 75 THEN 'good'
    WHEN GREATEST(0,
      100
      - LEAST(40, ic.critical_count * 8)
      - LEAST(20, ic.high_count * 3)
      - LEAST(20, ec.critical_events * 10)
      - LEAST(10, ec.automation_failures * 2)
      - LEAST(10, jh.dead_jobs * 3)
      - LEAST(5,  nh.failed_notifications)
      - LEAST(5,  ec.slow_queries)
    ) >= 60 THEN 'attention'
    ELSE 'at_risk'
  END                                          AS health_category

FROM integrity_counts ic
CROSS JOIN event_counts ec
CROSS JOIN job_health jh
CROSS JOIN notif_health nh
CROSS JOIN task_health th;

GRANT SELECT ON v_system_health_2 TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 9: Storage validation tracking
-- Add file validation columns to receipts tracking
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS receipt_file_size_kb INT,
  ADD COLUMN IF NOT EXISTS receipt_mime_type    TEXT,
  ADD COLUMN IF NOT EXISTS receipt_validated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes added in Sprint 52
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_event_logs_entity
  ON system_event_logs(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_log_trigger_recent
  ON automation_execution_log(trigger_type, enrollment_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending_sched
  ON notification_queue(scheduled_for, status, channel)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_bg_jobs_status_type
  ON background_jobs(status, type, scheduled_for)
  WHERE status IN ('PENDING', 'RUNNING');
