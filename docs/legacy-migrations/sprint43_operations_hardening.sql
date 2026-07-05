-- Sprint 43: Operations Workflow Hardening + Finance UX Refinement
-- Purpose: financial_status engine, payment receipts, session milestone alerts,
--          auto-sync trigger, and performance views for sub-300ms operational UX.
-- ADDITIVE ONLY. Safe to re-run (IF NOT EXISTS / DO NOTHING guards).
--
-- ⚠ CRITICAL PREREQUISITES — apply in order if not already applied:
--   1. sprint41_enrollment_centric.sql      (creates student_enrollments)
--   2. sprint42_enrollment_snapshots.sql    (adds snapshot columns)
--   3. THIS FILE
--
-- Verify sprint41 applied:
--   SELECT * FROM information_schema.tables WHERE table_name = 'student_enrollments';
-- Force schema reload after applying:
--   SELECT pg_notify('pgrst', 'reload schema');

-- ─── 1. financial_status on student_enrollments ────────────────────────────────
-- Enrollment-level computed status. Separate from account-level `status`.
-- Values: CURRENT | DUE_SOON | OVERDUE | BLOCKED
-- BLOCKED = 30+ days overdue with remaining > 500 (escalation required).

ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS financial_status TEXT
  CHECK (financial_status IN ('CURRENT', 'DUE_SOON', 'OVERDUE', 'BLOCKED'));

-- Backfill from linked financial account status
UPDATE public.student_enrollments se
SET financial_status = CASE
  WHEN sfa.remaining_amount <= 0          THEN 'CURRENT'
  WHEN (CURRENT_DATE - sfa.next_due_date::date) >= 30
    AND sfa.remaining_amount > 500        THEN 'BLOCKED'
  WHEN sfa.status = 'OVERDUE'             THEN 'OVERDUE'
  WHEN sfa.status = 'DUE_SOON'           THEN 'DUE_SOON'
  ELSE 'CURRENT'
END
FROM public.student_financial_accounts sfa
WHERE sfa.enrollment_id = se.id
  AND se.financial_status IS NULL
  AND se.status = 'ACTIVE'
  AND sfa.next_due_date IS NOT NULL;

-- Remaining ACTIVE enrollments with no linked account → CURRENT
UPDATE public.student_enrollments
SET financial_status = 'CURRENT'
WHERE status = 'ACTIVE' AND financial_status IS NULL;

-- ─── 2. Payment receipt support ───────────────────────────────────────────────
-- Enables attaching Instapay / VF Cash / bank transfer proof to payments.

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS receipt_url    TEXT,
  ADD COLUMN IF NOT EXISTS receipt_image  TEXT,
  ADD COLUMN IF NOT EXISTS receipt_notes  TEXT;

-- ─── 3. Session milestone alerts ──────────────────────────────────────────────
-- Operational checkpoints at sessions 5 / 10 / 15 / 20.
-- Raised when a student crosses a milestone and still has a remaining balance.

CREATE TABLE IF NOT EXISTS public.session_milestone_alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id    UUID REFERENCES public.student_enrollments(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id)   ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES public.branches(id)   ON DELETE CASCADE,
  milestone_session INTEGER NOT NULL CHECK (milestone_session IN (5, 10, 15, 20)),
  alert_type       TEXT NOT NULL
                   CHECK (alert_type IN ('UNPAID','LOW_ATTENDANCE','CONSECUTIVE_ABSENCES','PROMISE_BROKEN')),
  status           TEXT NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','RESOLVED','DISMISSED')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  UNIQUE (enrollment_id, milestone_session, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_sma_branch_status
  ON public.session_milestone_alerts (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_sma_enrollment_active
  ON public.session_milestone_alerts (enrollment_id)
  WHERE status = 'ACTIVE';

-- RLS
ALTER TABLE public.session_milestone_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_milestone_alerts' AND policyname = 'super_admin_sma'
  ) THEN
    CREATE POLICY "super_admin_sma" ON public.session_milestone_alerts
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_milestone_alerts' AND policyname = 'tl_sma_own_branches'
  ) THEN
    CREATE POLICY "tl_sma_own_branches" ON public.session_milestone_alerts
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.user_branch_assignments uba ON uba.user_id = ur.user_id
          WHERE ur.user_id = auth.uid()
            AND r.name = 'team_leader'
            AND uba.branch_id = session_milestone_alerts.branch_id
        )
      );
  END IF;
END $$;

-- ─── 4. Financial-status sync function ────────────────────────────────────────
-- Called after each payment to keep enrollment.financial_status accurate.
-- Also callable manually or from a pg_cron job.

CREATE OR REPLACE FUNCTION public.sync_enrollment_financial_status(
  p_enrollment_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sfa          RECORD;
  v_sessions     INTEGER;
  v_days_overdue INTEGER;
  v_new_status   TEXT;
BEGIN
  SELECT sfa.status, sfa.remaining_amount, sfa.next_due_date,
         sfa.paid_amount, sfa.net_amount
  INTO v_sfa
  FROM public.student_financial_accounts sfa
  WHERE sfa.enrollment_id = p_enrollment_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(se.attendance_count, 0)
  INTO v_sessions
  FROM public.student_enrollments se
  WHERE se.id = p_enrollment_id;

  -- Days overdue (0 if paid or no due date)
  IF v_sfa.next_due_date IS NOT NULL AND v_sfa.remaining_amount > 0 THEN
    v_days_overdue := GREATEST(0, CURRENT_DATE - v_sfa.next_due_date::date);
  ELSE
    v_days_overdue := 0;
  END IF;

  -- Determine status
  IF COALESCE(v_sfa.remaining_amount, 0) <= 0 THEN
    v_new_status := 'CURRENT';
  ELSIF v_days_overdue >= 30 AND COALESCE(v_sfa.remaining_amount, 0) > 500 THEN
    v_new_status := 'BLOCKED';
  ELSIF v_sfa.status = 'OVERDUE' OR v_days_overdue > 0 THEN
    v_new_status := 'OVERDUE';
  ELSIF v_sfa.status = 'DUE_SOON' THEN
    v_new_status := 'DUE_SOON';
  ELSIF v_sessions >= 10 AND COALESCE(v_sfa.remaining_amount, 0) > 0 THEN
    v_new_status := 'OVERDUE';   -- session 10+ unpaid escalates to OVERDUE
  ELSE
    v_new_status := 'CURRENT';
  END IF;

  UPDATE public.student_enrollments
  SET financial_status = v_new_status, updated_at = now()
  WHERE id = p_enrollment_id;
END;
$$;

-- ─── 5. Trigger: auto-sync after payment insert/update/delete ─────────────────

CREATE OR REPLACE FUNCTION public.trg_sync_enrollment_fin_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_account_id   UUID;
  v_enrollment_id UUID;
BEGIN
  v_account_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.account_id ELSE NEW.account_id END
  );

  IF v_account_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Update account aggregates first
  UPDATE public.student_financial_accounts sfa
  SET
    paid_amount      = COALESCE((
      SELECT SUM(amount) FROM public.finance_payments
      WHERE account_id = v_account_id
    ), 0),
    remaining_amount = GREATEST(0, sfa.net_amount - COALESCE((
      SELECT SUM(amount) FROM public.finance_payments
      WHERE account_id = v_account_id
    ), 0)),
    status = CASE
      WHEN sfa.net_amount <= COALESCE((
        SELECT SUM(amount) FROM public.finance_payments WHERE account_id = v_account_id
      ), 0) THEN 'PAID'
      WHEN sfa.next_due_date IS NOT NULL AND sfa.next_due_date < CURRENT_DATE THEN 'OVERDUE'
      WHEN sfa.next_due_date IS NOT NULL
        AND sfa.next_due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'DUE_SOON'
      ELSE 'CURRENT'
    END,
    updated_at = now()
  WHERE id = v_account_id;

  -- Now sync enrollment financial_status
  SELECT enrollment_id INTO v_enrollment_id
  FROM public.student_financial_accounts WHERE id = v_account_id;

  IF v_enrollment_id IS NOT NULL THEN
    PERFORM public.sync_enrollment_financial_status(v_enrollment_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_sync_fin_status ON public.finance_payments;
CREATE TRIGGER trg_payment_sync_fin_status
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_enrollment_fin_status();

-- ─── 6. Session milestone generator function ──────────────────────────────────
-- Call this after attendance count changes. Inserts alerts for new milestones.
-- Idempotent: UNIQUE constraint prevents duplicates.

CREATE OR REPLACE FUNCTION public.generate_milestone_alerts(
  p_enrollment_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_se     RECORD;
  v_sfa    RECORD;
  v_ms     INTEGER;
BEGIN
  SELECT se.student_id, se.branch_id, se.attendance_count
  INTO v_se
  FROM public.student_enrollments se
  WHERE se.id = p_enrollment_id AND se.status = 'ACTIVE';

  IF NOT FOUND THEN RETURN; END IF;

  SELECT sfa.remaining_amount
  INTO v_sfa
  FROM public.student_financial_accounts sfa
  WHERE sfa.enrollment_id = p_enrollment_id LIMIT 1;

  -- Check each milestone
  FOREACH v_ms IN ARRAY ARRAY[5, 10, 15, 20] LOOP
    IF v_se.attendance_count >= v_ms AND COALESCE(v_sfa.remaining_amount, 0) > 0 THEN
      INSERT INTO public.session_milestone_alerts
        (enrollment_id, student_id, branch_id, milestone_session, alert_type)
      VALUES
        (p_enrollment_id, v_se.student_id, v_se.branch_id, v_ms, 'UNPAID')
      ON CONFLICT (enrollment_id, milestone_session, alert_type) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ─── 7. Performance indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollment_fin_status_active
  ON public.student_enrollments (branch_id, financial_status)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_enrollment_attendance_count
  ON public.student_enrollments (branch_id, attendance_count)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_sfa_enrollment_status
  ON public.student_financial_accounts (enrollment_id, status)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fp_account_date
  ON public.finance_payments (account_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_schedules_gc_status
  ON public.schedules (group_course_id, status, scheduled_at DESC)
  WHERE status != 'cancelled';

-- ─── 8. Collections daily performance view ────────────────────────────────────
-- Materialized-style query the operations table can filter from.

CREATE OR REPLACE VIEW public.v_collections_daily AS
SELECT
  se.id                                     AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.group_id,
  se.financial_status,
  se.status                                 AS enrollment_status,
  se.attendance_count,
  se.expected_sessions,
  s.student_code,
  CONCAT(p.first_name, ' ', p.last_name)   AS student_name,
  u.phone                                   AS student_phone,
  s.emergency_contact->>'phone1'            AS parent_phone_1,
  s.emergency_contact->>'phone2'            AS parent_phone_2,
  s.emergency_contact->>'name'              AS parent_name,
  se.group_name_snapshot                    AS group_name,
  se.instructor_name_snapshot               AS instructor_name,
  b.name                                    AS branch_name,
  sfa.remaining_amount,
  sfa.paid_amount,
  sfa.net_amount,
  sfa.next_due_date,
  sfa.status                                AS account_status,
  GREATEST(0, (CURRENT_DATE - sfa.next_due_date::date))::INTEGER
                                            AS days_overdue,
  CASE
    WHEN COALESCE(se.expected_sessions, 0) > 0
      THEN ROUND((se.attendance_count::numeric / se.expected_sessions) * 100, 1)
    ELSE 0
  END                                       AS attendance_pct,
  CASE
    WHEN COALESCE(sfa.net_amount, 0) > 0
      THEN ROUND((COALESCE(sfa.paid_amount, 0) / sfa.net_amount) * 100, 1)
    ELSE 100
  END                                       AS payment_progress_pct,
  (
    SELECT MAX(fp.payment_date)
    FROM public.finance_payments fp
    WHERE fp.account_id = sfa.id
  )                                         AS last_payment_date,
  se.updated_at
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
JOIN public.branches  b ON b.id  = se.branch_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE';

-- ─── 9. Milestone alert view ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_milestone_alerts AS
SELECT
  se.id                                       AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.group_name_snapshot                      AS group_name,
  CONCAT(p.first_name, ' ', p.last_name)     AS student_name,
  u.phone                                     AS student_phone,
  s.emergency_contact->>'phone1'              AS parent_phone,
  se.attendance_count                         AS sessions_attended,
  COALESCE(sfa.remaining_amount, 0)           AS remaining_amount,
  CASE
    WHEN se.attendance_count >= 20 THEN 20
    WHEN se.attendance_count >= 15 THEN 15
    WHEN se.attendance_count >= 10 THEN 10
    WHEN se.attendance_count >=  5 THEN  5
    ELSE NULL
  END                                         AS current_milestone,
  sfa.next_due_date,
  GREATEST(0, (CURRENT_DATE - sfa.next_due_date::date))::INTEGER
                                              AS days_overdue
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE'
  AND COALESCE(sfa.remaining_amount, 0) > 0
  AND se.attendance_count IN (5, 10, 15, 20)
ORDER BY se.attendance_count DESC, sfa.remaining_amount DESC;

-- ─── 10. Re-run sync for all ACTIVE enrollments ───────────────────────────────
-- Updates financial_status for all existing rows.

DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM public.student_enrollments WHERE status = 'ACTIVE'
  LOOP
    PERFORM public.sync_enrollment_financial_status(v_id);
  END LOOP;
END $$;
