-- Migration: 0009_financials
-- Purpose: Full financial architecture — invoices, payments, subscriptions,
--          installments, discounts, coupons, instructor payouts, refunds
-- Dependencies: 0004_people
-- NOTE: Phase 8 will implement the UI. This schema is designed now to avoid
--       future painful migrations.

-- ─── Subscription Plans ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID REFERENCES public.branches(id),  -- NULL = global plan
  name             TEXT NOT NULL,
  description      TEXT,
  billing_cycle    TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'semester', 'annual', 'one_time')),
  amount           NUMERIC(10, 2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'EGP',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Discount / Coupon Definitions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES public.branches(id),  -- NULL = org-wide
  code            TEXT UNIQUE,                           -- NULL = auto-applied
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
  value           NUMERIC(10, 2) NOT NULL,  -- percentage (0-100) or fixed amount
  currency        TEXT DEFAULT 'EGP',       -- used when type = fixed_amount
  max_uses        INTEGER,                  -- NULL = unlimited
  uses_count      INTEGER NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  applies_to      TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'new_students', 'renewals')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  branch_id       UUID NOT NULL REFERENCES public.branches(id),
  invoice_number  TEXT NOT NULL UNIQUE,   -- e.g. "INV-2026-0042"
  subtotal        NUMERIC(10, 2) NOT NULL,
  discount_id     UUID REFERENCES public.discounts(id),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'unpaid'
                  CHECK (status IN ('draft', 'unpaid', 'partial', 'paid', 'cancelled', 'overdue', 'refunded')),
  notes           TEXT,
  -- Subscription reference (if invoice is for a subscription period)
  plan_id         UUID REFERENCES public.subscription_plans(id),
  period_start    DATE,
  period_end      DATE,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Invoice Line Items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10, 2) NOT NULL,
  total_price   NUMERIC(10, 2) NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Installment Plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.installment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  installments    INTEGER NOT NULL,   -- total number of installments
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.installment_plans(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2) NOT NULL,
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  sort_order      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Payments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  installment_id  UUID REFERENCES public.installments(id),  -- if paying an installment
  amount          NUMERIC(10, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                  CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'online', 'other')),
  reference       TEXT,     -- external reference number
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID REFERENCES public.users(id),
  notes           TEXT,
  -- Refund tracking
  is_refund       BOOLEAN NOT NULL DEFAULT false,
  refunds_payment UUID REFERENCES public.payments(id),  -- if this is a refund
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Instructor Payouts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instructor_payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id   UUID NOT NULL REFERENCES public.instructors(id) ON DELETE RESTRICT,
  branch_id       UUID NOT NULL REFERENCES public.branches(id),
  amount          NUMERIC(10, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  payment_method  TEXT,
  reference       TEXT,
  paid_at         TIMESTAMPTZ,
  approved_by     UUID REFERENCES public.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update invoice status to overdue when past due_date
CREATE OR REPLACE FUNCTION public.check_invoice_overdue()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status = 'unpaid'
    AND due_date < CURRENT_DATE;
END;
$$;
-- Called by pg_cron (configured separately)

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_student_id    ON public.invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id     ON public.invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id    ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_discounts_code         ON public.discounts(code) WHERE code IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Invoices: parent sees own child; staff manage
CREATE POLICY "invoices_read_parent"
  ON public.invoices FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
      AND ps.can_view_financials = true
    )
    OR public.user_has_permission(auth.uid(), 'manage_financials', branch_id)
    OR public.user_has_permission(auth.uid(), 'read_financials', branch_id)
  );

CREATE POLICY "invoices_manage"
  ON public.invoices FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_financials', branch_id))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_financials', branch_id));

-- Instructor payouts: instructors see own; finance staff manage
CREATE POLICY "payouts_read_own"
  ON public.instructor_payouts FOR SELECT
  USING (
    instructor_id IN (SELECT id FROM public.instructors WHERE user_id = auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_financials', branch_id)
  );
