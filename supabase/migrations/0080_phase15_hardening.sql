-- Phase 15: Operational Stabilization & Performance Hardening
-- All changes are additive CREATE OR REPLACE / CREATE INDEX IF NOT EXISTS.
-- Safe to re-apply idempotently.

-- ─────────────────────────────────────────────────────────────────────────────
-- v_dashboard_overview
-- Branch-level KPI summary consumed by the TL dashboard without client
-- aggregation. One row per branch.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_dashboard_overview AS
SELECT
  b.id                           AS branch_id,
  b.name                         AS branch_name,

  -- Student headcount
  (
    SELECT COUNT(*)::int FROM students s
    WHERE s.branch_id = b.id AND s.status = 'active' AND s.deleted_at IS NULL
  ) AS active_students,

  -- Active groups
  (
    SELECT COUNT(*)::int FROM groups g
    WHERE g.branch_id = b.id AND g.status IN ('active', 'forming') AND g.deleted_at IS NULL
  ) AS active_groups,

  -- Groups needing instructor
  (
    SELECT COUNT(*)::int FROM groups g
    WHERE g.branch_id = b.id
      AND g.status IN ('active', 'forming')
      AND g.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM group_courses gc
        WHERE gc.group_id = g.id AND gc.status = 'active' AND gc.instructor_id IS NOT NULL
      )
  ) AS groups_missing_instructor,

  -- Students with overdue accounts
  (
    SELECT COUNT(DISTINCT sfa.student_id)::int
    FROM student_financial_accounts sfa
    JOIN students s ON s.id = sfa.student_id
    WHERE s.branch_id = b.id AND s.deleted_at IS NULL AND sfa.status = 'OVERDUE'
  ) AS overdue_accounts,

  -- Students with 0 sessions remaining (need renewal)
  (
    SELECT COUNT(DISTINCT se.student_id)::int
    FROM student_enrollments se
    JOIN students s ON s.id = se.student_id
    WHERE s.branch_id = b.id AND s.deleted_at IS NULL
      AND se.status = 'ACTIVE'
      AND se.remaining_sessions IS NOT NULL
      AND se.remaining_sessions <= 0
  ) AS sessions_exhausted,

  -- Sessions missing attendance in last 14 days
  (
    SELECT COUNT(DISTINCT sch.id)::int
    FROM schedules sch
    JOIN group_courses gc ON gc.id = sch.group_course_id
    JOIN groups g ON g.id = gc.group_id
    WHERE g.branch_id = b.id
      AND sch.status = 'completed'
      AND sch.scheduled_at >= NOW() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar WHERE ar.schedule_id = sch.id
      )
  ) AS sessions_missing_attendance,

  -- Total outstanding balance (EGP)
  COALESCE((
    SELECT SUM(sfa.remaining_amount)
    FROM student_financial_accounts sfa
    JOIN students s ON s.id = sfa.student_id
    WHERE s.branch_id = b.id AND s.deleted_at IS NULL
      AND sfa.remaining_amount > 0
  ), 0) AS total_outstanding_egp,

  -- Average attendance score across active students
  COALESCE((
    SELECT ROUND(AVG(scp.attendance_score))::int
    FROM student_course_progress scp
    JOIN students s ON s.id = scp.student_id
    WHERE s.branch_id = b.id AND s.deleted_at IS NULL AND scp.status = 'active'
  ), 0) AS avg_attendance_pct

FROM branches b
WHERE b.deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- v_financial_collection_health
-- Per-branch financial collection metrics for the finance dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_financial_collection_health AS
WITH account_stats AS (
  SELECT
    s.branch_id,
    COUNT(*)                                                          AS total_accounts,
    COUNT(*) FILTER (WHERE sfa.status = 'OVERDUE')                   AS overdue_count,
    COUNT(*) FILTER (WHERE sfa.status = 'DUE_SOON')                  AS due_soon_count,
    COUNT(*) FILTER (WHERE sfa.status = 'BLOCKED')                   AS blocked_count,
    COUNT(*) FILTER (WHERE sfa.status IN ('PAID', 'CURRENT'))        AS healthy_count,
    COALESCE(SUM(sfa.paid_amount),      0)                           AS total_collected,
    COALESCE(SUM(sfa.remaining_amount), 0)                           AS total_outstanding,
    COALESCE(SUM(sfa.paid_amount + sfa.remaining_amount), 0)         AS total_billed
  FROM student_financial_accounts sfa
  JOIN students s ON s.id = sfa.student_id
  WHERE s.deleted_at IS NULL
  GROUP BY s.branch_id
),
recent_payments AS (
  SELECT
    s.branch_id,
    COUNT(fp.id)             AS payments_this_month,
    COALESCE(SUM(fp.amount), 0) AS collected_this_month
  FROM finance_payments fp
  JOIN student_financial_accounts sfa ON sfa.id = fp.account_id
  JOIN students s ON s.id = sfa.student_id
  WHERE fp.payment_date >= DATE_TRUNC('month', NOW())
    AND s.deleted_at IS NULL
  GROUP BY s.branch_id
)
SELECT
  b.id                       AS branch_id,
  b.name                     AS branch_name,
  COALESCE(ast.total_accounts, 0)      AS total_accounts,
  COALESCE(ast.overdue_count, 0)       AS overdue_count,
  COALESCE(ast.due_soon_count, 0)      AS due_soon_count,
  COALESCE(ast.blocked_count, 0)       AS blocked_count,
  COALESCE(ast.healthy_count, 0)       AS healthy_count,
  COALESCE(ast.total_collected, 0)     AS total_collected,
  COALESCE(ast.total_outstanding, 0)   AS total_outstanding,
  COALESCE(ast.total_billed, 0)        AS total_billed,
  -- Collection rate % (paid / total_billed)
  CASE WHEN COALESCE(ast.total_billed, 0) > 0
    THEN ROUND(100.0 * ast.total_collected / ast.total_billed)::int
    ELSE 0
  END                                  AS collection_rate_pct,
  COALESCE(rp.payments_this_month, 0)  AS payments_this_month,
  COALESCE(rp.collected_this_month, 0) AS collected_this_month
FROM branches b
LEFT JOIN account_stats    ast ON ast.branch_id = b.id
LEFT JOIN recent_payments  rp  ON rp.branch_id  = b.id
WHERE b.deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes — Phase 15 additions
-- All use CREATE INDEX IF NOT EXISTS (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- group_instructors: group + role lookup (used in operational.ts listGroupsOperational)
CREATE INDEX IF NOT EXISTS idx_group_instructors_group_role
  ON group_instructors (group_id, role);

-- student_parent_contacts: student_id lookup (used in every guardian phone fetch)
CREATE INDEX IF NOT EXISTS idx_parent_contacts_student
  ON student_parent_contacts (student_id)
  WHERE phone1 IS NOT NULL;

-- student_course_progress: student + group + status (used in getGroupDetailDataAction)
CREATE INDEX IF NOT EXISTS idx_scp_student_group_status
  ON student_course_progress (student_id, group_id, status);

-- attendance_records: student + status (used in absence/attendance audits)
CREATE INDEX IF NOT EXISTS idx_attendance_student_status
  ON attendance_records (student_id, status);

-- finance_payments: account + date (used in monthly collections)
CREATE INDEX IF NOT EXISTS idx_finance_payments_account_month
  ON finance_payments (account_id, payment_date DESC);

-- student_financial_accounts: branch via students (cross-entity risk queries)
CREATE INDEX IF NOT EXISTS idx_sfa_student
  ON student_financial_accounts (student_id);

-- groups: branch + status + deleted (main list query in every TL view)
CREATE INDEX IF NOT EXISTS idx_groups_branch_status_deleted
  ON groups (branch_id, status, deleted_at)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
