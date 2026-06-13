-- Migration 0099: Group Attendance Cascade + Audit Views
--
-- Root cause: getGroupSchedules() only queried the single ACTIVE group_course,
-- causing sessions from inactive/historical courses to be invisible in the TL
-- group Attendance tab. Groups with >1 course showed N instead of the true total.
--
-- This migration adds:
--   1. cancel_schedule_with_cascade() — soft-delete a session with full cascade:
--        • invalidates attendance_records (sets invalidated_at)
--        • removes attendance_consumptions for those records
--        • recomputes student_enrollments.consumed_sessions for affected enrollments
--        • sets schedule.status = 'cancelled'
--      Reversible: un-cancel schedule + re-run reconciliation to restore.
--
--   2. Audit views:
--        v_attendance_drift            — stored vs ledger drift per enrollment
--        v_invalid_package_consumption — consumptions outside enrollment window
--        v_orphan_attendance_consumption — consumptions with no valid record
--        v_group_attendance_mismatch   — groups.completed_sessions vs actual count
--
-- SAFE: no destructive schema changes; idempotent via CREATE OR REPLACE.

BEGIN;

-- ── 1. cancel_schedule_with_cascade ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_schedule_with_cascade(
  p_schedule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_ids      UUID[];
  v_enrollment_ids  UUID[];
  v_del_consum      INT := 0;
  v_invalidated     INT := 0;
  v_recomputed      INT := 0;
BEGIN
  -- Guard: schedule must exist
  IF NOT EXISTS (
    SELECT 1 FROM public.schedules WHERE id = p_schedule_id
  ) THEN
    RAISE EXCEPTION 'cancel_schedule_with_cascade: schedule % not found', p_schedule_id;
  END IF;

  -- Collect active attendance record IDs and their enrollment attributions
  SELECT
    ARRAY_AGG(DISTINCT ar.id)             FILTER (WHERE ar.id IS NOT NULL),
    ARRAY_AGG(DISTINCT ac.enrollment_id)  FILTER (WHERE ac.enrollment_id IS NOT NULL)
  INTO v_record_ids, v_enrollment_ids
  FROM public.attendance_records ar
  LEFT JOIN public.attendance_consumptions ac ON ac.attendance_record_id = ar.id
  WHERE ar.schedule_id   = p_schedule_id
    AND ar.invalidated_at IS NULL;

  -- Step 1: Remove consumption entries (must happen before invalidation
  --         so enrollment counters are decremented correctly)
  IF v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
    DELETE FROM public.attendance_consumptions
    WHERE attendance_record_id = ANY(v_record_ids);
    GET DIAGNOSTICS v_del_consum = ROW_COUNT;
  END IF;

  -- Step 2: Soft-delete attendance records (preserves audit history)
  UPDATE public.attendance_records
  SET invalidated_at = NOW()
  WHERE schedule_id    = p_schedule_id
    AND invalidated_at IS NULL;
  GET DIAGNOSTICS v_invalidated = ROW_COUNT;

  -- Step 3: Recompute consumed_sessions for affected enrollments
  IF v_enrollment_ids IS NOT NULL AND array_length(v_enrollment_ids, 1) > 0 THEN
    UPDATE public.student_enrollments se
    SET consumed_sessions = (
      SELECT COUNT(*)::INT
      FROM public.attendance_consumptions
      WHERE enrollment_id = se.id
    )
    WHERE id = ANY(v_enrollment_ids);
    GET DIAGNOSTICS v_recomputed = ROW_COUNT;
  END IF;

  -- Step 4: Mark the schedule cancelled
  UPDATE public.schedules
  SET status = 'cancelled'
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object(
    'schedule_id',          p_schedule_id,
    'invalidated_records',  v_invalidated,
    'deleted_consumptions', v_del_consum,
    'recomputed_enrollments', v_recomputed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_schedule_with_cascade(UUID) TO authenticated;

-- ── 2. v_attendance_drift ─────────────────────────────────────────────────────
-- Enrollments where stored consumed_sessions ≠ ledger count.
-- Zero rows = fully consistent.

CREATE OR REPLACE VIEW public.v_attendance_drift AS
SELECT
  se.id                         AS enrollment_id,
  se.student_id,
  se.group_id,
  g.name                        AS group_name,
  se.enrolled_sessions,
  se.consumed_sessions          AS stored_consumed,
  COALESCE(lc.ledger_count, 0)  AS ledger_consumed,
  se.consumed_sessions - COALESCE(lc.ledger_count, 0) AS drift,
  se.status,
  se.start_date
FROM public.student_enrollments se
LEFT JOIN public.groups g ON g.id = se.group_id
LEFT JOIN (
  SELECT enrollment_id, COUNT(*)::INT AS ledger_count
  FROM public.attendance_consumptions
  GROUP BY enrollment_id
) lc ON lc.enrollment_id = se.id
WHERE se.consumed_sessions != COALESCE(lc.ledger_count, 0);

-- ── 3. v_invalid_package_consumption ─────────────────────────────────────────
-- Consumption entries where the session falls outside the enrollment window
-- (before start_date, after end_date, or the session/record was invalidated).

CREATE OR REPLACE VIEW public.v_invalid_package_consumption AS
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
    WHEN ar.invalidated_at IS NOT NULL                           THEN 'INVALIDATED_RECORD'
    WHEN sch.scheduled_at < se.start_date::TIMESTAMPTZ          THEN 'BEFORE_ENROLLMENT_START'
    WHEN se.end_date IS NOT NULL
         AND sch.scheduled_at > se.end_date::TIMESTAMPTZ        THEN 'AFTER_ENROLLMENT_END'
    WHEN sch.status IN ('cancelled','cancelled_with_makeup')     THEN 'CANCELLED_SESSION'
    ELSE 'VALID'
  END AS validity_status
FROM public.attendance_consumptions ac
JOIN public.student_enrollments  se  ON se.id  = ac.enrollment_id
JOIN public.attendance_records   ar  ON ar.id  = ac.attendance_record_id
JOIN public.schedules            sch ON sch.id = ar.schedule_id
WHERE
     ar.invalidated_at IS NOT NULL
  OR sch.scheduled_at < se.start_date::TIMESTAMPTZ
  OR (se.end_date IS NOT NULL AND sch.scheduled_at > se.end_date::TIMESTAMPTZ)
  OR sch.status IN ('cancelled','cancelled_with_makeup');

-- ── 4. v_orphan_attendance_consumption ───────────────────────────────────────
-- Consumption entries where the attendance record no longer exists or is invalid.

CREATE OR REPLACE VIEW public.v_orphan_attendance_consumption AS
SELECT
  ac.id                   AS consumption_id,
  ac.enrollment_id,
  ac.student_id,
  ac.attendance_record_id,
  ac.consumed_at,
  CASE
    WHEN ar.id IS NULL                 THEN 'MISSING_RECORD'
    WHEN ar.invalidated_at IS NOT NULL THEN 'INVALIDATED_RECORD'
    WHEN sch.status IN ('cancelled','cancelled_with_makeup') THEN 'CANCELLED_SESSION'
    ELSE 'VALID'
  END AS orphan_reason
FROM public.attendance_consumptions ac
LEFT JOIN public.attendance_records ar  ON ar.id  = ac.attendance_record_id
LEFT JOIN public.schedules          sch ON sch.id = ar.schedule_id
WHERE
     ar.id IS NULL
  OR ar.invalidated_at IS NOT NULL
  OR sch.status IN ('cancelled','cancelled_with_makeup');

-- ── 5. v_group_attendance_mismatch ───────────────────────────────────────────
-- Groups where stored completed_sessions counter ≠ actual completed schedule count.

CREATE OR REPLACE VIEW public.v_group_attendance_mismatch AS
SELECT
  g.id                       AS group_id,
  g.name                     AS group_name,
  g.completed_sessions       AS stored_completed,
  COUNT(s.id)::INT           AS actual_completed,
  g.completed_sessions - COUNT(s.id)::INT AS drift
FROM public.groups g
LEFT JOIN public.group_courses gc ON gc.group_id = g.id
LEFT JOIN public.schedules s
  ON s.group_course_id = gc.id
  AND s.status = 'completed'
GROUP BY g.id, g.name, g.completed_sessions
HAVING g.completed_sessions != COUNT(s.id)::INT;

-- ── Notify PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
