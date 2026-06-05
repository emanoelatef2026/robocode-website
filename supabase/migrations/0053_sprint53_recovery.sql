-- Sprint 53: Production War-Game + Load Testing
-- Recovery functions, performance analysis, load-test helpers
-- All additive. Zero destructive operations.

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: Data Recovery Functions
-- Safe, idempotent repair operations for production incidents.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── repair_finance_balances ────────────────────────────────────────────────────
-- Fixes remaining_amount for all accounts where it drifted from net_amount - paid_amount.
-- Returns count of repaired accounts.

CREATE OR REPLACE FUNCTION repair_finance_balances(p_branch_id UUID DEFAULT NULL)
RETURNS TABLE(repaired INT, skipped INT, total INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_repaired INT := 0;
  v_skipped  INT := 0;
  v_total    INT := 0;
BEGIN
  FOR v_total IN
    SELECT COUNT(*) FROM student_financial_accounts sfa
    WHERE (p_branch_id IS NULL OR sfa.branch_id = p_branch_id)
  LOOP END LOOP;

  UPDATE student_financial_accounts sfa
  SET
    remaining_amount = GREATEST(0, sfa.net_amount - sfa.paid_amount),
    updated_at       = NOW()
  WHERE
    (p_branch_id IS NULL OR sfa.branch_id = p_branch_id)
    AND ABS(sfa.remaining_amount - GREATEST(0, sfa.net_amount - sfa.paid_amount)) > 1;

  GET DIAGNOSTICS v_repaired = ROW_COUNT;
  v_skipped := (SELECT COUNT(*) FROM student_financial_accounts WHERE
    (p_branch_id IS NULL OR branch_id = p_branch_id)) - v_repaired;

  RETURN QUERY SELECT v_repaired, v_skipped,
    (SELECT COUNT(*)::INT FROM student_financial_accounts WHERE
      p_branch_id IS NULL OR branch_id = p_branch_id);
END; $$;

GRANT EXECUTE ON FUNCTION repair_finance_balances(UUID) TO authenticated;

-- ── rebuild_missing_contract_codes ────────────────────────────────────────────
-- Generates contract codes for ACTIVE enrollments that are missing them.
-- Uses the same CNT-YYYY-NNNNNN format as the Sprint 48 trigger.

CREATE OR REPLACE FUNCTION rebuild_missing_contract_codes()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year   TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  v_seq    INT;
  v_count  INT := 0;
  r        RECORD;
BEGIN
  FOR r IN
    SELECT id FROM student_enrollments
    WHERE status = 'ACTIVE' AND contract_code IS NULL
    ORDER BY created_at
  LOOP
    v_seq := nextval('contract_code_seq');
    UPDATE student_enrollments
    SET contract_code = 'CNT-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0')
    WHERE id = r.id AND contract_code IS NULL;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- Graceful fallback if contract_code_seq doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'contract_code_seq') THEN
    CREATE SEQUENCE contract_code_seq START 1000 INCREMENT 1;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION rebuild_missing_contract_codes() TO authenticated;

-- ── cleanup_orphan_tasks ───────────────────────────────────────────────────────
-- Dismisses open tasks for enrollments that are no longer ACTIVE.

CREATE OR REPLACE FUNCTION cleanup_orphan_tasks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  UPDATE operational_tasks t
  SET
    status       = 'DISMISSED',
    dismissed_at = NOW(),
    dismissed_reason = 'orphan: enrollment no longer active'
  WHERE t.status IN ('OPEN', 'IN_PROGRESS')
    AND t.enrollment_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM student_enrollments se
      WHERE se.id = t.enrollment_id AND se.status = 'ACTIVE'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION cleanup_orphan_tasks() TO authenticated;

-- ── recompute_session_consumption ────────────────────────────────────────────
-- Recounts consumed_sessions from attendance_records for enrollments
-- where the counter may have drifted from actual attendance.

CREATE OR REPLACE FUNCTION recompute_session_consumption(p_enrollment_id UUID DEFAULT NULL)
RETURNS TABLE(enrollment_id UUID, old_consumed INT, new_consumed INT, fixed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Count actual attendance records per enrollment
  attendance_counts AS (
    SELECT
      se.id                          AS enrollment_id,
      se.consumed_sessions           AS old_consumed,
      COALESCE(COUNT(ar.id) FILTER (
        WHERE ar.status IN ('present','late','makeup')
        AND ar.recorded_at >= se.start_date::TIMESTAMPTZ
      ), 0)::INT                     AS actual_attended
    FROM student_enrollments se
    LEFT JOIN group_students gs   ON gs.student_id = se.student_id
      AND gs.group_id = se.group_id
      AND gs.status = 'active'
    LEFT JOIN schedules sch       ON sch.group_course_id = se.group_course_id
      AND sch.status = 'completed'
      AND sch.scheduled_at >= se.start_date::TIMESTAMPTZ
    LEFT JOIN attendance_records ar ON ar.schedule_id = sch.id
      AND ar.student_id = se.student_id
    WHERE se.status = 'ACTIVE'
      AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
    GROUP BY se.id, se.consumed_sessions
  ),
  -- Update drifted enrollments
  updated AS (
    UPDATE student_enrollments se
    SET
      consumed_sessions  = ac.actual_attended,
      remaining_sessions = GREATEST(0, se.enrolled_sessions - ac.actual_attended)
    FROM attendance_counts ac
    WHERE se.id = ac.enrollment_id
      AND ABS(se.consumed_sessions - ac.actual_attended) > 0
      AND se.enrolled_sessions > 0
    RETURNING se.id, ac.old_consumed, ac.actual_attended
  )
  SELECT
    ac.enrollment_id,
    ac.old_consumed,
    ac.actual_attended AS new_consumed,
    (u.id IS NOT NULL) AS fixed
  FROM attendance_counts ac
  LEFT JOIN updated u ON u.id = ac.enrollment_id;
END; $$;

GRANT EXECUTE ON FUNCTION recompute_session_consumption(UUID) TO authenticated;

-- ── repair_orphan_payments ─────────────────────────────────────────────────────
-- Attempts to link orphan payments (no account_id, no enrollment_id) to
-- the student's primary financial account.

CREATE OR REPLACE FUNCTION repair_orphan_payments()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT := 0;
BEGIN
  UPDATE finance_payments fp
  SET account_id = sfa.id
  FROM student_financial_accounts sfa
  WHERE fp.account_id IS NULL
    AND fp.enrollment_id IS NULL
    AND fp.student_id = sfa.student_id
    AND sfa.id = (
      SELECT id FROM student_financial_accounts
      WHERE student_id = fp.student_id
      ORDER BY created_at DESC LIMIT 1
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION repair_orphan_payments() TO authenticated;

-- ── reset_automation_cooldowns ────────────────────────────────────────────────
-- Clears automation_execution_log for a specific enrollment or all.
-- USE WITH CAUTION: allows automation to re-fire immediately.

CREATE OR REPLACE FUNCTION reset_automation_cooldowns(p_enrollment_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  DELETE FROM automation_execution_log
  WHERE (p_enrollment_id IS NULL OR enrollment_id = p_enrollment_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION reset_automation_cooldowns(UUID) TO authenticated;

-- ── get_recovery_summary ──────────────────────────────────────────────────────
-- Returns a quick summary of what needs recovery without executing repairs.

CREATE OR REPLACE FUNCTION get_recovery_summary()
RETURNS TABLE(check_name TEXT, count INT, description TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT
    'balance_drifts'::TEXT,
    COUNT(*)::INT,
    'Finance accounts where remaining ≠ net - paid'
  FROM student_financial_accounts
  WHERE ABS(remaining_amount - GREATEST(0, net_amount - paid_amount)) > 1;

  RETURN QUERY SELECT
    'missing_contract_codes'::TEXT,
    COUNT(*)::INT,
    'Active enrollments missing contract code'
  FROM student_enrollments
  WHERE status = 'ACTIVE' AND contract_code IS NULL;

  RETURN QUERY SELECT
    'orphan_tasks'::TEXT,
    COUNT(*)::INT,
    'Open tasks for non-active enrollments'
  FROM operational_tasks t
  WHERE t.status IN ('OPEN', 'IN_PROGRESS')
    AND t.enrollment_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM student_enrollments se
      WHERE se.id = t.enrollment_id AND se.status = 'ACTIVE'
    );

  RETURN QUERY SELECT
    'orphan_payments'::TEXT,
    COUNT(*)::INT,
    'Payments with no account or enrollment link'
  FROM finance_payments
  WHERE account_id IS NULL AND enrollment_id IS NULL;

  RETURN QUERY SELECT
    'session_drift'::TEXT,
    COUNT(*)::INT,
    'Enrollments where consumed_sessions may be incorrect'
  FROM student_enrollments se
  WHERE se.status = 'ACTIVE'
    AND se.enrolled_sessions > 0
    AND se.dropout_scored_at IS NULL;

  RETURN QUERY SELECT
    'dead_letter_jobs'::TEXT,
    COUNT(*)::INT,
    'Background jobs that exhausted retries'
  FROM background_jobs
  WHERE status = 'FAILED' AND attempts >= max_attempts;

  RETURN QUERY SELECT
    'stale_pending_jobs'::TEXT,
    COUNT(*)::INT,
    'Jobs scheduled > 1 hour ago still pending'
  FROM background_jobs
  WHERE status = 'PENDING'
    AND scheduled_for < NOW() - INTERVAL '1 hour';
END; $$;

GRANT EXECUTE ON FUNCTION get_recovery_summary() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8: Performance Analysis Views
-- ─────────────────────────────────────────────────────────────────────────────

-- Query performance buckets view
CREATE OR REPLACE VIEW v_query_performance AS
SELECT
  (payload->>'query_label')                   AS query_label,
  (payload->>'module')                         AS module,
  COUNT(*)                                     AS sample_count,
  ROUND(AVG((payload->>'duration_ms')::NUMERIC)) AS avg_ms,
  MIN((payload->>'duration_ms')::INT)          AS min_ms,
  MAX((payload->>'duration_ms')::INT)          AS max_ms,
  COUNT(*) FILTER (WHERE (payload->>'duration_ms')::INT > 500)  AS over_500ms,
  COUNT(*) FILTER (WHERE (payload->>'duration_ms')::INT > 1000) AS over_1000ms
FROM system_event_logs
WHERE type = 'SLOW_QUERY'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY payload->>'query_label', payload->>'module'
ORDER BY avg_ms DESC;

GRANT SELECT ON v_query_performance TO authenticated;

-- RLS policy audit view — lists policies and their filter expressions
CREATE OR REPLACE VIEW v_rls_audit AS
SELECT
  tablename,
  policyname,
  cmd,
  qual      AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

GRANT SELECT ON v_rls_audit TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: RLS Penetration Test Helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- List tables WITHOUT RLS enabled (security gap detection)
CREATE OR REPLACE VIEW v_tables_without_rls AS
SELECT
  c.relname                              AS table_name,
  c.relrowsecurity                       AS rls_enabled,
  c.relforcerowsecurity                  AS rls_forced,
  (
    SELECT COUNT(*)
    FROM pg_policies p
    WHERE p.tablename = c.relname AND p.schemaname = 'public'
  )                                       AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'        -- tables only
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '_prisma%'
ORDER BY c.relname;

GRANT SELECT ON v_tables_without_rls TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: Background Job Health Function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_job_health_summary()
RETURNS TABLE(
  metric TEXT, value INT, status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Stuck running jobs (running > 10 minutes)
  RETURN QUERY SELECT
    'stuck_running_jobs'::TEXT,
    COUNT(*)::INT,
    CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END
  FROM background_jobs
  WHERE status = 'RUNNING'
    AND started_at < NOW() - INTERVAL '10 minutes';

  -- Dead letter count
  RETURN QUERY SELECT
    'dead_letter_jobs'::TEXT,
    COUNT(*)::INT,
    CASE WHEN COUNT(*) > 5 THEN 'CRITICAL'
         WHEN COUNT(*) > 0 THEN 'WARNING'
         ELSE 'OK' END
  FROM background_jobs
  WHERE status = 'FAILED' AND attempts >= max_attempts
    AND created_at >= NOW() - INTERVAL '7 days';

  -- Overdue pending jobs
  RETURN QUERY SELECT
    'overdue_pending_jobs'::TEXT,
    COUNT(*)::INT,
    CASE WHEN COUNT(*) > 10 THEN 'WARNING' ELSE 'OK' END
  FROM background_jobs
  WHERE status = 'PENDING'
    AND scheduled_for < NOW() - INTERVAL '1 hour';

  -- Failed notification rate (last 24h)
  RETURN QUERY SELECT
    'failed_notifications_24h'::TEXT,
    COUNT(*)::INT,
    CASE WHEN COUNT(*) > 50 THEN 'CRITICAL'
         WHEN COUNT(*) > 10 THEN 'WARNING'
         ELSE 'OK' END
  FROM notification_queue
  WHERE status = 'FAILED'
    AND created_at >= NOW() - INTERVAL '24 hours';
END; $$;

GRANT EXECUTE ON FUNCTION get_job_health_summary() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 12: Production Capacity Analysis View
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_capacity_analysis AS
SELECT
  b.id                                        AS branch_id,
  b.name                                      AS branch_name,

  -- Actual load
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active')
                                              AS students,
  COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'active')
                                              AS active_groups,
  COUNT(DISTINCT instr.id)                    AS instructors,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')
                                              AS active_contracts,

  -- Capacity headroom (assuming 20 students/group, 5 groups/instructor)
  (COUNT(DISTINCT instr.id) * 5 * 20)        AS estimated_capacity,
  CASE
    WHEN COUNT(DISTINCT instr.id) * 5 * 20 = 0 THEN NULL
    ELSE ROUND(100.0 * COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') /
               (COUNT(DISTINCT instr.id) * 5 * 20))
  END                                         AS capacity_utilization_pct,

  -- Operational load indicators
  COALESCE(t_counts.open_tasks, 0)            AS open_tasks,
  COALESCE(t_counts.critical_tasks, 0)        AS critical_tasks

FROM branches b
LEFT JOIN students s       ON s.branch_id  = b.id
LEFT JOIN groups g         ON g.branch_id  = b.id AND g.deleted_at IS NULL
LEFT JOIN instructors instr ON instr.branch_id = b.id AND instr.deleted_at IS NULL
  AND instr.status = 'active'
LEFT JOIN student_enrollments se ON se.branch_id = b.id
LEFT JOIN (
  SELECT
    branch_id,
    COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS'))         AS open_tasks,
    COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS')
                     AND severity = 'CRITICAL')                       AS critical_tasks
  FROM operational_tasks
  GROUP BY branch_id
) t_counts ON t_counts.branch_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, t_counts.open_tasks, t_counts.critical_tasks;

GRANT SELECT ON v_capacity_analysis TO authenticated;
