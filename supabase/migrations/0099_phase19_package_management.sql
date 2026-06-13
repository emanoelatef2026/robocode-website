-- Migration 0099: Phase 19 — Student Package Management
--
-- Adds views and RPC functions for the Package Ledger UI:
--   1. v_student_package_ledger   — per-student consumption ledger with full session context
--   2. v_student_course_timeline  — per-student enrollment history across all courses
--   3. v_orphan_attendance        — slot-consuming records not linked to any consumption
--   4. remove_student_consumption(p_consumption_id, p_student_id) — safe ledger entry removal
--   5. reconcile_student_consumption(p_student_id) — per-student FIFO backfill + recompute
--
-- SAFE: additive only. CREATE OR REPLACE throughout. No destructive changes.

BEGIN;

-- ── 1. v_student_package_ledger ───────────────────────────────────────────────
-- One row per attendance_consumptions entry.
-- Joins to attendance_records → schedules → group_courses → groups / courses / instructor.
-- Joins to student_enrollments for package context.

CREATE OR REPLACE VIEW public.v_student_package_ledger AS
SELECT
  ac.id                   AS consumption_id,
  ac.student_id,
  ac.attendance_record_id,
  ac.enrollment_id,
  ac.consumed_at,
  ar.status               AS attendance_status,
  ar.invalidated_at,
  sch.id                  AS schedule_id,
  sch.scheduled_at        AS session_date,
  sch.topic,
  sch.status              AS session_status,
  g.id                    AS group_id,
  g.name                  AS group_name,
  c.id                    AS course_id,
  c.title                 AS course_name,
  COALESCE(
    NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
    p.first_name,
    p.last_name
  )                       AS instructor_name,
  se.enrolled_sessions,
  se.start_date           AS enrollment_start,
  se.status               AS enrollment_status
FROM public.attendance_consumptions ac
JOIN public.attendance_records  ar  ON ar.id  = ac.attendance_record_id
JOIN public.schedules           sch ON sch.id = ar.schedule_id
JOIN public.group_courses       gc  ON gc.id  = sch.group_course_id
JOIN public.groups              g   ON g.id   = gc.group_id
LEFT JOIN public.courses        c   ON c.id   = gc.course_id
LEFT JOIN public.instructors    i   ON i.id   = gc.instructor_id
LEFT JOIN public.profiles       p   ON p.user_id = i.user_id
JOIN public.student_enrollments se  ON se.id  = ac.enrollment_id;

-- ── 2. v_student_course_timeline ─────────────────────────────────────────────
-- One row per student_enrollment (all statuses).
-- Provides course/group/instructor context and ledger-based progress metrics.

CREATE OR REPLACE VIEW public.v_student_course_timeline AS
SELECT
  se.id                   AS enrollment_id,
  se.student_id,
  se.group_id,
  se.status               AS enrollment_status,
  se.enrolled_sessions,
  se.consumed_sessions    AS consumed_stored,
  se.remaining_sessions,
  se.start_date,
  COALESCE(lc.ledger_count, 0) AS consumed_ledger,
  CASE
    WHEN se.enrolled_sessions > 0
    THEN ROUND((COALESCE(lc.ledger_count, 0)::NUMERIC / se.enrolled_sessions) * 100, 1)
    ELSE 0
  END                     AS completion_pct,
  g.name                  AS group_name,
  gc_info.course_name,
  gc_info.instructor_name,
  last_sess.last_session_date
FROM public.student_enrollments se
JOIN public.groups g ON g.id = se.group_id
LEFT JOIN LATERAL (
  SELECT
    c.title AS course_name,
    COALESCE(
      NULLIF(TRIM(CONCAT(p2.first_name, ' ', p2.last_name)), ''),
      p2.first_name,
      p2.last_name
    ) AS instructor_name
  FROM   public.group_courses gc2
  LEFT JOIN public.courses     c  ON c.id   = gc2.course_id
  LEFT JOIN public.instructors i2 ON i2.id  = gc2.instructor_id
  LEFT JOIN public.profiles    p2 ON p2.user_id = i2.user_id
  WHERE  gc2.group_id = g.id
  ORDER BY gc2.created_at DESC
  LIMIT 1
) gc_info ON true
LEFT JOIN (
  SELECT enrollment_id, COUNT(*)::INT AS ledger_count
  FROM   public.attendance_consumptions
  GROUP BY enrollment_id
) lc ON lc.enrollment_id = se.id
LEFT JOIN LATERAL (
  SELECT MAX(sch2.scheduled_at) AS last_session_date
  FROM   public.schedules     sch2
  JOIN   public.group_courses gc3 ON gc3.id = sch2.group_course_id
  WHERE  gc3.group_id  = se.group_id
    AND  sch2.status   = 'completed'
) last_sess ON true;

-- ── 3. v_orphan_attendance ────────────────────────────────────────────────────
-- Slot-consuming attendance records that have no consumption entry.
-- Used for diagnostics and reconciliation targeting.

CREATE OR REPLACE VIEW public.v_orphan_attendance AS
SELECT
  ar.id               AS attendance_record_id,
  ar.student_id,
  ar.status,
  ar.schedule_id,
  sch.scheduled_at    AS session_date,
  sch.status          AS session_status,
  g.name              AS group_name
FROM public.attendance_records ar
JOIN public.schedules    sch ON sch.id  = ar.schedule_id
JOIN public.group_courses gc ON gc.id   = sch.group_course_id
JOIN public.groups        g  ON g.id    = gc.group_id
WHERE ar.status IN ('present','absent','late','makeup','excused')
  AND ar.invalidated_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance_consumptions ac
    WHERE  ac.attendance_record_id = ar.id
  );

-- ── 4. remove_student_consumption() ──────────────────────────────────────────
-- Safely removes a consumption entry and recomputes the enrollment balance.
-- Verifies student_id matches to prevent cross-student tampering.
-- Returns (ok, message) for the caller to surface to the UI.

CREATE OR REPLACE FUNCTION public.remove_student_consumption(
  p_consumption_id UUID,
  p_student_id     UUID
)
RETURNS TABLE(ok BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment_id UUID;
BEGIN
  -- Verify ownership and get enrollment context
  SELECT enrollment_id
    INTO v_enrollment_id
    FROM public.attendance_consumptions
   WHERE id         = p_consumption_id
     AND student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Consumption record not found or unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Remove the consumption entry
  DELETE FROM public.attendance_consumptions
  WHERE  id = p_consumption_id;

  -- Recompute the enrollment's consumed_sessions from the now-updated ledger
  UPDATE public.student_enrollments se
     SET consumed_sessions  = COALESCE(sub.cnt, 0),
         remaining_sessions = GREATEST(0, se.enrolled_sessions - COALESCE(sub.cnt, 0))
    FROM (
      SELECT COUNT(*)::INT AS cnt
      FROM   public.attendance_consumptions
      WHERE  enrollment_id = v_enrollment_id
    ) sub
   WHERE se.id = v_enrollment_id;

  RETURN QUERY SELECT TRUE, 'Consumption removed and balance recomputed'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_student_consumption(UUID, UUID) TO authenticated;

-- ── 5. reconcile_student_consumption() ───────────────────────────────────────
-- Runs a FIFO backfill for all active enrollments of one student, then
-- recomputes consumed_sessions counters. Safe to run repeatedly (idempotent).
-- Returns per-enrollment repair report.

CREATE OR REPLACE FUNCTION public.reconcile_student_consumption(p_student_id UUID)
RETURNS TABLE(
  enrollment_id UUID,
  old_consumed  INT,
  new_consumed  INT,
  fixed         BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment    RECORD;
  v_rec           RECORD;
  v_ledger_count  INT;
  v_cap           INT;
BEGIN
  -- For each active enrollment of this student, backfill missing consumptions FIFO
  FOR v_enrollment IN
    SELECT id, student_id, start_date, end_date, enrolled_sessions
    FROM   public.student_enrollments
    WHERE  student_id       = p_student_id
      AND  status           = 'ACTIVE'
      AND  enrolled_sessions > 0
    ORDER BY start_date ASC, created_at ASC
  LOOP
    -- Current ledger count (accounts for prior iterations of this loop)
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
      WHERE  ar.student_id     = p_student_id
        AND  ar.invalidated_at IS NULL
        AND  ar.status         IN ('present','absent','late','makeup','excused')
        AND  s.status          = 'completed'
        AND  s.scheduled_at   >= v_enrollment.start_date::TIMESTAMPTZ
        AND  (v_enrollment.end_date IS NULL
              OR s.scheduled_at <= v_enrollment.end_date::TIMESTAMPTZ)
        AND  NOT EXISTS (
               SELECT 1 FROM public.attendance_consumptions ac
               WHERE  ac.attendance_record_id = ar.id
             )
      ORDER BY s.scheduled_at ASC, ar.id ASC
      LIMIT v_cap
    LOOP
      INSERT INTO public.attendance_consumptions
        (attendance_record_id, enrollment_id, student_id)
      VALUES
        (v_rec.record_id, v_enrollment.id, p_student_id)
      ON CONFLICT (attendance_record_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Recompute consumed_sessions for all this student's enrollments
  RETURN QUERY
  SELECT r.enrollment_id, r.old_consumed, r.new_consumed, r.fixed
  FROM   public.recompute_session_consumption() r
  JOIN   public.student_enrollments se ON se.id = r.enrollment_id
  WHERE  se.student_id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_student_consumption(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
