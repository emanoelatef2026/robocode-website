-- Sprint 44: Session Contract Finance System
-- Purpose: student_enrollments becomes the PRIMARY session contract.
--          Financial data is tied to the enrollment/session package,
--          NOT to group, branch, or course.
--          Adds session tracking, payment ledger linkage, reversal table,
--          consumption trigger, and operational performance views.
--
-- RULES:
--   ADDITIVE ONLY.  Safe to re-run.  No data destroyed.
--   Run AFTER: sprint41, sprint42, sprint43.
--
-- After applying:
--   SELECT pg_notify('pgrst', 'reload schema');

-- ─── 1. Expand financial_status check — add COMPLETED ────────────────────────
-- PostgreSQL doesn't let you ALTER a CHECK constraint directly.
-- We find the existing one by content and drop+recreate.

DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.student_enrollments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%financial_status%'
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.student_enrollments DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_financial_status_check
  CHECK (financial_status IN ('CURRENT','DUE_SOON','OVERDUE','BLOCKED','COMPLETED'));

-- ─── 2. Session contract fields on student_enrollments ───────────────────────

ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS enrolled_sessions  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumed_sessions  INTEGER NOT NULL DEFAULT 0;

-- remaining_sessions as a stored generated column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'student_enrollments'
      AND column_name  = 'remaining_sessions'
  ) THEN
    ALTER TABLE public.student_enrollments
      ADD COLUMN remaining_sessions INTEGER
      GENERATED ALWAYS AS (GREATEST(0, enrolled_sessions - consumed_sessions)) STORED;
  END IF;
END $$;

-- ─── 3. enrollment_id directly on finance_payments ───────────────────────────
-- True ledger linkage: payment is owned by enrollment, not account.

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fp_enrollment_id
  ON public.finance_payments (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Backfill: resolve via account → SFA → enrollment
UPDATE public.finance_payments fp
SET enrollment_id = sfa.enrollment_id
FROM public.student_financial_accounts sfa
WHERE sfa.id = fp.account_id
  AND sfa.enrollment_id IS NOT NULL
  AND fp.enrollment_id IS NULL;

-- ─── 4. Payment reversal ledger ───────────────────────────────────────────────
-- Immutable. Only reversals and refunds allowed, never edits.

CREATE TABLE IF NOT EXISTS public.finance_payment_reversals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL
    REFERENCES public.finance_payments(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES public.student_financial_accounts(id) ON DELETE SET NULL,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,     -- positive value (amount reversed)
  reversal_type   TEXT NOT NULL DEFAULT 'REVERSAL'
                  CHECK (reversal_type IN ('REVERSAL','REFUND','CORRECTION')),
  reason          TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpr_enrollment
  ON public.finance_payment_reversals (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_fpr_student
  ON public.finance_payment_reversals (student_id);

-- RLS
ALTER TABLE public.finance_payment_reversals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_payment_reversals' AND policyname = 'super_admin_fpr'
  ) THEN
    CREATE POLICY "super_admin_fpr" ON public.finance_payment_reversals
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
    SELECT 1 FROM pg_policies
    WHERE tablename = 'finance_payment_reversals' AND policyname = 'tl_fpr_own_branches'
  ) THEN
    CREATE POLICY "tl_fpr_own_branches" ON public.finance_payment_reversals
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.user_branch_assignments uba ON uba.user_id = ur.user_id
          JOIN public.student_enrollments se ON se.id = finance_payment_reversals.enrollment_id
          WHERE ur.user_id = auth.uid()
            AND r.name = 'team_leader'
            AND uba.branch_id = se.branch_id
        )
      );
  END IF;
END $$;

-- ─── 5. Receipts storage bucket (via SQL-accessible helper) ──────────────────
-- NOTE: Supabase Storage bucket creation must be done via dashboard or
-- the Management API. This SQL block is a no-op placeholder.
-- Create a bucket named 'receipts' with public: true in your Supabase dashboard.
-- The API route at /api/finance/receipts will auto-create it if it doesn't exist.

-- ─── 6. Session consumption trigger ─────────────────────────────────────────
-- Fires on attendance_records INSERT/UPDATE/DELETE.
-- Updates consumed_sessions on the related enrollment.

CREATE OR REPLACE FUNCTION public.trg_sync_consumed_sessions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_student_id    UUID;
  v_schedule_id   UUID;
  v_enrollment_id UUID;
BEGIN
  v_student_id  := COALESCE(NEW.student_id, OLD.student_id);
  v_schedule_id := COALESCE(NEW.schedule_id, OLD.schedule_id);

  -- Try explicit enrollment_id first
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  -- Fallback: resolve via schedule → group_course → active enrollment
  IF v_enrollment_id IS NULL AND v_schedule_id IS NOT NULL AND v_student_id IS NOT NULL THEN
    SELECT se.id INTO v_enrollment_id
    FROM public.schedules s
    JOIN public.student_enrollments se
      ON se.group_course_id = s.group_course_id
     AND se.student_id      = v_student_id
     AND se.status          = 'ACTIVE'
    WHERE s.id = v_schedule_id
    ORDER BY se.created_at DESC
    LIMIT 1;
  END IF;

  IF v_enrollment_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Recount consumed sessions: present/absent/late/makeup count; excused = 0
  UPDATE public.student_enrollments se
  SET
    consumed_sessions = (
      SELECT COALESCE(COUNT(*), 0)::INTEGER
      FROM public.attendance_records ar
      JOIN public.schedules s ON s.id = ar.schedule_id
      WHERE ar.student_id = se.student_id
        AND ar.status IN ('present', 'late', 'makeup', 'absent')
        AND s.scheduled_at >= se.start_date::TIMESTAMPTZ
        AND (
          ar.enrollment_id = se.id
          OR (ar.enrollment_id IS NULL AND se.group_course_id = s.group_course_id)
        )
    ),
    updated_at = now()
  WHERE se.id = v_enrollment_id;

  -- Cascade: sync financial_status
  PERFORM public.sync_enrollment_financial_status(v_enrollment_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_sync_sessions ON public.attendance_records;
CREATE TRIGGER trg_attendance_sync_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_consumed_sessions();

-- ─── 7. Backfill consumed_sessions for existing ACTIVE enrollments ────────────

UPDATE public.student_enrollments se
SET consumed_sessions = (
  SELECT COALESCE(COUNT(*), 0)::INTEGER
  FROM public.attendance_records ar
  JOIN public.schedules s ON s.id = ar.schedule_id
  WHERE ar.student_id = se.student_id
    AND ar.status IN ('present', 'late', 'makeup', 'absent')
    AND s.scheduled_at >= se.start_date::TIMESTAMPTZ
    AND (
      ar.enrollment_id = se.id
      OR (ar.enrollment_id IS NULL AND se.group_course_id = s.group_course_id)
    )
)
WHERE se.status = 'ACTIVE'
  AND se.consumed_sessions = 0;

-- Backfill enrolled_sessions from expected_sessions where not yet set
UPDATE public.student_enrollments
SET enrolled_sessions = GREATEST(expected_sessions, consumed_sessions)
WHERE enrolled_sessions = 0
  AND (expected_sessions > 0 OR consumed_sessions > 0)
  AND status = 'ACTIVE';

-- ─── 8. Updated sync function — handle COMPLETED status ──────────────────────
-- Replaces the sprint43 version to include COMPLETED.

CREATE OR REPLACE FUNCTION public.sync_enrollment_financial_status(
  p_enrollment_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sfa          RECORD;
  v_se           RECORD;
  v_days_overdue INTEGER;
  v_new_status   TEXT;
BEGIN
  SELECT se.status AS enrollment_status,
         se.enrolled_sessions, se.consumed_sessions,
         se.remaining_sessions
  INTO v_se
  FROM public.student_enrollments se
  WHERE se.id = p_enrollment_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Dropped/transferred/completed enrollments → COMPLETED financial status
  IF v_se.enrollment_status IN ('DROPPED', 'TRANSFERRED') THEN
    UPDATE public.student_enrollments
    SET financial_status = 'COMPLETED', updated_at = now()
    WHERE id = p_enrollment_id;
    RETURN;
  END IF;

  SELECT sfa.status, sfa.remaining_amount, sfa.next_due_date
  INTO v_sfa
  FROM public.student_financial_accounts sfa
  WHERE sfa.enrollment_id = p_enrollment_id
  LIMIT 1;

  -- No linked account yet
  IF NOT FOUND THEN
    UPDATE public.student_enrollments
    SET financial_status = 'CURRENT', updated_at = now()
    WHERE id = p_enrollment_id;
    RETURN;
  END IF;

  -- Days overdue
  IF v_sfa.next_due_date IS NOT NULL AND COALESCE(v_sfa.remaining_amount, 0) > 0 THEN
    v_days_overdue := GREATEST(0, CURRENT_DATE - v_sfa.next_due_date::date);
  ELSE
    v_days_overdue := 0;
  END IF;

  -- All sessions consumed + paid → COMPLETED
  IF v_se.enrollment_status = 'COMPLETED'
     OR (v_se.enrolled_sessions > 0 AND COALESCE(v_se.remaining_sessions, 0) <= 0
         AND COALESCE(v_sfa.remaining_amount, 0) <= 0)
  THEN
    v_new_status := 'COMPLETED';
  ELSIF COALESCE(v_sfa.remaining_amount, 0) <= 0 THEN
    v_new_status := 'CURRENT';
  ELSIF v_days_overdue >= 30 AND COALESCE(v_sfa.remaining_amount, 0) > 500 THEN
    v_new_status := 'BLOCKED';
  ELSIF v_sfa.status = 'OVERDUE' OR v_days_overdue > 0 THEN
    v_new_status := 'OVERDUE';
  ELSIF v_sfa.status = 'DUE_SOON' THEN
    v_new_status := 'DUE_SOON';
  ELSE
    v_new_status := 'CURRENT';
  END IF;

  UPDATE public.student_enrollments
  SET financial_status = v_new_status, updated_at = now()
  WHERE id = p_enrollment_id;
END;
$$;

-- ─── 9. Operational views ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_overdue_enrollments AS
SELECT
  se.id            AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.financial_status,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  CONCAT(p.first_name,' ',p.last_name)  AS student_name,
  u.phone                                AS student_phone,
  s.emergency_contact->>'phone1'         AS parent_phone,
  se.group_name_snapshot                 AS group_name,
  b.name                                 AS branch_name,
  sfa.remaining_amount,
  sfa.next_due_date,
  GREATEST(0, CURRENT_DATE - sfa.next_due_date::date)::INTEGER AS days_overdue
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
JOIN public.branches  b ON b.id  = se.branch_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE'
  AND se.financial_status IN ('OVERDUE','BLOCKED')
ORDER BY sfa.remaining_amount DESC NULLS LAST;

CREATE OR REPLACE VIEW public.v_blocked_students AS
SELECT * FROM public.v_overdue_enrollments
WHERE financial_status = 'BLOCKED';

CREATE OR REPLACE VIEW public.v_students_near_completion AS
SELECT
  se.id            AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  CONCAT(p.first_name,' ',p.last_name)  AS student_name,
  se.group_name_snapshot                 AS group_name,
  b.name                                 AS branch_name,
  sfa.remaining_amount
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
JOIN public.branches  b ON b.id  = se.branch_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE'
  AND se.enrolled_sessions > 0
  AND se.remaining_sessions BETWEEN 1 AND 3
ORDER BY se.remaining_sessions ASC;

CREATE OR REPLACE VIEW public.v_payment_activity AS
SELECT
  fp.id,
  fp.enrollment_id,
  fp.account_id,
  fp.student_id,
  fp.amount,
  fp.payment_date,
  fp.payment_method,
  fp.reference_number,
  fp.receipt_url,
  fp.created_at,
  CONCAT(p.first_name,' ',p.last_name) AS student_name,
  b.name                               AS branch_name
FROM public.finance_payments fp
JOIN public.students  s ON s.id  = fp.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
LEFT JOIN public.student_enrollments se ON se.id = fp.enrollment_id
LEFT JOIN public.branches b ON b.id = se.branch_id
ORDER BY fp.payment_date DESC, fp.created_at DESC;

CREATE OR REPLACE VIEW public.v_collections_queue AS
SELECT
  se.id                                    AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.financial_status,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  CONCAT(p.first_name,' ',p.last_name)    AS student_name,
  u.phone                                  AS student_phone,
  s.emergency_contact->>'phone1'           AS parent_phone_1,
  s.emergency_contact->>'name'             AS parent_name,
  se.group_name_snapshot                   AS group_name,
  se.instructor_name_snapshot              AS instructor_name,
  b.name                                   AS branch_name,
  sfa.remaining_amount,
  sfa.paid_amount,
  sfa.net_amount,
  sfa.next_due_date,
  GREATEST(0,(CURRENT_DATE - sfa.next_due_date::date))::INTEGER AS days_overdue,
  (SELECT MAX(payment_date) FROM public.finance_payments fp
   WHERE fp.enrollment_id = se.id)         AS last_payment_date,
  CASE
    WHEN se.financial_status = 'BLOCKED'   THEN 1
    WHEN se.financial_status = 'OVERDUE'   THEN 2
    WHEN se.financial_status = 'DUE_SOON'  THEN 3
    ELSE 4
  END                                      AS urgency_order
FROM public.student_enrollments se
JOIN public.students  s ON s.id  = se.student_id
JOIN public.users     u ON u.id  = s.user_id
JOIN public.profiles  p ON p.user_id = u.id
JOIN public.branches  b ON b.id  = se.branch_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE'
  AND sfa.remaining_amount > 0
ORDER BY urgency_order, sfa.remaining_amount DESC;

-- ─── 10. Performance indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollment_sessions
  ON public.student_enrollments (branch_id, enrolled_sessions, consumed_sessions)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_fp_enrollment_date
  ON public.finance_payments (enrollment_id, payment_date DESC)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fp_student_date
  ON public.finance_payments (student_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_ar_student_enrollment
  ON public.attendance_records (student_id, enrollment_id)
  WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ar_student_status
  ON public.attendance_records (student_id, status)
  WHERE status IN ('present','late','makeup','absent');

-- ─── 11. Re-run financial status sync for all ACTIVE enrollments ─────────────

DO $$
DECLARE v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM public.student_enrollments WHERE status = 'ACTIVE'
  LOOP
    PERFORM public.sync_enrollment_financial_status(v_id);
  END LOOP;
END $$;
