-- Sprint 45: Operational Finance Finalization
-- Purpose: overdraft protection, payment allocation strategy, exhaustion engine,
--          balance recalculation robustness, performance indexes.
-- ADDITIVE ONLY. Safe to re-run. No data destroyed.
-- Run AFTER: sprint44_session_contract.sql
--
-- After applying:
--   SELECT pg_notify('pgrst', 'reload schema');

-- ─── 1. Overdraft protection on enrollments ────────────────────────────────

ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS allow_overdraft_sessions BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Payment allocation strategy ───────────────────────────────────────

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS allocation_strategy TEXT
  CHECK (allocation_strategy IN ('AUTO_FIFO','MANUAL'));

-- Backfill: payments with enrollment_id explicitly set → MANUAL
UPDATE public.finance_payments
SET allocation_strategy = 'MANUAL'
WHERE enrollment_id IS NOT NULL AND allocation_strategy IS NULL;

-- ─── 3. Explicit balance recompute function ────────────────────────────────
-- Guarantees correctness even if the AFTER trigger hasn't been applied.
-- Called from application code after every payment operation.

CREATE OR REPLACE FUNCTION public.recompute_account_balance(
  p_account_id UUID
) RETURNS TABLE (
  paid_amount      NUMERIC,
  remaining_amount NUMERIC,
  status           TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_net       NUMERIC;
  v_paid      NUMERIC;
  v_remaining NUMERIC;
  v_status    TEXT;
  v_due_date  DATE;
BEGIN
  -- Get net_amount + next_due_date
  SELECT sfa.net_amount, sfa.next_due_date
  INTO v_net, v_due_date
  FROM public.student_financial_accounts sfa
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 'CURRENT'::TEXT;
    RETURN;
  END IF;

  -- Sum all payments (including negative reversals)
  SELECT COALESCE(SUM(fp.amount), 0)
  INTO v_paid
  FROM public.finance_payments fp
  WHERE fp.account_id = p_account_id;

  v_remaining := GREATEST(0, COALESCE(v_net, 0) - v_paid);

  v_status := CASE
    WHEN v_remaining <= 0                                            THEN 'PAID'
    WHEN v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE       THEN 'OVERDUE'
    WHEN v_due_date IS NOT NULL AND v_due_date <= CURRENT_DATE + 7  THEN 'DUE_SOON'
    ELSE 'CURRENT'
  END;

  -- Update in-place
  UPDATE public.student_financial_accounts
  SET
    paid_amount      = v_paid,
    remaining_amount = v_remaining,
    status           = v_status,
    updated_at       = now()
  WHERE id = p_account_id;

  RETURN QUERY SELECT v_paid, v_remaining, v_status;
END;
$$;

-- ─── 4. Exhaustion status view ─────────────────────────────────────────────
-- HEALTHY = enrolled_sessions=0 or remaining > 5
-- WARNING = remaining 3–5
-- CRITICAL = remaining 1–2
-- EXHAUSTED = remaining <= 0 (and enrolled > 0)

CREATE OR REPLACE VIEW public.v_session_exhaustion AS
SELECT
  se.id             AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  se.allow_overdraft_sessions,
  CASE
    WHEN se.enrolled_sessions = 0                              THEN 'HEALTHY'
    WHEN se.remaining_sessions <= 0                            THEN 'EXHAUSTED'
    WHEN se.remaining_sessions <= 2                            THEN 'CRITICAL'
    WHEN se.remaining_sessions <= 5                            THEN 'WARNING'
    ELSE                                                            'HEALTHY'
  END AS exhaustion_status,
  CONCAT(p.first_name,' ',p.last_name) AS student_name,
  b.name                                AS branch_name,
  se.group_name_snapshot                AS group_name
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
JOIN public.branches  b ON b.id  = se.branch_id
WHERE se.status = 'ACTIVE'
ORDER BY se.remaining_sessions ASC NULLS LAST;

-- ─── 5. Timeline aggregation view ─────────────────────────────────────────
-- Combines all operational events for an enrollment.
-- Used by the drawer to render the unified timeline.

CREATE OR REPLACE VIEW public.v_enrollment_timeline AS
-- Payments
SELECT
  fp.id              AS event_id,
  fp.enrollment_id,
  fp.account_id,
  fp.student_id,
  'payment'::TEXT    AS event_type,
  fp.payment_date::TIMESTAMPTZ AS event_at,
  fp.amount,
  fp.payment_method  AS method,
  fp.reference_number AS reference,
  fp.notes,
  fp.receipt_url,
  NULL::TEXT         AS activity_type,
  NULL::TEXT         AS promise_status,
  NULL::UUID         AS schedule_id,
  NULL::TEXT         AS attendance_status
FROM public.finance_payments fp
WHERE fp.enrollment_id IS NOT NULL

UNION ALL

-- Collection activities (linked via account)
SELECT
  ca.id, NULL, ca.account_id, ca.student_id,
  'activity'::TEXT, ca.created_at,
  NULL, NULL, NULL, ca.notes, NULL,
  ca.activity_type, NULL, NULL, NULL
FROM public.collection_activities ca

UNION ALL

-- Payment promises
SELECT
  pp.id, NULL, pp.account_id, pp.student_id,
  'promise'::TEXT, pp.created_at,
  pp.promised_amount, NULL, NULL, pp.notes, NULL,
  NULL, pp.status, NULL, NULL
FROM public.payment_promises pp

UNION ALL

-- Finance notes
SELECT
  fn.id, NULL, fn.account_id, fn.student_id,
  'note'::TEXT, fn.created_at,
  NULL, NULL, NULL, fn.note_text, NULL,
  NULL, NULL, NULL, NULL
FROM public.finance_notes fn;

-- ─── 6. Performance indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_finance_payments_enrollment_date
  ON public.finance_payments (enrollment_id, payment_date DESC)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_payments_account_date
  ON public.finance_payments (account_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_enrollment
  ON public.attendance_records (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_activities_student_date
  ON public.collection_activities (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_activities_account_date
  ON public.collection_activities (account_id, created_at DESC)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_promises_account_status
  ON public.payment_promises (account_id, status)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fpr_payment_id
  ON public.finance_payment_reversals (original_payment_id);

CREATE INDEX IF NOT EXISTS idx_fpr_enrollment
  ON public.finance_payment_reversals (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sma_student_enrollment
  ON public.student_financial_accounts (student_id, enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- ─── 7. Ensure AFTER trigger on payments is correctly defined ─────────────
-- Re-creates the sprint43/44 trigger in a more robust form.
-- Idempotent: DROP IF EXISTS + CREATE.

CREATE OR REPLACE FUNCTION public.trg_recompute_balance_after_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_account_id    UUID;
  v_enrollment_id UUID;
BEGIN
  v_account_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.account_id ELSE NEW.account_id END
  );

  IF v_account_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Recompute balance (uses new function from Phase 3 above)
  PERFORM public.recompute_account_balance(v_account_id);

  -- Sync enrollment financial_status
  SELECT enrollment_id INTO v_enrollment_id
  FROM public.student_financial_accounts
  WHERE id = v_account_id;

  IF v_enrollment_id IS NOT NULL THEN
    PERFORM public.sync_enrollment_financial_status(v_enrollment_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_recompute_balance ON public.finance_payments;
CREATE TRIGGER trg_payment_recompute_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_balance_after_payment();

-- ─── 8. Full balance recompute for all existing accounts ─────────────────

DO $$
DECLARE v_acc_id UUID;
BEGIN
  FOR v_acc_id IN
    SELECT id FROM public.student_financial_accounts
  LOOP
    PERFORM public.recompute_account_balance(v_acc_id);
  END LOOP;
END $$;

-- ─── 9. Re-run sync for ACTIVE enrollments ───────────────────────────────

DO $$
DECLARE v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM public.student_enrollments WHERE status = 'ACTIVE'
  LOOP
    PERFORM public.sync_enrollment_financial_status(v_id);
  END LOOP;
END $$;

-- Force schema reload (run manually after applying)
-- SELECT pg_notify('pgrst', 'reload schema');
