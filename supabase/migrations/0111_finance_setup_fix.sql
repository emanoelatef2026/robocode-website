-- 0111  FINANCE SETUP FIX
-- Applies what 0106-0110 could not: trigger function alias, staff_payroll_profiles,
-- finance_adjustments, instructors.payment_method.
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE everywhere).

-- ── 1. Trigger function alias ─────────────────────────────────────────────────
-- Earlier migrations reference update_updated_at_column() but the remote DB only
-- has set_updated_at(). Create the alias so all triggers work.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. staff_payroll_profiles (from migration 0109) ───────────────────────────
-- Must be created before finance_adjustments (FK dependency).

CREATE TABLE IF NOT EXISTS public.staff_payroll_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  branch_id           UUID        NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  role                TEXT        NOT NULL DEFAULT 'coordinator',
  payroll_type        TEXT        NOT NULL DEFAULT 'fixed_salary'
                      CHECK (payroll_type IN ('fixed_salary','per_session','mixed')),
  basic_salary        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  session_rate        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (session_rate >= 0),
  payment_method      TEXT        NOT NULL DEFAULT 'cash',
  payment_reference   TEXT,
  is_payroll_enabled  BOOLEAN     NOT NULL DEFAULT true,
  notes               TEXT,
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_branch
  ON public.staff_payroll_profiles(branch_id);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_user
  ON public.staff_payroll_profiles(user_id);

ALTER TABLE public.staff_payroll_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_payroll_profiles'
      AND policyname = 'staff_payroll_service_all'
  ) THEN
    CREATE POLICY "staff_payroll_service_all"
      ON public.staff_payroll_profiles FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_staff_payroll_profiles_updated_at ON public.staff_payroll_profiles;
CREATE TRIGGER trg_staff_payroll_profiles_updated_at
  BEFORE UPDATE ON public.staff_payroll_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. finance_adjustments ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.finance_adjustments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID        NOT NULL REFERENCES public.branches(id)              ON DELETE RESTRICT,
  instructor_id    UUID        REFERENCES public.instructors(id)                    ON DELETE CASCADE,
  staff_profile_id UUID        REFERENCES public.staff_payroll_profiles(id)         ON DELETE CASCADE,
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

DROP TRIGGER IF EXISTS trg_finance_adjustments_updated_at ON public.finance_adjustments;
CREATE TRIGGER trg_finance_adjustments_updated_at
  BEFORE UPDATE ON public.finance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_adjustments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_adjustments'
      AND policyname = 'finance_adjustments_service_all'
  ) THEN
    CREATE POLICY "finance_adjustments_service_all"
      ON public.finance_adjustments FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 4. instructors.payment_method ─────────────────────────────────────────────

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('instapay','vodafone_cash','bank_transfer','cash'));

-- ── 5. Fix payroll_runs / payroll_items triggers (from failed 0106) ───────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_runs' AND schemaname = 'public') THEN
    DROP TRIGGER IF EXISTS trg_payroll_runs_updated_at ON public.payroll_runs;
    CREATE TRIGGER trg_payroll_runs_updated_at
      BEFORE UPDATE ON public.payroll_runs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payroll_items' AND schemaname = 'public') THEN
    DROP TRIGGER IF EXISTS trg_payroll_items_updated_at ON public.payroll_items;
    CREATE TRIGGER trg_payroll_items_updated_at
      BEFORE UPDATE ON public.payroll_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ── 6. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
