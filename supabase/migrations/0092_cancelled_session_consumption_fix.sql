-- ── Migration 0088: Cancelled Session Consumption Fix ─────────────────────────
--
-- Problem: cancelled sessions were appearing in session counts, instructor
-- progress, and package consumption analytics — corrupting academic integrity.
--
-- This migration:
--   1. Adds invalidation columns to attendance_records (soft-flag; no hard deletes)
--   2. Adds DB-level trigger: prevents NEW attendance on cancelled sessions
--   3. Creates integrity views to surface existing violations
--   4. Creates a safe reconciliation RPC to reverse historical consumption
--      for attendance tied to cancelled sessions
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Soft-invalidation columns on attendance_records ────────────────────────
-- Allows marking historical attendance as invalidated without losing the record.
-- All historical rows default to NULL (not invalidated).

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS invalidated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidation_reason   TEXT;

-- Index: fast lookup of invalidated records
CREATE INDEX IF NOT EXISTS idx_attendance_records_invalidated
  ON public.attendance_records (invalidated_at)
  WHERE invalidated_at IS NOT NULL;

-- ── 2. DB trigger: block attendance on cancelled sessions ─────────────────────
-- Prevents any INSERT into attendance_records for a schedule whose status
-- is 'cancelled' or 'cancelled_with_makeup'.
-- This is a belt-and-suspenders guard; the application layer also validates.

CREATE OR REPLACE FUNCTION public.prevent_attendance_on_cancelled_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM   public.schedules
  WHERE  id = NEW.schedule_id;

  IF v_status IN ('cancelled', 'cancelled_with_makeup') THEN
    RAISE EXCEPTION
      'Cannot record attendance for cancelled session (id=%, status=%). '
      'Cancelled sessions are not academically delivered.',
      NEW.schedule_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cancelled_attendance ON public.attendance_records;
CREATE TRIGGER trg_prevent_cancelled_attendance
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.prevent_attendance_on_cancelled_session();

-- ── 3a. Integrity view: cancelled sessions that still have consumption ─────────
-- Should return zero rows in a healthy system.

CREATE OR REPLACE VIEW public.v_cancelled_sessions_with_consumption AS
SELECT
  s.id                            AS schedule_id,
  s.status                        AS schedule_status,
  s.session_number,
  gc.group_id,
  ar.id                           AS attendance_record_id,
  ar.student_id,
  ar.status                       AS attendance_status,
  ar.invalidated_at,
  ar.invalidation_reason,
  ac.id                           AS consumption_id,
  ac.enrollment_id,
  ac.consumed_at
FROM public.schedules            s
JOIN public.group_courses        gc ON gc.id  = s.group_course_id
JOIN public.attendance_records   ar ON ar.schedule_id = s.id
LEFT JOIN public.attendance_consumptions ac ON ac.attendance_record_id = ar.id
WHERE s.status IN ('cancelled', 'cancelled_with_makeup')
  AND ar.invalidated_at IS NULL;

-- ── 3b. Integrity view: attendance records with consumption but no valid session ─
-- Flags any consumption entry whose attendance record is already invalidated.

CREATE OR REPLACE VIEW public.v_invalid_attendance_consumption AS
SELECT
  ac.id                   AS consumption_id,
  ac.attendance_record_id,
  ac.enrollment_id,
  ac.consumed_at,
  ar.student_id,
  ar.status               AS attendance_status,
  ar.invalidated_at,
  ar.invalidation_reason,
  s.id                    AS schedule_id,
  s.status                AS schedule_status,
  s.session_number,
  gc.group_id
FROM public.attendance_consumptions ac
JOIN public.attendance_records  ar ON ar.id  = ac.attendance_record_id
JOIN public.schedules           s  ON s.id   = ar.schedule_id
JOIN public.group_courses       gc ON gc.id  = s.group_course_id
WHERE ar.invalidated_at IS NOT NULL
   OR s.status IN ('cancelled', 'cancelled_with_makeup');

-- ── 3c. Integrity view: group progress accuracy ────────────────────────────────
-- Compares the trigger-maintained groups.completed_sessions column against the
-- actual count of completed (consuming) schedules.  Drift = 0 is healthy.

CREATE OR REPLACE VIEW public.v_group_progress_integrity AS
SELECT
  g.id                              AS group_id,
  g.name                            AS group_name,
  g.completed_sessions              AS stored_completed,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules   s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id = g.id
      AND  s.status    = 'completed'
  ), 0)                             AS actual_completed,
  g.completed_sessions - COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules   s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id = g.id
      AND  s.status    = 'completed'
  ), 0)                             AS drift,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules   s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id = g.id
      AND  s.status IN ('cancelled', 'cancelled_with_makeup')
  ), 0)                             AS cancelled_session_count,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules   s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    JOIN   public.attendance_records ar ON ar.schedule_id = s.id
    WHERE  gc.group_id = g.id
      AND  s.status IN ('cancelled', 'cancelled_with_makeup')
      AND  ar.invalidated_at IS NULL
  ), 0)                             AS stale_attendance_on_cancelled
FROM public.groups g
WHERE g.deleted_at IS NULL;

-- ── 4. Reconciliation RPC: reverse consumption for cancelled-session attendance ─
-- Safe to run multiple times (idempotent).
-- Steps per affected attendance record:
--   a. Mark attendance_record.invalidated_at = NOW() with reason
--   b. Delete the attendance_consumption entry (unlocks enrolled_sessions counter)
--   c. Call recompute_session_consumption() to sync consumed_sessions counters
--
-- Returns a summary of what was changed.

CREATE OR REPLACE FUNCTION public.reconcile_cancelled_session_attendance(
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  schedule_id        UUID,
  schedule_status    TEXT,
  group_id           UUID,
  records_found      INT,
  records_invalidated INT,
  consumptions_reversed INT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r_schedule_id        UUID;
  r_schedule_status    TEXT;
  r_group_id           UUID;
  r_records_found      INT;
  r_records_invalidated INT;
  r_consumptions_reversed INT;
  v_affected_enrollments UUID[];
  v_affected_students    UUID[];
BEGIN
  -- Collect all cancelled schedules that have un-invalidated attendance
  FOR r_schedule_id, r_schedule_status, r_group_id IN
    SELECT DISTINCT s.id, s.status, gc.group_id
    FROM   public.schedules          s
    JOIN   public.group_courses      gc ON gc.id = s.group_course_id
    JOIN   public.attendance_records ar ON ar.schedule_id = s.id
    WHERE  s.status IN ('cancelled', 'cancelled_with_makeup')
      AND  ar.invalidated_at IS NULL
  LOOP
    -- Count records affected
    SELECT COUNT(*) INTO r_records_found
    FROM   public.attendance_records
    WHERE  schedule_id    = r_schedule_id
      AND  invalidated_at IS NULL;

    -- Count consumptions to reverse
    SELECT COUNT(*) INTO r_consumptions_reversed
    FROM   public.attendance_consumptions ac
    JOIN   public.attendance_records ar ON ar.id = ac.attendance_record_id
    WHERE  ar.schedule_id    = r_schedule_id
      AND  ar.invalidated_at IS NULL;

    r_records_invalidated := 0;

    IF NOT p_dry_run THEN
      -- Collect affected enrollment + student IDs for recompute
      SELECT
        ARRAY_AGG(DISTINCT ac.enrollment_id),
        ARRAY_AGG(DISTINCT ar.student_id)
      INTO v_affected_enrollments, v_affected_students
      FROM   public.attendance_consumptions ac
      JOIN   public.attendance_records ar ON ar.id = ac.attendance_record_id
      WHERE  ar.schedule_id    = r_schedule_id
        AND  ar.invalidated_at IS NULL;

      -- Step a: soft-invalidate the attendance records
      UPDATE public.attendance_records
      SET    invalidated_at      = NOW(),
             invalidation_reason = 'session_cancelled'
      WHERE  schedule_id    = r_schedule_id
        AND  invalidated_at IS NULL;

      GET DIAGNOSTICS r_records_invalidated = ROW_COUNT;

      -- Step b: remove consumption entries for these records
      DELETE FROM public.attendance_consumptions ac
      USING  public.attendance_records ar
      WHERE  ac.attendance_record_id = ar.id
        AND  ar.schedule_id          = r_schedule_id
        AND  ar.invalidation_reason  = 'session_cancelled';

      -- Step c: recompute consumed_sessions for affected enrollments
      IF v_affected_enrollments IS NOT NULL AND array_length(v_affected_enrollments, 1) > 0 THEN
        UPDATE public.student_enrollments e
        SET    consumed_sessions = (
          SELECT COUNT(*)
          FROM   public.attendance_consumptions ac
          WHERE  ac.enrollment_id = e.id
        )
        WHERE  e.id = ANY(v_affected_enrollments);
      END IF;
    END IF;

    RETURN QUERY SELECT
      r_schedule_id,
      r_schedule_status,
      r_group_id,
      r_records_found,
      r_records_invalidated,
      r_consumptions_reversed;
  END LOOP;
END;
$$;

-- Grant execute to service_role (used by admin reconciliation tools)
GRANT EXECUTE ON FUNCTION public.reconcile_cancelled_session_attendance(BOOLEAN) TO service_role;

-- ── 5. Notify PostgREST to reload schema ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
