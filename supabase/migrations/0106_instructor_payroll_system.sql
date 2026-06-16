-- ─────────────────────────────────────────────────────────────────────────────
-- 0106  INSTRUCTOR PAYROLL SYSTEM — PHASE 19
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the complete instructor payroll infrastructure:
--   1. Normalize instructor finance fields (payroll_type, payroll_effective_from)
--   2. payroll_runs        — one per branch/month/year, tracks status lifecycle
--   3. payroll_items       — one per instructor per run, holds gross + final amounts
--   4. payroll_adjustments — bonuses, penalties, deductions attached to items
--   5. payroll_session_snapshots — immutable evidence: sessions counted for each item
--
-- Canonical source of truth: completed sessions within instructor allocation ranges.
-- Cancelled / postponed / future sessions are never counted.
-- Snapshots are immutable after generation — attendance changes require explicit
-- "Regenerate" with a new run (the old run is archived, not mutated).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Normalize instructor finance fields ────────────────────────────────────
-- salary_per_session (NUMERIC 10,2) and currency (TEXT) already exist from 0062.
-- Add payroll_type for future expansion (fixed_monthly, hybrid), and
-- payroll_effective_from to record when a rate became active.

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS payroll_type           TEXT NOT NULL DEFAULT 'per_session'
    CHECK (payroll_type IN ('per_session', 'fixed_monthly', 'hybrid')),
  ADD COLUMN IF NOT EXISTS payroll_effective_from DATE;

COMMENT ON COLUMN public.instructors.payroll_type           IS
  'Compensation model. per_session = salary_per_session × completed sessions. '
  'fixed_monthly and hybrid reserved for future expansion.';
COMMENT ON COLUMN public.instructors.payroll_effective_from IS
  'When the current rate configuration became active. NULL = from hire date.';

-- ── 2. payroll_runs ───────────────────────────────────────────────────────────
-- One row per branch + calendar month. Represents a monthly payroll generation
-- event. Lifecycle: draft → approved → paid (or archived to void the run).

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID     NOT NULL REFERENCES public.branches(id)   ON DELETE RESTRICT,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year >= 2020),
  status        TEXT     NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'approved', 'paid', 'archived')),
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by  UUID     REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID     REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at       TIMESTAMPTZ,
  paid_by       UUID     REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, month, year)
);

COMMENT ON TABLE public.payroll_runs IS
  'Monthly payroll generation event per branch. One run per branch/month/year.';

-- ── 3. payroll_items ─────────────────────────────────────────────────────────
-- One row per instructor per payroll run. Holds the computed salary.

CREATE TABLE IF NOT EXISTS public.payroll_items (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id    UUID     NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  instructor_id     UUID     NOT NULL REFERENCES public.instructors(id) ON DELETE RESTRICT,
  sessions_count    INT      NOT NULL DEFAULT 0,
  rate_per_session  NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          TEXT     NOT NULL DEFAULT 'EGP',
  status            TEXT     NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'paid')),
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, instructor_id)
);

COMMENT ON TABLE public.payroll_items IS
  'One salary record per instructor per payroll_run. '
  'final_amount = gross_amount + adjustments_total (adjustments can be negative).';

-- ── 4. payroll_adjustments ────────────────────────────────────────────────────
-- Manual additions or deductions attached to a payroll_item.
-- positive amount = add to salary (bonus, allowance, transport)
-- negative amount = subtract from salary (penalty, deduction)

CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
  instructor_id   UUID NOT NULL REFERENCES public.instructors(id)    ON DELETE RESTRICT,
  type            TEXT NOT NULL
                  CHECK (type IN ('bonus', 'penalty', 'transport', 'allowance', 'deduction', 'other')),
  amount          NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll_adjustments IS
  'Bonuses, penalties, and other manual adjustments to a payroll_item. '
  'Positive amount adds to final_amount; negative subtracts.';

-- ── 5. payroll_session_snapshots ──────────────────────────────────────────────
-- Immutable evidence of exactly which sessions contributed to each payroll_item.
-- Never mutated after creation — attendance changes require a new payroll run.
-- schedule_id links back to the live schedule for display, but payment is based
-- on the snapshot values, not the live schedule.

CREATE TABLE IF NOT EXISTS public.payroll_session_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id UUID NOT NULL REFERENCES public.payroll_items(id)  ON DELETE CASCADE,
  schedule_id     UUID NOT NULL REFERENCES public.schedules(id)       ON DELETE RESTRICT,
  session_number  INT  NOT NULL,
  group_id        UUID NOT NULL REFERENCES public.groups(id)          ON DELETE RESTRICT,
  group_name      TEXT NOT NULL DEFAULT '',
  topic           TEXT,
  session_date    DATE NOT NULL,
  session_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll_session_snapshots IS
  'Point-in-time record of each session counted toward a payroll_item. '
  'Immutable after creation — the payroll evidence of what was taught and paid for.';

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payroll_runs_branch_year_month
  ON public.payroll_runs(branch_id, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_status
  ON public.payroll_runs(status) WHERE status != 'archived';

CREATE INDEX IF NOT EXISTS idx_payroll_items_run
  ON public.payroll_items(payroll_run_id);

CREATE INDEX IF NOT EXISTS idx_payroll_items_instructor
  ON public.payroll_items(instructor_id);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_item
  ON public.payroll_adjustments(payroll_item_id);

CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_item
  ON public.payroll_session_snapshots(payroll_item_id);

CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_schedule
  ON public.payroll_session_snapshots(schedule_id);

-- ── 7. updated_at triggers ────────────────────────────────────────────────────
-- Reuses the existing update_updated_at_column() function (defined in 0005).

CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payroll_items_updated_at
  BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payroll_adjustments_updated_at
  BEFORE UPDATE ON public.payroll_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. RLS — service role bypass (app uses service client for all writes) ─────

ALTER TABLE public.payroll_runs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_session_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_service_all"
  ON public.payroll_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "payroll_items_service_all"
  ON public.payroll_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "payroll_adjustments_service_all"
  ON public.payroll_adjustments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "payroll_snapshots_service_all"
  ON public.payroll_session_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);
