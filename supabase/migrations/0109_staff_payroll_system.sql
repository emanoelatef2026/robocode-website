-- ─────────────────────────────────────────────────────────────────────────────
-- 0109  STAFF PAYROLL SYSTEM — PHASE 20
-- ─────────────────────────────────────────────────────────────────────────────
-- Redesigns the payroll system from instructor-only to unified staff payroll.
--
-- SAFETY GUARANTEE:
--   - No existing table is dropped.
--   - No existing column is removed.
--   - All existing payroll_runs / payroll_items / payroll_adjustments data is
--     preserved. Old rows with instructor_id set are untouched.
--
-- Changes:
--   1. CREATE staff_payroll_profiles — canonical payroll config for all staff
--   2. Backfill instructors → staff_payroll_profiles
--   3. ALTER payroll_items — instructor_id nullable, add staff columns
--   4. ALTER payroll_adjustments — instructor_id nullable, add staff columns,
--      extend adjustment types
--   5. ALTER payroll_runs — add 'finalized' status
--   6. Indexes + RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. staff_payroll_profiles ─────────────────────────────────────────────────
-- Stores payroll configuration for any user (instructor, TL, coordinator, etc.).
-- One row per user per branch (same model as instructor_branches).

CREATE TABLE IF NOT EXISTS public.staff_payroll_profiles (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id          UUID        NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  role               TEXT        NOT NULL DEFAULT 'instructor',
  payroll_type       TEXT        NOT NULL DEFAULT 'per_session'
                     CHECK (payroll_type IN ('per_session', 'fixed_salary', 'mixed')),
  basic_salary       NUMERIC(12,2) NOT NULL DEFAULT 0,
  session_rate       NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method     TEXT        NOT NULL DEFAULT 'cash'
                     CHECK (payment_method IN ('instapay', 'vodafone_cash', 'bank_transfer', 'cash')),
  payment_reference  TEXT,
  is_payroll_enabled BOOLEAN     NOT NULL DEFAULT true,
  notes              TEXT,
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

COMMENT ON TABLE public.staff_payroll_profiles IS
  'Unified payroll configuration for all staff (instructors, TLs, coordinators, etc.). '
  'One row per user per branch. payroll_type determines calculation method.';

-- ── 2. Backfill instructors → staff_payroll_profiles ─────────────────────────
-- For each instructor in each branch, create a staff_payroll_profile.
-- Maps existing payroll_type values: per_session → per_session,
--   fixed_monthly → fixed_salary, hybrid → mixed.
-- Uses instapay_number as payment_reference if present.

INSERT INTO public.staff_payroll_profiles (
  user_id,
  branch_id,
  role,
  payroll_type,
  basic_salary,
  session_rate,
  payment_method,
  payment_reference,
  is_payroll_enabled,
  notes,
  created_at
)
SELECT
  i.user_id,
  ib.branch_id,
  'instructor'::TEXT,
  CASE i.payroll_type
    WHEN 'per_session'   THEN 'per_session'
    WHEN 'fixed_monthly' THEN 'fixed_salary'
    WHEN 'hybrid'        THEN 'mixed'
    ELSE                      'per_session'
  END,
  0::NUMERIC,                                           -- basic_salary default
  COALESCE(i.salary_per_session, 0),
  CASE
    WHEN i.instapay_number IS NOT NULL AND i.instapay_number <> '' THEN 'instapay'
    ELSE 'cash'
  END,
  NULLIF(i.instapay_number, ''),
  TRUE,
  i.payment_notes,
  i.created_at
FROM public.instructors       i
JOIN public.instructor_branches ib ON ib.instructor_id = i.id
WHERE i.deleted_at IS NULL
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- ── 3. Extend payroll_items ───────────────────────────────────────────────────
-- Make instructor_id nullable so non-instructor staff can have items.
-- Add staff_profile_id, basic_salary snapshot, and payroll_type snapshot.

ALTER TABLE public.payroll_items
  ALTER COLUMN instructor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID
    REFERENCES public.staff_payroll_profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS basic_salary  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payroll_type  TEXT          NOT NULL DEFAULT 'per_session'
    CHECK (payroll_type IN ('per_session', 'fixed_salary', 'mixed'));

-- Add partial unique index for staff_profile_id (the existing UNIQUE constraint
-- on instructor_id still guards instructor items; NULLs are excluded from unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_items_run_staff_profile
  ON public.payroll_items(payroll_run_id, staff_profile_id)
  WHERE staff_profile_id IS NOT NULL;

COMMENT ON COLUMN public.payroll_items.staff_profile_id IS
  'Set for non-instructor staff items. Null for legacy instructor items (see instructor_id).';
COMMENT ON COLUMN public.payroll_items.basic_salary IS
  'Snapshot of basic_salary at time of generation (for fixed_salary and mixed types).';
COMMENT ON COLUMN public.payroll_items.payroll_type IS
  'Snapshot of the payroll_type used during generation. Determines how gross_amount was computed.';

-- ── 4. Extend payroll_adjustments ────────────────────────────────────────────
-- Make instructor_id nullable, add staff_profile_id, extend allowed types.

ALTER TABLE public.payroll_adjustments
  ALTER COLUMN instructor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID
    REFERENCES public.staff_payroll_profiles(id) ON DELETE RESTRICT;

-- Extend type check constraint to include new adjustment types.
-- Must drop and recreate since PostgreSQL does not support ALTER CONSTRAINT.
DO $$
BEGIN
  ALTER TABLE public.payroll_adjustments
    DROP CONSTRAINT IF EXISTS payroll_adjustments_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_type_check
  CHECK (type IN (
    'bonus', 'penalty', 'transport', 'allowance', 'deduction', 'other',
    'advance', 'purchase', 'equipment', 'reimbursement'
  ));

COMMENT ON COLUMN public.payroll_adjustments.staff_profile_id IS
  'Set for non-instructor staff adjustments. Null for legacy instructor adjustments.';

-- ── 5. Extend payroll_runs status ─────────────────────────────────────────────
-- Add 'finalized' status — permanently locked by super admin after payment.
-- Status flow: draft → approved → paid → finalized (or archived to void).

DO $$
BEGIN
  ALTER TABLE public.payroll_runs
    DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check
  CHECK (status IN ('draft', 'approved', 'paid', 'archived', 'finalized'));

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_payroll_profiles_user_id
  ON public.staff_payroll_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_profiles_branch_id
  ON public.staff_payroll_profiles(branch_id);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_profiles_role
  ON public.staff_payroll_profiles(role);

CREATE INDEX IF NOT EXISTS idx_payroll_items_staff_profile
  ON public.payroll_items(staff_profile_id)
  WHERE staff_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_staff_profile
  ON public.payroll_adjustments(staff_profile_id)
  WHERE staff_profile_id IS NOT NULL;

-- ── 7. updated_at trigger for staff_payroll_profiles ──────────────────────────

CREATE TRIGGER trg_staff_payroll_profiles_updated_at
  BEFORE UPDATE ON public.staff_payroll_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 8. RLS — service role bypass ──────────────────────────────────────────────

ALTER TABLE public.staff_payroll_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_payroll_profiles_service_all"
  ON public.staff_payroll_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 9. Seed finalize_payroll permission ───────────────────────────────────────

INSERT INTO public.permissions (name, description)
VALUES (
  'finalize_payroll',
  'Finalize and permanently lock paid payroll runs. Super admin only.'
)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Grant only to super_admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'super_admin' AND p.name = 'finalize_payroll'
ON CONFLICT DO NOTHING;
