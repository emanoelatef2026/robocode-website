-- Sprint 51: Automation + Realtime Operations Layer
-- Phases 3, 4, 7, 8, 9, 11, 12, 15 — DB foundation
-- ZERO destructive migrations. All additive.

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: operational_tasks
-- Task-driven work queues replacing manual dashboard scanning.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operational_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES student_enrollments(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES parents(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,           -- COLLECTION|RENEWAL|ATTENDANCE|RETENTION|PARENT_REPLY|INSTRUCTOR_REVIEW|COMPLAINT|FOLLOW_UP
  severity        TEXT NOT NULL DEFAULT 'MEDIUM', -- LOW|MEDIUM|HIGH|CRITICAL
  status          TEXT NOT NULL DEFAULT 'OPEN',   -- OPEN|IN_PROGRESS|COMPLETED|DISMISSED
  due_date        DATE,
  notes           TEXT,
  auto_generated  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  dismissed_at    TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_branch_status
  ON operational_tasks(branch_id, status)
  WHERE status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_tasks_student
  ON operational_tasks(student_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_due
  ON operational_tasks(due_date)
  WHERE status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_tasks_enrollment
  ON operational_tasks(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_operational_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON operational_tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON operational_tasks
  FOR EACH ROW EXECUTE FUNCTION update_operational_tasks_updated_at();

-- Grant access
GRANT SELECT, INSERT, UPDATE ON operational_tasks TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: notification_queue
-- Centralized notification buffer with dedup and cooldown support.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES student_enrollments(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES parents(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,           -- OVERDUE_PAYMENT|UPCOMING_DUE|PACKAGE_EXHAUSTION|ATTENDANCE_RISK|RENEWAL_RECOMMENDATION|UNRESOLVED_COMPLAINT|INSTRUCTOR_ASSIGNMENT|NEW_HOMEWORK
  channel         TEXT NOT NULL DEFAULT 'in_app', -- in_app|whatsapp|email|push
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',  -- LOW|MEDIUM|HIGH|CRITICAL
  title           TEXT NOT NULL,
  body            TEXT,
  payload         JSONB DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|SENT|FAILED|SUPPRESSED
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  dedup_key       TEXT,               -- student_id:type:channel — prevents spam
  scheduled_for   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup
  ON notification_queue(dedup_key)
  WHERE status = 'PENDING' AND dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_pending
  ON notification_queue(scheduled_for, status)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_notif_student
  ON notification_queue(student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON notification_queue TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 8: background_jobs
-- Scheduled job system with retry and visibility.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,           -- RECOMPUTE_SUMMARIES|DETECT_STALE_BALANCES|REFRESH_VIEWS|PROCESS_AUTOMATION|SEND_NOTIFICATIONS|RECOMPUTE_SCORES|ARCHIVE_EVENTS|REPAIR_INTEGRITY
  status          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|RUNNING|COMPLETED|FAILED|SKIPPED
  payload         JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  error           TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON background_jobs(scheduled_for, status)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_jobs_type_status
  ON background_jobs(type, status);

GRANT SELECT, INSERT, UPDATE ON background_jobs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: dropout_risk on student_enrollments
-- Persisted predictive score (computed by background job).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE student_enrollments
  ADD COLUMN IF NOT EXISTS dropout_score     SMALLINT,    -- 0-100
  ADD COLUMN IF NOT EXISTS dropout_category  TEXT,        -- SAFE|WATCH|HIGH_RISK|CRITICAL
  ADD COLUMN IF NOT EXISTS dropout_scored_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 7: collection_stage on student_enrollments
-- Tracks automated collections pipeline stage.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE student_enrollments
  ADD COLUMN IF NOT EXISTS collection_stage TEXT,    -- FRIENDLY_REMINDER|DUE_NOTICE|OVERDUE_WARNING|CRITICAL_COLLECTION|FINAL_ESCALATION
  ADD COLUMN IF NOT EXISTS collection_stage_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promise_reliability_score SMALLINT; -- 0-100

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 9: Timeline event types — informational comment
-- (Types are stored as TEXT so no migration needed)
-- New types used in Sprint 51:
--   HOMEWORK_ASSIGNED, HOMEWORK_COMPLETED, CERTIFICATE_ISSUED,
--   CALL_LOGGED, WHATSAPP_SENT, RENEWAL_CREATED,
--   TRANSFER_REQUESTED, PARENT_ESCALATION, TASK_CREATED, TASK_COMPLETED,
--   SCORE_COMPUTED, COLLECTION_STAGE_ADVANCED
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure severity column exists (added in 0050 but may be missing in some envs)
ALTER TABLE student_timeline_events
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: v_instructor_operations
-- Per-instructor operational KPIs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_instructor_operations AS
SELECT
  instr.id                        AS instructor_id,
  iu.id                           AS user_id,
  COALESCE(ip.first_name || ' ' || ip.last_name, iu.email)
                                  AS instructor_name,
  instr.branch_id,
  b.name                          AS branch_name,

  -- Active students (via group_courses or direct enrollment)
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.status = 'ACTIVE')
                                  AS active_students,

  -- Revenue managed
  COALESCE(SUM(sfa.net_amount) FILTER (WHERE se.status = 'ACTIVE'), 0)
                                  AS revenue_managed,
  COALESCE(SUM(sfa.remaining_amount) FILTER (WHERE se.status = 'ACTIVE'), 0)
                                  AS outstanding_amount,

  -- Retention (completed out of all non-dropped)
  CASE WHEN COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED') > 0
    THEN ROUND(100.0 *
      COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED') /
      NULLIF(COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED'), 0))
    ELSE NULL
  END                             AS retention_pct,

  -- Risk students (dropout_category = HIGH_RISK or CRITICAL)
  COUNT(DISTINCT se.student_id) FILTER (
    WHERE se.status = 'ACTIVE'
    AND se.dropout_category IN ('HIGH_RISK', 'CRITICAL')
  )                               AS risk_students,

  -- Inactive students (dropout_category = CRITICAL, no attendance recently)
  COUNT(DISTINCT se.student_id) FILTER (
    WHERE se.status = 'ACTIVE'
    AND se.dropout_category = 'CRITICAL'
  )                               AS critical_students

FROM instructors instr
JOIN users iu     ON iu.id   = instr.user_id
LEFT JOIN profiles ip ON ip.user_id = iu.id
LEFT JOIN branches b  ON b.id = instr.branch_id
LEFT JOIN student_enrollments se ON (
  se.instructor_id = instr.id
  OR se.group_course_id IN (
    SELECT id FROM group_courses WHERE instructor_id = instr.id
  )
)
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE instr.deleted_at IS NULL
GROUP BY instr.id, iu.id, ip.first_name, ip.last_name, iu.email, instr.branch_id, b.name;

GRANT SELECT ON v_instructor_operations TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 12: v_branch_performance
-- Per-branch operational health score.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_branch_performance AS
SELECT
  b.id                            AS branch_id,
  b.name                          AS branch_name,
  b.is_active,

  -- Students
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active' AND s.deleted_at IS NULL)
                                  AS active_students,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')
                                  AS active_contracts,

  -- Finance
  COALESCE(SUM(sfa.net_amount)        FILTER (WHERE se.status = 'ACTIVE'), 0)
                                  AS revenue_contracted,
  COALESCE(SUM(sfa.paid_amount)       FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                  AS revenue_collected,
  COALESCE(SUM(sfa.remaining_amount)  FILTER (WHERE se.status = 'ACTIVE'), 0)
                                  AS outstanding,
  COUNT(DISTINCT sfa.id) FILTER (WHERE sfa.status = 'OVERDUE')
                                  AS overdue_count,

  -- Collection rate
  CASE WHEN COALESCE(SUM(sfa.net_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0) > 0
    THEN ROUND(100.0 *
      COALESCE(SUM(sfa.paid_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0) /
      NULLIF(SUM(sfa.net_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0))
    ELSE 0
  END                             AS collection_rate_pct,

  -- Retention
  CASE WHEN COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED') > 0
    THEN ROUND(100.0 *
      COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED') /
      NULLIF(COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED'), 0))
    ELSE NULL
  END                             AS retention_pct,

  -- Dropout / risk
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.dropout_category IN ('HIGH_RISK','CRITICAL'))
                                  AS risk_students,

  -- Renewal pipeline
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE' AND se.remaining_sessions <= 2 AND se.enrolled_sessions > 0)
                                  AS renewal_urgent,

  -- Instructor count
  COUNT(DISTINCT gc.instructor_id) FILTER (WHERE gc.instructor_id IS NOT NULL)
                                  AS active_instructors

FROM branches b
LEFT JOIN students s         ON s.branch_id  = b.id
LEFT JOIN student_enrollments se ON se.branch_id = b.id
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
LEFT JOIN groups g           ON g.branch_id  = b.id AND g.deleted_at IS NULL
LEFT JOIN group_courses gc   ON gc.group_id  = g.id AND gc.status = 'active'
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.is_active;

GRANT SELECT ON v_branch_performance TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11: v_retention_analytics
-- Course-level retention and dropout stage analysis.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_retention_analytics AS
SELECT
  c.id                            AS course_id,
  c.title,
  c.level,

  -- Enrollment funnel
  COUNT(DISTINCT se.id)                                              AS total_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'ACTIVE')         AS active_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED')      AS completed_enrollments,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')        AS dropped_enrollments,

  -- Renewal rate (active + completed out of active only who have renewal)
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.status = 'ACTIVE' AND se.remaining_sessions <= 5 AND se.enrolled_sessions > 0)
                                  AS renewal_candidates,

  -- Revenue
  COALESCE(SUM(sfa.net_amount)    FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                  AS total_contracted,
  COALESCE(SUM(sfa.paid_amount)   FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0)
                                  AS total_collected,

  -- Dropout rate
  CASE WHEN COUNT(DISTINCT se.id) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'DROPPED')
               / COUNT(DISTINCT se.id))
    ELSE 0
  END                             AS dropout_pct,

  -- Retention rate
  CASE WHEN COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED') > 0
    THEN ROUND(100.0 * COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'COMPLETED')
               / NULLIF(COUNT(DISTINCT se.id) FILTER (WHERE se.status != 'DROPPED'), 0))
    ELSE NULL
  END                             AS retention_pct,

  -- Risk concentration
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.dropout_category IN ('HIGH_RISK','CRITICAL'))
                                  AS risk_students,

  -- Average contract sessions
  ROUND(AVG(se.enrolled_sessions) FILTER (WHERE se.enrolled_sessions > 0))
                                  AS avg_sessions_per_contract,

  -- Profitability: collected / students
  CASE WHEN COUNT(DISTINCT se.student_id) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')) > 0
    THEN ROUND(COALESCE(SUM(sfa.paid_amount) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')), 0) /
               COUNT(DISTINCT se.student_id) FILTER (WHERE se.status IN ('ACTIVE','COMPLETED')))
    ELSE 0
  END                             AS revenue_per_student

FROM courses c
LEFT JOIN group_courses gc   ON gc.course_id   = c.id
LEFT JOIN student_enrollments se ON (
  se.group_course_id = gc.id
  OR se.course_id = c.id   -- direct enrollment (Sprint 48)
)
LEFT JOIN student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.title, c.level;

GRANT SELECT ON v_retention_analytics TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 15: v_executive_overview
-- Academy-wide command center. One row per branch.
-- Extends v_branch_performance with task and notification counts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_executive_overview AS
SELECT
  bp.*,
  -- Open tasks
  COALESCE(t.open_tasks, 0)       AS open_tasks,
  COALESCE(t.critical_tasks, 0)   AS critical_tasks,
  -- Overdue students
  bp.overdue_count                AS overdue_students,
  -- Operational health score (0-100)
  GREATEST(0,
    100
    - LEAST(30, COALESCE(t.critical_tasks, 0) * 5)
    - CASE WHEN COALESCE(bp.collection_rate_pct, 100) < 70 THEN 20
           WHEN COALESCE(bp.collection_rate_pct, 100) < 80 THEN 10
           ELSE 0 END
    - CASE WHEN COALESCE(bp.overdue_count, 0) > 10 THEN 15
           WHEN COALESCE(bp.overdue_count, 0) > 5  THEN 8
           ELSE 0 END
    - LEAST(20, COALESCE(bp.risk_students, 0) * 2)
  )                               AS operational_health_score

FROM v_branch_performance bp
LEFT JOIN (
  SELECT
    branch_id,
    COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS'))              AS open_tasks,
    COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS') AND severity = 'CRITICAL') AS critical_tasks
  FROM operational_tasks
  GROUP BY branch_id
) t ON t.branch_id = bp.branch_id;

GRANT SELECT ON v_executive_overview TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 14: v_integrity_extended
-- Extends v_integrity_audit with Sprint 51 checks.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_integrity_extended AS

-- All existing Sprint 50 checks
SELECT * FROM v_integrity_audit

UNION ALL

-- 9. Active enrollments with no dropout score computed in 7+ days
SELECT
  'STALE_DROPOUT_SCORE',
  'LOW',
  se.id,
  'student_enrollments',
  'Dropout score not computed in 7+ days',
  se.student_id,
  se.branch_id
FROM student_enrollments se
WHERE se.status = 'ACTIVE'
  AND (
    se.dropout_scored_at IS NULL
    OR se.dropout_scored_at < NOW() - INTERVAL '7 days'
  )

UNION ALL

-- 10. Open tasks overdue
SELECT
  'OVERDUE_TASK',
  'MEDIUM',
  t.id,
  'operational_tasks',
  'Task is past due_date and still open: ' || t.type,
  t.student_id,
  t.branch_id
FROM operational_tasks t
WHERE t.status IN ('OPEN', 'IN_PROGRESS')
  AND t.due_date IS NOT NULL
  AND t.due_date < CURRENT_DATE;

GRANT SELECT ON v_integrity_extended TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Additional indexes for Sprint 51 query paths
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollments_dropout
  ON student_enrollments(dropout_category, branch_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_enrollments_collection_stage
  ON student_enrollments(collection_stage, branch_id)
  WHERE status = 'ACTIVE' AND collection_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_renewal_urgent
  ON student_enrollments(remaining_sessions, branch_id)
  WHERE status = 'ACTIVE' AND enrolled_sessions > 0;

CREATE INDEX IF NOT EXISTS idx_timeline_student_type
  ON student_timeline_events(student_id, event_type, created_at DESC);
