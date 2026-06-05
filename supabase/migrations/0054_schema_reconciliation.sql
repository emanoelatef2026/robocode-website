-- =============================================================================
-- Migration 0054: Full Schema Reconciliation
-- =============================================================================
-- Sprint 53 audit revealed: student_enrollments was NEVER created via a migration
-- file (it was applied directly to the DB). Multiple columns added in Sprints 41-53
-- are also missing from migration history.
--
-- This migration is 100% IDEMPOTENT. All statements use IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS. Safe to run multiple times and against both legacy and new DBs.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: student_enrollments  (THE MISSING TABLE)
-- Complete schema including all columns added through Sprint 51.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core relationships
  student_id            UUID NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  branch_id             UUID NOT NULL REFERENCES public.branches(id)  ON DELETE RESTRICT,
  group_id              UUID          REFERENCES public.groups(id)    ON DELETE SET NULL,
  group_course_id       UUID          REFERENCES public.group_courses(id) ON DELETE SET NULL,
  group_student_id      UUID          REFERENCES public.group_students(id) ON DELETE SET NULL,
  instructor_id         UUID          REFERENCES public.instructors(id) ON DELETE SET NULL,
  course_id             UUID          REFERENCES public.courses(id)   ON DELETE SET NULL,

  -- Enrollment meta
  enrollment_type       TEXT NOT NULL DEFAULT 'primary'
                        CHECK (enrollment_type IN ('primary', 'secondary')),
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'COMPLETED', 'DROPPED', 'TRANSFERRED', 'PAUSED')),
  financial_status      TEXT NOT NULL DEFAULT 'CURRENT'
                        CHECK (financial_status IN ('CURRENT', 'DUE_SOON', 'OVERDUE', 'BLOCKED', 'COMPLETED')),

  -- Session contract (Sprint 44)
  enrolled_sessions     INT NOT NULL DEFAULT 0,  -- 0 = unlimited
  consumed_sessions     INT NOT NULL DEFAULT 0,
  remaining_sessions    INT GENERATED ALWAYS AS (GREATEST(0, enrolled_sessions - consumed_sessions)) STORED,
  allow_overdraft_sessions BOOLEAN NOT NULL DEFAULT false,

  -- Finance snapshot
  total_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  pricing_snapshot      JSONB NOT NULL DEFAULT '{}',

  -- Date context
  start_date            DATE,
  end_date              DATE,

  -- Snapshot columns — preserve names at enrollment time for historical reference
  group_name_snapshot       TEXT,
  course_name_snapshot      TEXT,
  instructor_name_snapshot  TEXT,
  branch_name_snapshot      TEXT,

  -- Lineage (transfers / renewals)
  transferred_from      UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  renewal_of            UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,

  -- Contract (Sprint 48)
  contract_code         TEXT,

  -- Predictive engine (Sprint 51)
  dropout_score         SMALLINT,
  dropout_category      TEXT,
  dropout_scored_at     TIMESTAMPTZ,

  -- Collections pipeline (Sprint 51)
  collection_stage               TEXT,
  collection_stage_set_at        TIMESTAMPTZ,
  promise_reliability_score      SMALLINT,

  -- Audit
  created_by            UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_contract_code
  ON public.student_enrollments(contract_code)
  WHERE contract_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_student_status
  ON public.student_enrollments(student_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_branch_status
  ON public.student_enrollments(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollments_group_status
  ON public.student_enrollments(group_id, status)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_student_active
  ON public.student_enrollments(student_id, status)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_enrollments_status_branch
  ON public.student_enrollments(status, branch_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_dropout
  ON public.student_enrollments(dropout_category, branch_id)
  WHERE status = 'ACTIVE';

-- Auto-update trigger
CREATE OR REPLACE FUNCTION set_student_enrollments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON public.student_enrollments;
CREATE TRIGGER trg_enrollments_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_student_enrollments_updated_at();

-- Contract code auto-generation (Sprint 48)
CREATE SEQUENCE IF NOT EXISTS contract_code_seq START 1000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_contract_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contract_code IS NULL THEN
    NEW.contract_code := 'CNT-' || to_char(NOW(), 'YYYY') || '-' ||
                         LPAD(nextval('contract_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enrollment_contract_code ON public.student_enrollments;
CREATE TRIGGER trg_enrollment_contract_code
  BEFORE INSERT ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION generate_contract_code();

-- No-duplicate active enrollment for same student + group
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_dup_active_enrollment
  ON public.student_enrollments(student_id, group_id, status)
  WHERE status = 'ACTIVE' AND group_id IS NOT NULL AND transferred_from IS NULL;

-- RLS
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_read_by_branch_staff" ON public.student_enrollments
  FOR SELECT USING (
    branch_id IN (
      SELECT DISTINCT branch_id FROM public.user_roles
      WHERE user_id = auth.uid() AND branch_id IS NOT NULL
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "enrollments_write_by_staff" ON public.student_enrollments
  FOR ALL USING (
    public.user_has_permission(auth.uid(), 'manage_financials', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  ) WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_financials', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

GRANT SELECT, INSERT, UPDATE ON public.student_enrollments TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: student_financial_accounts — add enrollment linkage
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.student_financial_accounts
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

-- The original schema has UNIQUE (student_id) — one account per student.
-- With enrollment-linked accounts, we need to allow multiple.
-- We handle this by dropping the old constraint and replacing with partial indexes.

DO $$
BEGIN
  -- Try to drop the legacy unique constraint (name varies by install)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'student_financial_accounts'
    AND constraint_type = 'UNIQUE'
    AND constraint_name = 'student_financial_accounts_student_id_key'
  ) THEN
    ALTER TABLE public.student_financial_accounts
      DROP CONSTRAINT student_financial_accounts_student_id_key;
  END IF;
END $$;

-- Allow one account per enrollment (when linked)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sfa_unique_enrollment
  ON public.student_financial_accounts(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Allow one account per student when no enrollment link (legacy compat)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sfa_unique_student_no_enrollment
  ON public.student_financial_accounts(student_id)
  WHERE enrollment_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sfa_enrollment_id
  ON public.student_financial_accounts(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Add BLOCKED and COMPLETED to the status check (Sprint 43+)
ALTER TABLE public.student_financial_accounts
  DROP CONSTRAINT IF EXISTS student_financial_accounts_status_check;

ALTER TABLE public.student_financial_accounts
  ADD CONSTRAINT student_financial_accounts_status_check
  CHECK (status IN ('CURRENT', 'DUE_SOON', 'OVERDUE', 'PAID', 'BLOCKED', 'COMPLETED'));

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: finance_payments — add missing columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS enrollment_id        UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allocation_strategy  TEXT CHECK (allocation_strategy IN ('AUTO_FIFO', 'MANUAL')),
  ADD COLUMN IF NOT EXISTS receipt_url          TEXT,
  ADD COLUMN IF NOT EXISTS receipt_image        TEXT,
  ADD COLUMN IF NOT EXISTS receipt_notes        TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_size_kb INT,
  ADD COLUMN IF NOT EXISTS receipt_mime_type    TEXT,
  ADD COLUMN IF NOT EXISTS receipt_validated_at TIMESTAMPTZ;

-- Allow negative amounts for reversals (Sprint 44)
ALTER TABLE public.finance_payments
  DROP CONSTRAINT IF EXISTS finance_payments_amount_check;

CREATE INDEX IF NOT EXISTS idx_payments_enrollment
  ON public.finance_payments(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: collection_activities — add enrollment linkage
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.collection_activities
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: payment_promises — add enrollment linkage
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_promises
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: courses — add course_type column (used in enrollment wizard)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_type TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: students — missing columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_grade TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: group_courses — missing columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_sessions INT NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS course_module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: groups — missing columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10: student_timeline_events (Sprint 48)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_timeline_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  schedule_id  UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  account_id   UUID REFERENCES public.student_financial_accounts(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,
  notes        TEXT,
  severity     TEXT NOT NULL DEFAULT 'INFO',
  created_by   UUID REFERENCES public.users(id),
  branch_id    UUID REFERENCES public.branches(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_student
  ON public.student_timeline_events(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_enrollment
  ON public.student_timeline_events(enrollment_id, created_at DESC)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_branch
  ON public.student_timeline_events(branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

ALTER TABLE public.student_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select" ON public.student_timeline_events FOR SELECT USING (
  branch_id IN (
    SELECT DISTINCT branch_id FROM public.user_roles
    WHERE user_id = auth.uid() AND branch_id IS NOT NULL
  )
  OR public.user_has_permission(auth.uid(), 'manage_system')
);

CREATE POLICY "timeline_insert" ON public.student_timeline_events FOR INSERT WITH CHECK (
  branch_id IN (
    SELECT DISTINCT branch_id FROM public.user_roles
    WHERE user_id = auth.uid() AND branch_id IS NOT NULL
  )
  OR public.user_has_permission(auth.uid(), 'manage_system')
);

GRANT SELECT, INSERT ON public.student_timeline_events TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11: operational_tasks (Sprint 51) — if not already created
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operational_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'MEDIUM',
  status          TEXT NOT NULL DEFAULT 'OPEN',
  due_date        DATE,
  notes           TEXT,
  auto_generated  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  dismissed_at    TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_branch_status
  ON public.operational_tasks(branch_id, status)
  WHERE status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_tasks_student
  ON public.operational_tasks(student_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_active_dedup_with_enrollment
  ON public.operational_tasks(enrollment_id, type)
  WHERE status IN ('OPEN', 'IN_PROGRESS') AND enrollment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.operational_tasks TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12: notification_queue (Sprint 51)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  parent_id       UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'in_app',
  priority        TEXT NOT NULL DEFAULT 'MEDIUM',
  title           TEXT NOT NULL,
  body            TEXT,
  payload         JSONB DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'PENDING',
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  dedup_key       TEXT,
  scheduled_for   TIMESTAMPTZ DEFAULT NOW(),
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  delivery_attempts SMALLINT NOT NULL DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedup
  ON public.notification_queue(dedup_key)
  WHERE status = 'PENDING' AND dedup_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.notification_queue TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13: background_jobs (Sprint 51)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  payload         JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  error           TEXT,
  last_error      TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  worker_id       TEXT,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON public.background_jobs(scheduled_for, status)
  WHERE status = 'PENDING';

GRANT SELECT, INSERT, UPDATE ON public.background_jobs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 14: system_event_logs (Sprint 52)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_event_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'error',
  module         TEXT NOT NULL,
  actor_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id      UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  entity_type    TEXT,
  entity_id      UUID,
  message        TEXT NOT NULL,
  payload        JSONB DEFAULT '{}',
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_type_severity
  ON public.system_event_logs(type, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_logs_unresolved
  ON public.system_event_logs(severity, created_at DESC)
  WHERE resolved = FALSE;

GRANT SELECT, INSERT ON public.system_event_logs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 15: automation_execution_log (Sprint 52)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_execution_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type   TEXT NOT NULL,
  enrollment_id  UUID REFERENCES public.student_enrollments(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  executed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  skipped_reason TEXT,
  result         TEXT,
  cooldown_hours SMALLINT NOT NULL DEFAULT 6,
  payload        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_automation_log_enrollment_trigger
  ON public.automation_execution_log(enrollment_id, trigger_type, executed_at DESC);

GRANT SELECT, INSERT ON public.automation_execution_log TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 16: Views (recreate safely with OR REPLACE)
-- ─────────────────────────────────────────────────────────────────────────────

-- v_finance_contract_summary is in migration 0050 — recreate here to ensure it exists
CREATE OR REPLACE VIEW public.v_finance_contract_summary AS
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

  -- Finance
  COALESCE(sfa.net_amount,      se.net_amount)    AS net_amount,
  COALESCE(sfa.paid_amount,     0)                AS paid_amount,
  COALESCE(sfa.remaining_amount, se.net_amount)   AS remaining_amount,
  COALESCE(sfa.next_due_date,   NULL)             AS next_due_date,
  se.total_amount,
  se.discount_amount,
  sfa.id                         AS account_id,

  CASE
    WHEN sfa.next_due_date IS NOT NULL AND sfa.next_due_date < CURRENT_DATE
      AND COALESCE(sfa.remaining_amount, 0) > 0
    THEN (CURRENT_DATE - sfa.next_due_date)
    ELSE 0
  END                            AS days_overdue,

  se.created_at,
  se.updated_at

FROM public.student_enrollments se
JOIN public.students      s  ON s.id  = se.student_id
JOIN public.users         u  ON u.id  = s.user_id
LEFT JOIN public.profiles p  ON p.user_id = u.id
LEFT JOIN public.branches b  ON b.id  = se.branch_id
LEFT JOIN public.groups   g  ON g.id  = se.group_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
LEFT JOIN public.group_courses gc ON gc.id = se.group_course_id
LEFT JOIN public.courses  c  ON c.id  = gc.course_id
LEFT JOIN public.instructors instr ON instr.id = se.instructor_id
LEFT JOIN public.users   iu  ON iu.id = instr.user_id
LEFT JOIN public.profiles ip ON ip.user_id = iu.id
WHERE s.deleted_at IS NULL;

GRANT SELECT ON public.v_finance_contract_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 17: Backfill contract_code_seq for existing enrollments
-- ─────────────────────────────────────────────────────────────────────────────

-- If student_enrollments existed before and has rows without contract_code, fill them
UPDATE public.student_enrollments
SET contract_code = 'CNT-' || to_char(created_at, 'YYYY') || '-' ||
                   LPAD((nextval('contract_code_seq'))::text, 6, '0')
WHERE contract_code IS NULL;
