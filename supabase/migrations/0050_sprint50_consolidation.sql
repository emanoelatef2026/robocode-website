-- Sprint 50: Operational Consolidation
-- Phases 1 (finance view), 11 (perf), 14 (RLS audit), 15 (integrity view)

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: v_finance_contract_summary
-- One row per enrollment contract. Finance page renders from this view directly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_finance_contract_summary AS
SELECT
  se.id                          AS enrollment_id,
  se.contract_code,
  se.student_id,
  se.branch_id,
  se.status                      AS enrollment_status,
  se.financial_status,
  se.enrolled_sessions           AS sessions_total,
  se.consumed_sessions           AS sessions_used,
  GREATEST(0, se.enrolled_sessions - se.consumed_sessions)
                                 AS sessions_remaining,
  se.start_date,
  se.end_date,
  se.enrollment_type,

  -- Student identity
  COALESCE(p.first_name || ' ' || p.last_name, u.email)
                                 AS student_name,
  s.student_code,
  u.phone                        AS student_phone,
  s.emergency_contact,

  -- Course / group / instructor (live first, snapshot fallback)
  COALESCE(c.title,  se.course_name_snapshot)     AS course_name,
  COALESCE(g.name,   se.group_name_snapshot)      AS group_name,
  COALESCE(ip.first_name || ' ' || ip.last_name,
           se.instructor_name_snapshot)            AS instructor_name,

  -- Branch
  b.name                         AS branch_name,

  -- Finance (from linked account, fallback to enrollment amounts)
  COALESCE(sfa.net_amount,      se.net_amount)    AS net_amount,
  COALESCE(sfa.paid_amount,     0)                AS paid_amount,
  COALESCE(sfa.remaining_amount,
           se.net_amount)                         AS remaining_amount,
  COALESCE(sfa.next_due_date,   NULL)             AS next_due_date,
  se.total_amount,
  se.discount_amount,
  sfa.id                         AS account_id,

  -- Days overdue
  CASE
    WHEN sfa.next_due_date IS NOT NULL AND sfa.next_due_date < CURRENT_DATE
      AND COALESCE(sfa.remaining_amount, 0) > 0
    THEN (CURRENT_DATE - sfa.next_due_date)
    ELSE 0
  END                            AS days_overdue,

  se.created_at,
  se.updated_at

FROM student_enrollments se
JOIN students      s  ON s.id  = se.student_id
JOIN users         u  ON u.id  = s.user_id
LEFT JOIN profiles p  ON p.user_id = u.id
LEFT JOIN branches b  ON b.id  = se.branch_id
LEFT JOIN groups   g  ON g.id  = se.group_id
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
LEFT JOIN group_courses gc ON gc.id = se.group_course_id
LEFT JOIN courses  c  ON c.id  = gc.course_id
LEFT JOIN instructors instr ON instr.id = se.instructor_id
LEFT JOIN users   iu  ON iu.id = instr.user_id
LEFT JOIN profiles ip ON ip.user_id = iu.id
WHERE s.deleted_at IS NULL;

-- Grant read access
GRANT SELECT ON v_finance_contract_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 15: v_integrity_audit
-- Data consistency checker. Run to detect orphans, mismatches, broken chains.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_integrity_audit AS

-- 1. Active enrollments with no financial account
SELECT
  'MISSING_ACCOUNT'       AS issue_type,
  'HIGH'                  AS severity,
  se.id                   AS entity_id,
  'student_enrollments'   AS entity_table,
  'Active enrollment has no linked financial account' AS description,
  se.student_id,
  se.branch_id
FROM student_enrollments se
WHERE se.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM student_financial_accounts sfa
    WHERE sfa.enrollment_id = se.id OR sfa.student_id = se.student_id
  )

UNION ALL

-- 2. Financial account where paid_amount > net_amount (overpayment)
SELECT
  'OVERPAYMENT',
  'MEDIUM',
  sfa.id,
  'student_financial_accounts',
  'Paid amount exceeds net amount: EGP ' || (sfa.paid_amount - sfa.net_amount)::text,
  sfa.student_id,
  sfa.branch_id
FROM student_financial_accounts sfa
WHERE sfa.paid_amount > sfa.net_amount + 1   -- 1 EGP tolerance

UNION ALL

-- 3. remaining_amount mismatch (net - paid ≠ remaining within 1 EGP)
SELECT
  'BALANCE_MISMATCH',
  'HIGH',
  sfa.id,
  'student_financial_accounts',
  'Balance mismatch: remaining=' || sfa.remaining_amount::text ||
    ' expected=' || (sfa.net_amount - sfa.paid_amount)::text,
  sfa.student_id,
  sfa.branch_id
FROM student_financial_accounts sfa
WHERE ABS(sfa.remaining_amount - (sfa.net_amount - sfa.paid_amount)) > 1

UNION ALL

-- 4. Active enrollments with no contract_code (missing integrity)
SELECT
  'MISSING_CONTRACT_CODE',
  'MEDIUM',
  se.id,
  'student_enrollments',
  'Active enrollment missing contract_code',
  se.student_id,
  se.branch_id
FROM student_enrollments se
WHERE se.status = 'ACTIVE'
  AND se.contract_code IS NULL

UNION ALL

-- 5. Duplicate active enrollments for same student + group
SELECT
  'DUPLICATE_ACTIVE_ENROLLMENT',
  'CRITICAL',
  se.id,
  'student_enrollments',
  'Duplicate ACTIVE enrollment for student in same group',
  se.student_id,
  se.branch_id
FROM student_enrollments se
WHERE se.status = 'ACTIVE'
  AND se.group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM student_enrollments se2
    WHERE se2.student_id = se.student_id
      AND se2.group_id   = se.group_id
      AND se2.status     = 'ACTIVE'
      AND se2.id        != se.id
  )

UNION ALL

-- 6. Payments with no linked account or enrollment
SELECT
  'ORPHAN_PAYMENT',
  'HIGH',
  fp.id,
  'finance_payments',
  'Payment has no account_id and no enrollment_id',
  fp.student_id,
  NULL
FROM finance_payments fp
WHERE fp.account_id IS NULL AND fp.enrollment_id IS NULL

UNION ALL

-- 7. Students with no parent linked (informational)
SELECT
  'NO_PARENT_LINKED',
  'LOW',
  s.id,
  'students',
  'Active student has no parent linked',
  s.id,
  s.branch_id
FROM students s
WHERE s.status = 'active'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM parent_students ps WHERE ps.student_id = s.id
  )

UNION ALL

-- 8. Finance installments sum mismatch vs account net_amount
SELECT
  'INSTALLMENT_SUM_MISMATCH',
  'MEDIUM',
  sfa.id,
  'student_financial_accounts',
  'Installment total ≠ net_amount: diff EGP ' ||
    ABS(sfa.net_amount - COALESCE(inst_sum.total, 0))::text,
  sfa.student_id,
  sfa.branch_id
FROM student_financial_accounts sfa
JOIN (
  SELECT account_id, SUM(amount) AS total
  FROM finance_installments
  GROUP BY account_id
) inst_sum ON inst_sum.account_id = sfa.id
WHERE ABS(sfa.net_amount - inst_sum.total) > 1;

GRANT SELECT ON v_integrity_audit TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 14: RLS Audit — confirm user_branch_assignments not referenced
-- (informational query — no policy changes needed, codebase is clean)
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify: list all RLS policies referencing user_roles (correct pattern)
-- SELECT tablename, policyname, qual FROM pg_policies WHERE qual ILIKE '%user_roles%';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: Additional performance indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Contract summary query paths
CREATE INDEX IF NOT EXISTS idx_enrollments_status_branch
  ON student_enrollments(status, branch_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_active
  ON student_enrollments(student_id, status)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_sfa_enrollment_id
  ON student_financial_accounts(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sfa_branch_status
  ON student_financial_accounts(branch_id, status);

-- Finance payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_student_date
  ON finance_payments(student_id, payment_date DESC);

-- Attendance monitor
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON attendance_records(student_id, recorded_at DESC);

-- Parent portal
CREATE INDEX IF NOT EXISTS idx_parent_students_student
  ON parent_students(student_id);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent
  ON parent_students(parent_id);

-- Timeline events
CREATE INDEX IF NOT EXISTS idx_timeline_branch
  ON student_timeline_events(branch_id, created_at DESC);

-- Group health queries
CREATE INDEX IF NOT EXISTS idx_group_students_group_status
  ON group_students(group_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: Course business metrics helper view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_course_metrics AS
SELECT
  c.id                           AS course_id,
  c.title,
  c.level,
  c.is_published,

  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')        AS active_enrollments,
  COUNT(DISTINCT se.id)                                             AS total_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED')     AS completed_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')       AS dropped_enrollments,

  -- Revenue
  COALESCE(SUM(sfa.paid_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                 AS total_revenue,
  COALESCE(SUM(sfa.remaining_amount) FILTER (WHERE se.status = 'ACTIVE'), 0)
                                 AS outstanding,

  -- Dropout rate
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')
               / COUNT(DISTINCT se.id))
    ELSE 0
  END                            AS dropout_pct,

  -- Retention (completed out of non-dropped)
  CASE WHEN COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED') > 0
    THEN ROUND(100.0 * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED')
               / COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED'))
    ELSE 0
  END                            AS retention_pct

FROM courses c
LEFT JOIN group_courses gc  ON gc.course_id = c.id
LEFT JOIN student_enrollments se ON se.group_course_id = gc.id
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.title, c.level, c.is_published;

GRANT SELECT ON v_course_metrics TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: Parent summary helper view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_parent_summary AS
SELECT
  par.id                         AS parent_id,
  u.id                           AS user_id,
  COALESCE(p.first_name || ' ' || p.last_name, u.email)
                                 AS parent_name,
  u.email,
  u.phone,

  COUNT(DISTINCT ps.student_id)  AS student_count,

  -- Finance aggregates across all linked students
  COALESCE(SUM(sfa.remaining_amount), 0) AS total_remaining,
  COALESCE(SUM(sfa.paid_amount), 0)      AS total_paid,

  -- Risk flag
  BOOL_OR(sfa.status = 'OVERDUE')        AS has_overdue,
  BOOL_OR(sfa.status = 'BLOCKED')        AS has_blocked,

  MAX(sfa.next_due_date)                 AS next_due_date

FROM parents par
JOIN users u   ON u.id  = par.user_id
LEFT JOIN profiles p ON p.user_id = u.id
LEFT JOIN parent_students ps ON ps.parent_id = par.id
LEFT JOIN student_financial_accounts sfa ON sfa.student_id = ps.student_id
GROUP BY par.id, u.id, p.first_name, p.last_name, u.email, u.phone;

GRANT SELECT ON v_parent_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: Group health summary view
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_group_health AS
SELECT
  g.id                           AS group_id,
  g.name,
  g.status,
  g.branch_id,
  g.capacity,

  COUNT(DISTINCT gs.student_id) FILTER (WHERE gs.status = 'active')
                                 AS active_students,
  g.capacity - COUNT(DISTINCT gs.student_id) FILTER (WHERE gs.status = 'active')
                                 AS seats_remaining,
  CASE WHEN COALESCE(g.capacity, 0) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT gs.student_id) FILTER (WHERE gs.status = 'active')
               / g.capacity)
    ELSE NULL
  END                            AS utilization_pct,

  -- Finance: active contracts in this group
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')
                                 AS active_contracts,
  COALESCE(SUM(sfa.remaining_amount) FILTER (WHERE se.status = 'ACTIVE'), 0)
                                 AS outstanding_amount

FROM groups g
LEFT JOIN group_students gs   ON gs.group_id = g.id
LEFT JOIN student_enrollments se ON se.group_id = g.id
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE g.deleted_at IS NULL
GROUP BY g.id, g.name, g.status, g.branch_id, g.capacity;

GRANT SELECT ON v_group_health TO authenticated;
