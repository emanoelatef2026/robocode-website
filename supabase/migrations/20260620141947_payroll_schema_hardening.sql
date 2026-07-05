-- 0116_payroll_schema_hardening.sql
-- Phase XXV — Payroll Production Readiness
--
-- Ensures all Phase 21–24 payroll columns exist on staff_payroll_profiles.
-- Idempotent (uses ADD COLUMN IF NOT EXISTS). Safe to apply even if migrations
-- 0113 and 0114 were fully applied — each statement is a no-op in that case.
--
-- Root cause addressed: getLiveStaffFinance was silently returning [] when
-- any selected column was missing from the DB schema cache.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── 1. Columns from migration 0113 ───────────────────────────────────────────
ALTER TABLE public.staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

-- ─── 2. Columns from migration 0114 ───────────────────────────────────────────
ALTER TABLE public.staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS works_all_branches BOOLEAN NOT NULL DEFAULT false;

-- employment_status constraint (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_payroll_profiles_employment_status_check'
      AND conrelid = 'staff_payroll_profiles'::regclass
  ) THEN
    ALTER TABLE public.staff_payroll_profiles
      ADD CONSTRAINT staff_payroll_profiles_employment_status_check
      CHECK (employment_status IN ('active', 'on_leave', 'inactive'));
  END IF;
END $$;

-- payment_method constraint — widen to include wallet, cheque, other
ALTER TABLE public.staff_payroll_profiles
  DROP CONSTRAINT IF EXISTS staff_payroll_profiles_payment_method_check;

ALTER TABLE public.staff_payroll_profiles
  ADD CONSTRAINT staff_payroll_profiles_payment_method_check
  CHECK (payment_method IN (
    'instapay', 'vodafone_cash', 'bank_transfer', 'cash',
    'wallet', 'cheque', 'other'
  ));

-- ─── 3. staff_payment_records table (from migration 0114) ─────────────────────
CREATE TABLE IF NOT EXISTS public.staff_payment_records (
  id               UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id UUID           NOT NULL REFERENCES public.staff_payroll_profiles(id) ON DELETE CASCADE,
  branch_id        UUID           NOT NULL REFERENCES public.branches(id),
  month            SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             SMALLINT       NOT NULL CHECK (year >= 2020),
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date     DATE           NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT,
  notes            TEXT,
  created_by       UUID           REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Indexes for staff_payment_records
CREATE INDEX IF NOT EXISTS idx_staff_payment_records_profile
  ON public.staff_payment_records (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_payment_records_month_year
  ON public.staff_payment_records (year, month);
CREATE INDEX IF NOT EXISTS idx_staff_payment_records_branch
  ON public.staff_payment_records (branch_id);

-- RLS
ALTER TABLE public.staff_payment_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_payment_records'
      AND policyname = 'service_role_all_staff_payment_records'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all_staff_payment_records"
        ON public.staff_payment_records
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ─── 4. Indexes on new columns ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_profiles_employment_status
  ON public.staff_payroll_profiles (employment_status);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_works_all_branches
  ON public.staff_payroll_profiles (works_all_branches)
  WHERE works_all_branches = true;

-- ─── 5. Backfill: is_payroll_enabled → employment_status ──────────────────────
UPDATE public.staff_payroll_profiles
  SET employment_status = 'inactive'
  WHERE is_payroll_enabled = false
    AND employment_status  = 'active';

-- ─── 6. Schema cache refresh ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
