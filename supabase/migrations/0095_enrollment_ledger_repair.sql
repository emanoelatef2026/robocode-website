-- Migration 0095: Enrollment-Based Session Ledger Repair (Phase 18.5)
--
-- Problem: student dashboards were showing group.total_sessions (e.g. 24) instead
-- of student_enrollments.enrolled_sessions (e.g. 12). Consumed counts were drifted
-- because the reconciliation engine was never run after historical attendance was
-- inserted without a contract (no-contract-yet path).
--
-- This migration:
--   1. Creates v_enrollment_academic_progress  — enrollment-scoped progress view
--   2. Creates v_enrollment_session_integrity  — detects pre-enrollment consumption
--   3. Creates full_recompute_all_consumption() — bulk ledger repair RPC
--   4. Runs the bulk recompute for all existing enrollments
--   5. Creates v_student_dashboard_integrity   — validates dashboard data sources
--
-- SAFE: additive only. No destructive drops. Idempotent via CREATE OR REPLACE.

BEGIN;

-- ── 1. Enrollment-scoped progress view ────────────────────────────────────────
-- Shows each enrollment's consumed vs enrolled sessions from the ledger.
-- consumed_ledger = COUNT(*) FROM attendance_consumptions (source of truth).
-- consumed_stored = student_enrollments.consumed_sessions (should match ledger).

CREATE OR REPLACE VIEW public.v_enrollment_academic_progress AS
SELECT
  se.id                                       AS enrollment_id,
  se.student_id,
  se.group_id,
  se.status,
  se.enrolled_sessions,
  se.consumed_sessions                        AS consumed_stored,
  COALESCE(lc.ledger_count, 0)               AS consumed_ledger,
  se.remaining_sessions,
  se.start_date,
  se.end_date,
  -- Drift: positive = stored > ledger (overcounted), negative = undercounted
  se.consumed_sessions - COALESCE(lc.ledger_count, 0) AS consumption_drift,
  -- Progress percentage based on ledger truth
  CASE
    WHEN se.enrolled_sessions > 0
    THEN ROUND((COALESCE(lc.ledger_count, 0)::NUMERIC / se.enrolled_sessions) * 100, 1)
    ELSE 0
  END                                         AS completion_pct,
  COALESCE(lc.ledger_count, 0) >= se.enrolled_sessions
    AND se.enrolled_sessions > 0             AS is_renewal_ready
FROM public.student_enrollments se
LEFT JOIN (
  SELECT enrollment_id, COUNT(*)::INT AS ledger_count
  FROM   public.attendance_consumptions
  GROUP BY enrollment_id
) lc ON lc.enrollment_id = se.id;

-- ── 2. Pre-enrollment consumption integrity view ──────────────────────────────
-- Surfaces consumption entries where the session happened BEFORE the enrollment
-- start_date — these are attribution errors that should not count.

CREATE OR REPLACE VIEW public.v_enrollment_session_integrity AS
SELECT
  ac.id                   AS consumption_id,
  ac.enrollment_id,
  ac.student_id,
  ac.attendance_record_id,
  se.start_date           AS enrollment_start,
  se.end_date             AS enrollment_end,
  sch.scheduled_at        AS session_date,
  sch.status              AS session_status,
  ar.status               AS attendance_status,
  ar.invalidated_at,
  CASE
    WHEN sch.scheduled_at < se.start_date::TIMESTAMPTZ
    THEN 'BEFORE_ENROLLMENT'
    WHEN ar.invalidated_at IS NOT NULL
    THEN 'INVALIDATED_RECORD'
    WHEN sch.status IN ('cancelled','cancelled_with_makeup')
    THEN 'CANCELLED_SESSION'
    ELSE 'VALID'
  END                     AS integrity_status
FROM public.attendance_consumptions ac
JOIN public.student_enrollments   se  ON se.id  = ac.enrollment_id
JOIN public.attendance_records    ar  ON ar.id  = ac.attendance_record_id
JOIN public.schedules             sch ON sch.id = ar.schedule_id;

-- ── 3. full_recompute_all_consumption() ───────────────────────────────────────
-- Calls the ledger-driven recompute_session_consumption() for EVERY enrollment.
-- Safe to run repeatedly (idempotent). Use for bulk repair after data imports or
-- retroactive attendance inserts.

CREATE OR REPLACE FUNCTION public.full_recompute_all_consumption()
RETURNS TABLE(
  enrollment_id UUID,
  old_consumed  INT,
  new_consumed  INT,
  fixed         BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT r.enrollment_id, r.old_consumed, r.new_consumed, r.fixed
  FROM public.recompute_session_consumption() r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.full_recompute_all_consumption() TO authenticated;

-- ── 4. Run bulk recompute ─────────────────────────────────────────────────────
-- Repair all existing consumed_sessions counters from the attendance_consumptions
-- ledger. This is safe: it only touches rows where stored ≠ ledger count.

SELECT COUNT(*) AS repaired
FROM public.full_recompute_all_consumption()
WHERE fixed = TRUE;

-- ── 5. Student dashboard integrity view ───────────────────────────────────────
-- Validates that a student has the data required for a correct dashboard display:
-- an active enrollment with enrolled_sessions > 0.

CREATE OR REPLACE VIEW public.v_student_dashboard_integrity AS
SELECT
  gs.student_id,
  gs.group_id,
  gs.status                                       AS group_membership_status,
  se.id                                           AS active_enrollment_id,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  se.start_date                                   AS enrollment_start,
  CASE
    WHEN se.id IS NULL            THEN 'NO_ENROLLMENT'
    WHEN se.enrolled_sessions = 0 THEN 'ZERO_SESSIONS'
    ELSE                               'OK'
  END                                             AS dashboard_status
FROM public.group_students gs
LEFT JOIN public.student_enrollments se
  ON  se.student_id = gs.student_id
  AND se.group_id   = gs.group_id
  AND se.status     = 'ACTIVE'
WHERE gs.status = 'active';

-- ── 6. Reconcile unlinked attendance for all active enrollments ──────────────
-- For any attendance record that has no consumption entry and falls within an
-- enrollment window, create the consumption entry (FIFO UPSERT pattern).
-- This handles the common case: student had attendance before the contract was
-- created or before reconciliation ran after enrollment creation.

DO $$
DECLARE
  v_enrollment RECORD;
  v_rec        RECORD;
  v_cap        INT;
BEGIN
  FOR v_enrollment IN
    SELECT id, student_id, start_date, end_date, enrolled_sessions, consumed_sessions
    FROM public.student_enrollments
    WHERE status = 'ACTIVE'
      AND enrolled_sessions > 0
    ORDER BY student_id, start_date ASC, created_at ASC
  LOOP
    -- Remaining capacity
    v_cap := GREATEST(0, v_enrollment.enrolled_sessions - v_enrollment.consumed_sessions);
    CONTINUE WHEN v_cap = 0;

    -- Also subtract already-linked rows inserted in this very DO block
    v_cap := GREATEST(0,
      v_enrollment.enrolled_sessions - (
        SELECT COUNT(*)::INT
        FROM public.attendance_consumptions
        WHERE enrollment_id = v_enrollment.id
      )
    );
    CONTINUE WHEN v_cap = 0;

    -- Unlinked slot-consuming records in enrollment window
    FOR v_rec IN
      SELECT ar.id AS record_id
      FROM public.attendance_records ar
      JOIN public.schedules s ON s.id = ar.schedule_id
      WHERE ar.student_id  = v_enrollment.student_id
        AND ar.invalidated_at IS NULL
        AND ar.status IN ('present','absent','late','makeup','excused')
        AND s.scheduled_at >= v_enrollment.start_date::TIMESTAMPTZ
        AND (v_enrollment.end_date IS NULL
             OR s.scheduled_at <= v_enrollment.end_date::TIMESTAMPTZ)
        AND NOT EXISTS (
          SELECT 1 FROM public.attendance_consumptions ac
          WHERE ac.attendance_record_id = ar.id
        )
      ORDER BY s.scheduled_at ASC
      LIMIT v_cap
    LOOP
      INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
      VALUES (v_rec.record_id, v_enrollment.id, v_enrollment.student_id)
      ON CONFLICT (attendance_record_id) DO NOTHING;
    END LOOP;

  END LOOP;

  -- Final ledger recompute for all enrollments after the backfill
  PERFORM * FROM public.recompute_session_consumption();
END;
$$;

COMMIT;
