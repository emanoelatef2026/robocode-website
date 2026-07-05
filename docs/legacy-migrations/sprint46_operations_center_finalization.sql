-- Sprint 46: Operations Center Finalization
-- Purpose: enrollment_id linkage on activities/notes/promises, timeline indexes,
--          and schema optimizations to close all operational gaps.
-- ADDITIVE ONLY. Safe to re-run. No data destroyed.
-- Run AFTER: sprint45_operational_finance_finalization.sql

-- ─── 1. Add enrollment_id to collection_activities ──────────────────────────

ALTER TABLE public.collection_activities
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collection_activities_enrollment
  ON public.collection_activities(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_activities_student_created
  ON public.collection_activities(student_id, created_at DESC);

-- Backfill: link existing activities to enrollment via account
UPDATE public.collection_activities ca
SET    enrollment_id = sfa.enrollment_id
FROM   public.student_financial_accounts sfa
WHERE  ca.account_id    = sfa.id
  AND  sfa.enrollment_id IS NOT NULL
  AND  ca.enrollment_id  IS NULL;

-- ─── 2. Add enrollment_id to finance_notes ───────────────────────────────────

ALTER TABLE public.finance_notes
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_notes_enrollment
  ON public.finance_notes(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_notes_student_created
  ON public.finance_notes(student_id, created_at DESC);

UPDATE public.finance_notes fn
SET    enrollment_id = sfa.enrollment_id
FROM   public.student_financial_accounts sfa
WHERE  fn.account_id   = sfa.id
  AND  sfa.enrollment_id IS NOT NULL
  AND  fn.enrollment_id  IS NULL;

-- ─── 3. Add enrollment_id to payment_promises ────────────────────────────────

ALTER TABLE public.payment_promises
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_promises_enrollment
  ON public.payment_promises(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_promises_student_created
  ON public.payment_promises(student_id, created_at DESC);

UPDATE public.payment_promises pp
SET    enrollment_id = sfa.enrollment_id
FROM   public.student_financial_accounts sfa
WHERE  pp.account_id   = sfa.id
  AND  sfa.enrollment_id IS NOT NULL
  AND  pp.enrollment_id  IS NULL;

-- ─── 4. Payment ledger performance indexes ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_finance_payments_enrollment_date
  ON public.finance_payments(enrollment_id, payment_date DESC)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_payments_account_date
  ON public.finance_payments(account_id, payment_date DESC);

-- ─── 5. Active enrollment lookup index ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_student_enrollments_branch_active
  ON public.student_enrollments(branch_id, status)
  WHERE status = 'ACTIVE';

-- ─── 6. Schema reload ────────────────────────────────────────────────────────

SELECT pg_notify('pgrst', 'reload schema');
