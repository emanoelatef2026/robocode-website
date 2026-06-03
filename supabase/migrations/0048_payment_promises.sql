-- =============================================================================
-- SPRINT 37.5 — Payment Promises & Collections Workflow Extensions
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times.
-- =============================================================================

-- ─── 1. PAYMENT PROMISES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_promises (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID        NOT NULL REFERENCES public.students(id)              ON DELETE CASCADE,
  account_id       UUID                    REFERENCES public.student_financial_accounts(id) ON DELETE SET NULL,

  promised_amount  NUMERIC(10,2) NOT NULL CHECK (promised_amount > 0),
  promised_date    DATE        NOT NULL,

  notes            TEXT,

  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    status IN ('ACTIVE','FULFILLED','BROKEN')
  ),

  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_promises IS
  'Parent payment promises. Status auto-transitions to BROKEN when promised_date passes without payment.';

-- ─── 2. TRIGGER: updated_at ────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pp_updated_at') THEN
    CREATE TRIGGER trg_pp_updated_at
      BEFORE UPDATE ON public.payment_promises
      FOR EACH ROW EXECUTE FUNCTION public.set_finance_accounts_updated_at();
  END IF;
END $$;

-- ─── 3. TRIGGER: auto-fulfill promise when payment covers the amount ───────────

CREATE OR REPLACE FUNCTION public.auto_fulfill_promises()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When a payment is made, try to fulfill matching ACTIVE promises
  UPDATE public.payment_promises
  SET status = 'FULFILLED', updated_at = now()
  WHERE account_id = NEW.account_id
    AND status     = 'ACTIVE'
    AND promised_amount <= (
      SELECT COALESCE(SUM(fp.amount), 0)
      FROM public.finance_payments fp
      WHERE fp.account_id = NEW.account_id
        AND fp.payment_date >= public.payment_promises.promised_date - INTERVAL '3 days'
    );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_fulfill_promises') THEN
    CREATE TRIGGER trg_auto_fulfill_promises
      AFTER INSERT ON public.finance_payments
      FOR EACH ROW EXECUTE FUNCTION public.auto_fulfill_promises();
  END IF;
END $$;

-- ─── 4. FUNCTION: mark broken promises ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_broken_promises()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.payment_promises
  SET status = 'BROKEN', updated_at = now()
  WHERE status      = 'ACTIVE'
    AND promised_date < CURRENT_DATE;
END;
$$;

-- ─── 5. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pp_student_id   ON public.payment_promises (student_id);
CREATE INDEX IF NOT EXISTS idx_pp_account_id   ON public.payment_promises (account_id);
CREATE INDEX IF NOT EXISTS idx_pp_status       ON public.payment_promises (status);
CREATE INDEX IF NOT EXISTS idx_pp_promise_date ON public.payment_promises (promised_date);
CREATE INDEX IF NOT EXISTS idx_pp_created_by   ON public.payment_promises (created_by);

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_promises' AND policyname='pp_staff_all') THEN
  CREATE POLICY "pp_staff_all" ON public.payment_promises FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.student_id = student_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.student_id = student_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ));
END IF; END $$;

GRANT SELECT, INSERT, UPDATE ON public.payment_promises TO authenticated;

-- ─── 7. SEED PERMISSIONS ──────────────────────────────────────────────────────

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('super_admin','team_leader')
  AND p.name = 'manage_financials'
ON CONFLICT DO NOTHING;

-- ─── 8. VALIDATION ────────────────────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payment_promises'
ORDER BY ordinal_position;
