-- Migration 0098: Instructor-Portal Consumption Backfill
--
-- Root cause: saveAttendance() in modules/instructor-portal/actions.ts never called
-- consume_attendance_sessions_batch().  All attendance recorded via the instructor
-- portal was written to attendance_records but attendance_consumptions was never
-- populated for those records.
--
-- Effect:
--   • attendance_consumptions table empty for instructor-led sessions
--   • student_enrollments.consumed_sessions = 0 (stored counter drifted)
--   • student dashboard showing 0/12 instead of correct consumed count
--   • v_contract_consumption_mismatch flagging all active enrollments
--
-- This migration:
--   1. Backfills attendance_consumptions for every unlinked slot-consuming record
--      against completed sessions, respecting the enrollment window.
--   2. Recomputes stored consumed_sessions counters from the now-complete ledger.
--
-- Consumption rules (mirrors attendance/constants.ts SLOT_CONSUMING_STATUSES):
--   status IN ('present','absent','late','makeup','excused')  → consumes a slot
--   session.status = 'completed'                              → academically consuming
--   session.scheduled_at >= enrollment.start_date             → in enrollment window
--   enrollment.enrolled_sessions > 0                         → not open-ended
--
-- SAFE: additive only; ON CONFLICT DO NOTHING throughout; idempotent.

BEGIN;

-- ── 1. Backfill attendance_consumptions ───────────────────────────────────────
-- For each active enrollment, find unlinked slot-consuming attendance records
-- in completed sessions within the enrollment window, up to remaining capacity.
-- FIFO by session.scheduled_at ASC to match real-time consumption ordering.

DO $$
DECLARE
  v_enrollment    RECORD;
  v_rec           RECORD;
  v_ledger_count  INT;
  v_cap           INT;
BEGIN
  FOR v_enrollment IN
    SELECT id, student_id, start_date, end_date, enrolled_sessions
    FROM   public.student_enrollments
    WHERE  status           = 'ACTIVE'
      AND  enrolled_sessions > 0
    ORDER  BY student_id ASC, start_date ASC, created_at ASC
  LOOP
    -- Current ledger count for this enrollment (accounts for previous runs)
    SELECT COUNT(*)::INT
      INTO v_ledger_count
      FROM public.attendance_consumptions
      WHERE enrollment_id = v_enrollment.id;

    v_cap := GREATEST(0, v_enrollment.enrolled_sessions - v_ledger_count);
    CONTINUE WHEN v_cap = 0;

    -- Unlinked slot-consuming records within this enrollment's window
    FOR v_rec IN
      SELECT ar.id AS record_id
      FROM   public.attendance_records ar
      JOIN   public.schedules s ON s.id = ar.schedule_id
      WHERE  ar.student_id     = v_enrollment.student_id
        AND  ar.invalidated_at IS NULL
        AND  ar.status         IN ('present','absent','late','makeup','excused')
        AND  s.status          = 'completed'
        AND  s.scheduled_at   >= v_enrollment.start_date::TIMESTAMPTZ
        AND  (v_enrollment.end_date IS NULL
              OR s.scheduled_at <= v_enrollment.end_date::TIMESTAMPTZ)
        AND  NOT EXISTS (
               SELECT 1
               FROM   public.attendance_consumptions ac
               WHERE  ac.attendance_record_id = ar.id
             )
      ORDER BY s.scheduled_at ASC, ar.id ASC
      LIMIT v_cap
    LOOP
      INSERT INTO public.attendance_consumptions
        (attendance_record_id, enrollment_id, student_id)
      VALUES
        (v_rec.record_id, v_enrollment.id, v_enrollment.student_id)
      ON CONFLICT (attendance_record_id) DO NOTHING;
    END LOOP;

  END LOOP;
END;
$$;

-- ── 2. Recompute stored consumed_sessions counters ────────────────────────────
-- Sync student_enrollments.consumed_sessions to the attendance_consumptions ledger.
-- Only updates rows where stored ≠ ledger count (safe, minimal writes).

SELECT enrollment_id, old_consumed, new_consumed, fixed
FROM   public.recompute_session_consumption();

-- ── 3. Verify: log remaining drift after reconciliation ───────────────────────
-- Should return zero rows after the recompute above.
-- Left in as an audit checkpoint — any rows here indicate a data integrity issue
-- that requires manual investigation.

DO $$
DECLARE
  v_drift_count INT;
BEGIN
  SELECT COUNT(*)::INT
    INTO v_drift_count
    FROM public.v_contract_consumption_mismatch;

  IF v_drift_count > 0 THEN
    RAISE WARNING '0098: % enrollment(s) still have consumption drift after reconciliation. Run SELECT * FROM v_contract_consumption_mismatch to investigate.', v_drift_count;
  ELSE
    RAISE NOTICE '0098: Consumption reconciliation complete. All enrollments are consistent.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
