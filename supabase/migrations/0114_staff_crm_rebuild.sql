-- 0114_staff_crm_rebuild.sql
-- Phase XXIII — Staff CRM + Payroll Architecture Rebuild
--
-- Changes:
--   1. Add employment_status to staff_payroll_profiles  (replaces is_payroll_enabled as UI control)
--   2. Add works_all_branches to staff_payroll_profiles
--   3. Widen payment_method CHECK to include wallet, cheque, other
--   4. Create staff_payment_records  (tracks actual payments made to staff per month)
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── 1. employment_status ──────────────────────────────────────────────────────
ALTER TABLE staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_payroll_profiles_employment_status_check'
      AND conrelid = 'staff_payroll_profiles'::regclass
  ) THEN
    ALTER TABLE staff_payroll_profiles
      ADD CONSTRAINT staff_payroll_profiles_employment_status_check
      CHECK (employment_status IN ('active', 'on_leave', 'inactive'));
  END IF;
END $$;

-- Backfill: is_payroll_enabled=false → inactive (only where still at default 'active')
UPDATE staff_payroll_profiles
  SET employment_status = 'inactive'
  WHERE is_payroll_enabled = false
    AND employment_status  = 'active';

-- ─── 2. works_all_branches ─────────────────────────────────────────────────────
ALTER TABLE staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS works_all_branches BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. Widen payment_method CHECK ────────────────────────────────────────────
-- Drop old strict check (instapay|vodafone_cash|bank_transfer|cash only)
ALTER TABLE staff_payroll_profiles
  DROP CONSTRAINT IF EXISTS staff_payroll_profiles_payment_method_check;

ALTER TABLE staff_payroll_profiles
  ADD CONSTRAINT staff_payroll_profiles_payment_method_check
  CHECK (payment_method IN (
    'instapay', 'vodafone_cash', 'bank_transfer', 'cash',
    'wallet', 'cheque', 'other'
  ));

-- ─── 4. staff_payment_records ──────────────────────────────────────────────────
-- Tracks actual cash/transfer payments made to a staff member for a given month.
-- Multiple payments per month are allowed (partial payments).

CREATE TABLE IF NOT EXISTS staff_payment_records (
  id               UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id UUID           NOT NULL REFERENCES staff_payroll_profiles(id) ON DELETE CASCADE,
  branch_id        UUID           NOT NULL REFERENCES branches(id),
  month            SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             SMALLINT       NOT NULL CHECK (year >= 2020),
  amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date     DATE           NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT,
  notes            TEXT,
  created_by       UUID           REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_payment_records_profile
  ON staff_payment_records (staff_profile_id);

CREATE INDEX IF NOT EXISTS idx_staff_payment_records_month_year
  ON staff_payment_records (year, month);

CREATE INDEX IF NOT EXISTS idx_staff_payment_records_branch
  ON staff_payment_records (branch_id);

-- ─── 5. Indexes on new columns ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_profiles_employment_status
  ON staff_payroll_profiles (employment_status);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_works_all_branches
  ON staff_payroll_profiles (works_all_branches)
  WHERE works_all_branches = true;

-- ─── 6. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE staff_payment_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_payment_records'
      AND policyname = 'service_role_all_staff_payment_records'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all_staff_payment_records"
        ON staff_payment_records
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ─── 7. Schema cache refresh ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
