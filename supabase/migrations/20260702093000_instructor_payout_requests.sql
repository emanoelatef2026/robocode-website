-- Phase XLI — Instructor My Payments Portal
-- Adds instructor-initiated payout requests. Everything else this feature needs
-- (payment method fields, paid-amount ledger) already exists:
--   - instructors.wallet_number / instapay_number / payment_link / payment_method
--     / bank_account_number (migrations 0036, 0062, 0110)
--   - staff_payment_records, keyed via staff_payroll_profiles (migrations 0109, 0116) —
--     reused for instructors' "paid" ledger by resolving/creating a
--     staff_payroll_profiles row per (user_id, branch_id).
-- This migration only adds the payout-request workflow (pending -> approved/rejected -> paid).

CREATE TABLE IF NOT EXISTS public.instructor_payout_requests (
  id                 UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id      UUID           NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  branch_id          UUID           NOT NULL REFERENCES public.branches(id),
  requested_amount   NUMERIC(12, 2) NOT NULL CHECK (requested_amount > 0),
  status             TEXT           NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  requested_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  decided_by         UUID           REFERENCES auth.users(id),
  decided_at         TIMESTAMPTZ,
  decision_notes     TEXT,
  payment_record_id  UUID           REFERENCES public.staff_payment_records(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_payout_requests_instructor
  ON public.instructor_payout_requests (instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_payout_requests_branch
  ON public.instructor_payout_requests (branch_id);
CREATE INDEX IF NOT EXISTS idx_instructor_payout_requests_status
  ON public.instructor_payout_requests (status);

-- Only one open (pending/approved) request per instructor at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_payout_requests_open
  ON public.instructor_payout_requests (instructor_id)
  WHERE status IN ('pending', 'approved');

CREATE TRIGGER trg_instructor_payout_requests_updated_at
  BEFORE UPDATE ON public.instructor_payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.instructor_payout_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'instructor_payout_requests'
      AND policyname = 'service_role_all_instructor_payout_requests'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "service_role_all_instructor_payout_requests"
        ON public.instructor_payout_requests
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- notifications.type is free-form TEXT (no CHECK constraint) — new notification
-- types for the payout workflow (PAYOUT_REQUEST_SUBMITTED, PAYOUT_REQUEST_DECIDED)
-- need no schema change.

NOTIFY pgrst, 'reload schema';
