-- =============================================================================
-- SPRINT 37 — Finance & Collections Operating System
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times.
-- Purpose: Academy finance, collections, installment tracking, parent follow-up.
-- This is NOT an accounting system — it is an operational collections system.
-- =============================================================================

-- ─── 1. STUDENT FINANCIAL ACCOUNTS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_financial_accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  branch_id         UUID        NOT NULL REFERENCES public.branches(id)  ON DELETE RESTRICT,
  group_id          UUID                    REFERENCES public.groups(id)  ON DELETE SET NULL,

  total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,   -- total - discount

  paid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,   -- auto-computed
  remaining_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,   -- auto-computed

  status            TEXT NOT NULL DEFAULT 'CURRENT' CHECK (
    status IN ('CURRENT','DUE_SOON','OVERDUE','PAID')
  ),

  next_due_date     DATE,
  notes             TEXT,

  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id)  -- one operational account per student
);

COMMENT ON TABLE public.student_financial_accounts IS
  'Operational finance account per student. '
  'paid_amount and remaining_amount are auto-computed by trigger.';

-- ─── 2. FINANCE PAYMENTS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.finance_payments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID        NOT NULL REFERENCES public.students(id)              ON DELETE CASCADE,
  account_id        UUID        NOT NULL REFERENCES public.student_financial_accounts(id) ON DELETE CASCADE,
  installment_id    UUID                    REFERENCES public.finance_installments(id)    ON DELETE SET NULL,

  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE        NOT NULL DEFAULT CURRENT_DATE,

  payment_method    TEXT NOT NULL DEFAULT 'cash' CHECK (
    payment_method IN ('cash','instapay','vodafone_cash','bank_transfer','card')
  ),

  reference_number  TEXT,
  notes             TEXT,

  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finance_payments IS
  'Payment records for the collections system. '
  'Inserting/deleting rows triggers auto-sync of account paid_amount.';

-- ─── 3. FINANCE INSTALLMENTS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.finance_installments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID        NOT NULL REFERENCES public.student_financial_accounts(id) ON DELETE CASCADE,

  installment_number  INTEGER     NOT NULL,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  due_date            DATE        NOT NULL,

  paid_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING','PARTIAL','PAID','OVERDUE')
  ),

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (account_id, installment_number)
);

COMMENT ON TABLE public.finance_installments IS
  'Individual installment schedule entries for a financial account.';

-- Now add FK from finance_payments to finance_installments (forward reference)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'finance_payments'
      AND constraint_name = 'finance_payments_installment_id_fkey'
  ) THEN
    ALTER TABLE public.finance_payments
      ADD CONSTRAINT finance_payments_installment_id_fkey
      FOREIGN KEY (installment_id) REFERENCES public.finance_installments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 4. FINANCE NOTES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.finance_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  account_id  UUID                    REFERENCES public.student_financial_accounts(id) ON DELETE SET NULL,

  note_text   TEXT        NOT NULL CHECK (char_length(note_text) >= 2),
  is_internal BOOLEAN     NOT NULL DEFAULT false,  -- internal notes hidden from parents

  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finance_notes IS
  'Finance notes on students (parent payment promises, discount notes, etc.).';

-- ─── 5. COLLECTION ACTIVITIES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collection_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  account_id    UUID                    REFERENCES public.student_financial_accounts(id) ON DELETE SET NULL,

  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('CALL','WHATSAPP','PORTAL_MESSAGE','FOLLOW_UP','PAYMENT_REMINDER')
  ),

  notes         TEXT,

  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collection_activities IS
  'Collection outreach activity log (calls, WhatsApp, reminders, follow-ups).';

-- ─── 6. PAYROLL FOUNDATION (HIDDEN — NO UI) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instructor_compensation (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id   UUID        NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id),

  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,

  base_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT        NOT NULL DEFAULT 'EGP',

  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING','APPROVED','PAID')
  ),

  notes           TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.instructor_compensation IS
  'Instructor payroll foundation — Phase 14 (no UI yet).';

CREATE TABLE IF NOT EXISTS public.session_payments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  instructor_id       UUID        NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  compensation_id     UUID                    REFERENCES public.instructor_compensation(id) ON DELETE SET NULL,

  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'EGP',

  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING','PAID')
  ),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.session_payments IS
  'Per-session payment tracking for instructor payroll — Phase 14 (no UI yet).';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_finance_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sfa_updated_at') THEN
    CREATE TRIGGER trg_sfa_updated_at
      BEFORE UPDATE ON public.student_financial_accounts
      FOR EACH ROW EXECUTE FUNCTION public.set_finance_accounts_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fi_updated_at') THEN
    CREATE TRIGGER trg_fi_updated_at
      BEFORE UPDATE ON public.finance_installments
      FOR EACH ROW EXECUTE FUNCTION public.set_finance_accounts_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ic_updated_at') THEN
    CREATE TRIGGER trg_ic_updated_at
      BEFORE UPDATE ON public.instructor_compensation
      FOR EACH ROW EXECUTE FUNCTION public.set_finance_accounts_updated_at();
  END IF;
END $$;

-- ─── Auto-sync account totals when payment is inserted/updated/deleted ─────────

CREATE OR REPLACE FUNCTION public.sync_finance_account_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_account_id UUID;
  v_paid       NUMERIC(10,2);
  v_net        NUMERIC(10,2);
  v_remaining  NUMERIC(10,2);
  v_next_due   DATE;
  v_new_status TEXT;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);

  -- Recompute paid_amount
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.finance_payments
  WHERE account_id = v_account_id;

  -- Get net_amount and next_due_date
  SELECT net_amount, next_due_date INTO v_net, v_next_due
  FROM public.student_financial_accounts
  WHERE id = v_account_id;

  v_remaining := v_net - v_paid;

  -- Determine status
  IF v_remaining <= 0 THEN
    v_new_status := 'PAID';
  ELSIF v_next_due IS NOT NULL AND v_next_due < CURRENT_DATE THEN
    v_new_status := 'OVERDUE';
  ELSIF v_next_due IS NOT NULL AND v_next_due <= CURRENT_DATE + INTERVAL '7 days' THEN
    v_new_status := 'DUE_SOON';
  ELSE
    v_new_status := 'CURRENT';
  END IF;

  UPDATE public.student_financial_accounts
  SET
    paid_amount      = v_paid,
    remaining_amount = GREATEST(0, v_remaining),
    status           = v_new_status,
    updated_at       = now()
  WHERE id = v_account_id;

  -- Sync linked installment if payment is linked
  IF TG_OP = 'DELETE' THEN
    IF OLD.installment_id IS NOT NULL THEN
      PERFORM public.sync_installment_paid_amount(OLD.installment_id);
    END IF;
  ELSE
    IF NEW.installment_id IS NOT NULL THEN
      PERFORM public.sync_installment_paid_amount(NEW.installment_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper to sync installment paid_amount and status
CREATE OR REPLACE FUNCTION public.sync_installment_paid_amount(p_inst_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_paid   NUMERIC(10,2);
  v_amount NUMERIC(10,2);
  v_due    DATE;
  v_status TEXT;
BEGIN
  SELECT COALESCE(SUM(fp.amount), 0), fi.amount, fi.due_date
  INTO v_paid, v_amount, v_due
  FROM public.finance_installments fi
  LEFT JOIN public.finance_payments fp ON fp.installment_id = fi.id
  WHERE fi.id = p_inst_id
  GROUP BY fi.amount, fi.due_date;

  IF v_paid >= v_amount THEN
    v_status := 'PAID';
  ELSIF v_paid > 0 THEN
    v_status := 'PARTIAL';
  ELSIF v_due < CURRENT_DATE THEN
    v_status := 'OVERDUE';
  ELSE
    v_status := 'PENDING';
  END IF;

  UPDATE public.finance_installments
  SET paid_amount = v_paid, status = v_status, updated_at = now()
  WHERE id = p_inst_id;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_account_on_payment_insert') THEN
    CREATE TRIGGER trg_sync_account_on_payment_insert
      AFTER INSERT ON public.finance_payments
      FOR EACH ROW EXECUTE FUNCTION public.sync_finance_account_totals();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_account_on_payment_update') THEN
    CREATE TRIGGER trg_sync_account_on_payment_update
      AFTER UPDATE ON public.finance_payments
      FOR EACH ROW EXECUTE FUNCTION public.sync_finance_account_totals();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_account_on_payment_delete') THEN
    CREATE TRIGGER trg_sync_account_on_payment_delete
      AFTER DELETE ON public.finance_payments
      FOR EACH ROW EXECUTE FUNCTION public.sync_finance_account_totals();
  END IF;
END $$;

-- ─── Auto-compute net_amount and remaining_amount on account insert/update ─────

CREATE OR REPLACE FUNCTION public.compute_finance_account_net()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.net_amount       := NEW.total_amount - NEW.discount_amount;
  NEW.remaining_amount := GREATEST(0, NEW.net_amount - NEW.paid_amount);

  IF NEW.remaining_amount <= 0 THEN
    NEW.status := 'PAID';
  ELSIF NEW.next_due_date IS NOT NULL AND NEW.next_due_date < CURRENT_DATE THEN
    NEW.status := 'OVERDUE';
  ELSIF NEW.next_due_date IS NOT NULL AND NEW.next_due_date <= CURRENT_DATE + INTERVAL '7 days' THEN
    NEW.status := 'DUE_SOON';
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_compute_sfa_net') THEN
    CREATE TRIGGER trg_compute_sfa_net
      BEFORE INSERT OR UPDATE OF total_amount, discount_amount, next_due_date
      ON public.student_financial_accounts
      FOR EACH ROW EXECUTE FUNCTION public.compute_finance_account_net();
  END IF;
END $$;

-- ─── Auto-update overdue installments ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_overdue_installments()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.finance_installments
  SET status = 'OVERDUE', updated_at = now()
  WHERE status IN ('PENDING','PARTIAL')
    AND due_date < CURRENT_DATE;

  UPDATE public.student_financial_accounts
  SET status = 'OVERDUE', updated_at = now()
  WHERE status IN ('CURRENT','DUE_SOON')
    AND next_due_date < CURRENT_DATE
    AND remaining_amount > 0;
END;
$$;
-- Called by pg_cron daily or on page load for near-real-time accuracy.

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sfa_student_id    ON public.student_financial_accounts (student_id);
CREATE INDEX IF NOT EXISTS idx_sfa_branch_id     ON public.student_financial_accounts (branch_id);
CREATE INDEX IF NOT EXISTS idx_sfa_group_id      ON public.student_financial_accounts (group_id);
CREATE INDEX IF NOT EXISTS idx_sfa_status        ON public.student_financial_accounts (status);
CREATE INDEX IF NOT EXISTS idx_sfa_next_due      ON public.student_financial_accounts (next_due_date);

CREATE INDEX IF NOT EXISTS idx_fp_account_id     ON public.finance_payments (account_id);
CREATE INDEX IF NOT EXISTS idx_fp_student_id     ON public.finance_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_fp_payment_date   ON public.finance_payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_fp_installment_id ON public.finance_payments (installment_id);

CREATE INDEX IF NOT EXISTS idx_fi_account_id     ON public.finance_installments (account_id);
CREATE INDEX IF NOT EXISTS idx_fi_due_date       ON public.finance_installments (due_date);
CREATE INDEX IF NOT EXISTS idx_fi_status         ON public.finance_installments (status);

CREATE INDEX IF NOT EXISTS idx_fn_student_id     ON public.finance_notes (student_id);
CREATE INDEX IF NOT EXISTS idx_fn_account_id     ON public.finance_notes (account_id);
CREATE INDEX IF NOT EXISTS idx_fn_created        ON public.finance_notes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ca_student_id     ON public.collection_activities (student_id);
CREATE INDEX IF NOT EXISTS idx_ca_account_id     ON public.collection_activities (account_id);
CREATE INDEX IF NOT EXISTS idx_ca_created        ON public.collection_activities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ca_type           ON public.collection_activities (activity_type);

CREATE INDEX IF NOT EXISTS idx_ic_instructor_id  ON public.instructor_compensation (instructor_id);
CREATE INDEX IF NOT EXISTS idx_ic_branch_id      ON public.instructor_compensation (branch_id);
CREATE INDEX IF NOT EXISTS idx_sp_session_id     ON public.session_payments (session_id);
CREATE INDEX IF NOT EXISTS idx_sp_instructor_id  ON public.session_payments (instructor_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.student_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_installments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_activities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_compensation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_payments           ENABLE ROW LEVEL SECURITY;

-- ─── student_financial_accounts ───────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_financial_accounts' AND policyname='sfa_super_admin') THEN
  CREATE POLICY "sfa_super_admin" ON public.student_financial_accounts FOR ALL
    USING (public.user_has_permission(auth.uid(), 'manage_financials', branch_id))
    WITH CHECK (public.user_has_permission(auth.uid(), 'manage_financials', branch_id));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_financial_accounts' AND policyname='sfa_team_leader_read') THEN
  CREATE POLICY "sfa_team_leader_read" ON public.student_financial_accounts FOR SELECT
    USING (public.user_has_permission(auth.uid(), 'read_financials', branch_id));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_financial_accounts' AND policyname='sfa_parent_read') THEN
  CREATE POLICY "sfa_parent_read" ON public.student_financial_accounts FOR SELECT
    USING (
      student_id IN (
        SELECT ps.student_id FROM public.parent_students ps
        JOIN public.parents p ON p.id = ps.parent_id
        WHERE p.user_id = auth.uid() AND ps.can_view_financials = true
      )
    );
END IF; END $$;

-- ─── finance_payments ─────────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_payments' AND policyname='fp_manage') THEN
  CREATE POLICY "fp_manage" ON public.finance_payments FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.id = account_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.id = account_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_payments' AND policyname='fp_parent_read') THEN
  CREATE POLICY "fp_parent_read" ON public.finance_payments FOR SELECT
    USING (
      student_id IN (
        SELECT ps.student_id FROM public.parent_students ps
        JOIN public.parents p ON p.id = ps.parent_id
        WHERE p.user_id = auth.uid() AND ps.can_view_financials = true
      )
    );
END IF; END $$;

-- ─── finance_installments ─────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_installments' AND policyname='fi_manage') THEN
  CREATE POLICY "fi_manage" ON public.finance_installments FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.id = account_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.id = account_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', sfa.branch_id)
    ));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_installments' AND policyname='fi_parent_read') THEN
  CREATE POLICY "fi_parent_read" ON public.finance_installments FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.student_financial_accounts sfa
      WHERE sfa.id = account_id
        AND sfa.student_id IN (
          SELECT ps.student_id FROM public.parent_students ps
          JOIN public.parents p ON p.id = ps.parent_id
          WHERE p.user_id = auth.uid() AND ps.can_view_financials = true
        )
    ));
END IF; END $$;

-- ─── finance_notes ────────────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_notes' AND policyname='fn_staff_all') THEN
  CREATE POLICY "fn_staff_all" ON public.finance_notes FOR ALL
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

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance_notes' AND policyname='fn_parent_read_public') THEN
  CREATE POLICY "fn_parent_read_public" ON public.finance_notes FOR SELECT
    USING (
      is_internal = false
      AND student_id IN (
        SELECT ps.student_id FROM public.parent_students ps
        JOIN public.parents p ON p.id = ps.parent_id
        WHERE p.user_id = auth.uid() AND ps.can_view_financials = true
      )
    );
END IF; END $$;

-- ─── collection_activities ────────────────────────────────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='collection_activities' AND policyname='ca_staff_all') THEN
  CREATE POLICY "ca_staff_all" ON public.collection_activities FOR ALL
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

-- ─── instructor_compensation + session_payments — super_admin only ─────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='instructor_compensation' AND policyname='ic_super_admin') THEN
  CREATE POLICY "ic_super_admin" ON public.instructor_compensation FOR ALL
    USING (public.user_has_permission(auth.uid(), 'manage_financials', branch_id))
    WITH CHECK (public.user_has_permission(auth.uid(), 'manage_financials', branch_id));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='session_payments' AND policyname='sp_super_admin') THEN
  CREATE POLICY "sp_super_admin" ON public.session_payments FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.instructors i
      JOIN public.instructor_compensation ic ON ic.instructor_id = i.id
      WHERE i.id = instructor_id
        AND public.user_has_permission(auth.uid(), 'manage_financials', ic.branch_id)
    ))
    WITH CHECK (true);
END IF; END $$;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.student_financial_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.finance_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.finance_installments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.finance_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.collection_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE
  ON public.instructor_compensation TO authenticated;
GRANT SELECT, INSERT
  ON public.session_payments TO authenticated;

-- =============================================================================
-- SEED: Super admin & team_leader finance permissions
-- =============================================================================

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('super_admin', 'team_leader')
  AND p.name IN ('manage_financials', 'read_financials')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- VALIDATION
-- =============================================================================

SELECT table_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'student_financial_accounts','finance_payments','finance_installments',
    'finance_notes','collection_activities','instructor_compensation','session_payments'
  )
GROUP BY table_name
ORDER BY table_name;
