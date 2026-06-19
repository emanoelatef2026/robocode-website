-- ─────────────────────────────────────────────────────────────────────────────
-- 0110  LIVE FINANCE SYSTEM — PHASE 21
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds infrastructure for the live (non-ERP) finance management system.
-- All existing payroll_* tables are preserved and untouched.
--
-- Changes:
--   1. finance_adjustments — standalone adjustment records (not tied to runs)
--   2. instructors.payment_method — store preferred payment method
--   3. Indexes + RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. finance_adjustments ────────────────────────────────────────────────────
-- Standalone finance adjustments for instructors or staff.
-- NOT linked to payroll_runs or payroll_items — always live.
-- Exactly one of instructor_id or staff_profile_id must be set (CHECK constraint).

CREATE TABLE IF NOT EXISTS public.finance_adjustments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID        NOT NULL REFERENCES public.branches(id)   ON DELETE RESTRICT,
  instructor_id    UUID        REFERENCES public.instructors(id)          ON DELETE CASCADE,
  staff_profile_id UUID        REFERENCES public.staff_payroll_profiles(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL
                   CHECK (type IN ('bonus','penalty','advance','purchase','reimbursement','other')),
  amount           NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  adjustment_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT finance_adj_single_target CHECK (
    (instructor_id IS NOT NULL AND staff_profile_id IS NULL)
    OR
    (instructor_id IS NULL AND staff_profile_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.finance_adjustments IS
  'Standalone finance adjustments (bonus, penalty, advance, etc.) for instructors or staff. '
  'Not linked to payroll runs — always calculated live by date range.';

COMMENT ON COLUMN public.finance_adjustments.amount IS
  'Always stored as a positive value. Sign is inferred from type: '
  'bonus/reimbursement = +, penalty/advance/purchase = -.';

-- ── 2. Add payment_method to instructors ──────────────────────────────────────
-- Instructors already have instapay_number and payment_notes (from 0062).
-- Add a structured payment_method field.

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('instapay', 'vodafone_cash', 'bank_transfer', 'cash'));

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_finance_adj_instructor_id
  ON public.finance_adjustments(instructor_id)
  WHERE instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_adj_staff_profile_id
  ON public.finance_adjustments(staff_profile_id)
  WHERE staff_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_adj_branch_date
  ON public.finance_adjustments(branch_id, adjustment_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_adj_date
  ON public.finance_adjustments(adjustment_date DESC);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────

CREATE TRIGGER trg_finance_adjustments_updated_at
  BEFORE UPDATE ON public.finance_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. RLS — service role bypass ──────────────────────────────────────────────

ALTER TABLE public.finance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_adjustments_service_all"
  ON public.finance_adjustments FOR ALL TO service_role
  USING (true) WITH CHECK (true);
