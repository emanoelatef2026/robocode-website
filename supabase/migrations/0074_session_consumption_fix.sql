-- Migration 0074: Session Consumption Fix
-- Business rule: present / absent / late / makeup all consume a session.
-- Only EXCUSED does not consume. Fixes the Sprint 44 intent that was
-- never applied correctly (DB function was missing 'absent').
-- ADDITIVE ONLY. Safe to re-run.

-- ─── 1. Ensure course_id column exists on student_enrollments ────────────────
-- Should exist from Sprint 54, guard added for safety.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  = 'student_enrollments'
      AND column_name = 'course_id'
  ) THEN
    ALTER TABLE public.student_enrollments ADD COLUMN course_id UUID REFERENCES public.courses(id);
  END IF;
END;
$$;

-- ─── 2. Index on student_enrollments.course_id ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_student_enrollments_course_id
  ON public.student_enrollments(course_id)
  WHERE course_id IS NOT NULL;

-- ─── 3. Replace recompute_session_consumption ────────────────────────────────
-- Changed COUNT filter:
--   BEFORE: status IN ('present','late','makeup')
--   AFTER:  status IN ('present','absent','late','makeup')
-- EXCUSED is the only status that does NOT consume a session.

CREATE OR REPLACE FUNCTION recompute_session_consumption(p_enrollment_id UUID DEFAULT NULL)
RETURNS TABLE(enrollment_id UUID, old_consumed INT, new_consumed INT, fixed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Count actual attendance records per enrollment
  attendance_counts AS (
    SELECT
      se.id                          AS enrollment_id,
      se.consumed_sessions           AS old_consumed,
      COALESCE(COUNT(ar.id) FILTER (
        WHERE ar.status IN ('present','absent','late','makeup')
        AND ar.recorded_at >= se.start_date::TIMESTAMPTZ
      ), 0)::INT                     AS actual_attended
    FROM student_enrollments se
    LEFT JOIN group_students gs   ON gs.student_id = se.student_id
      AND gs.group_id = se.group_id
      AND gs.status = 'active'
    LEFT JOIN schedules sch       ON sch.group_course_id = se.group_course_id
      AND sch.status = 'completed'
      AND sch.scheduled_at >= se.start_date::TIMESTAMPTZ
    LEFT JOIN attendance_records ar ON ar.schedule_id = sch.id
      AND ar.student_id = se.student_id
    WHERE se.status = 'ACTIVE'
      AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
    GROUP BY se.id, se.consumed_sessions
  ),
  -- Update drifted enrollments
  updated AS (
    UPDATE student_enrollments se
    SET consumed_sessions = ac.actual_attended
    FROM attendance_counts ac
    WHERE se.id = ac.enrollment_id
      AND ABS(se.consumed_sessions - ac.actual_attended) > 0
      AND se.enrolled_sessions > 0
    RETURNING se.id, ac.old_consumed, ac.actual_attended
  )
  SELECT
    ac.enrollment_id,
    ac.old_consumed,
    ac.actual_attended AS new_consumed,
    (u.id IS NOT NULL) AS fixed
  FROM attendance_counts ac
  LEFT JOIN updated u ON u.id = ac.enrollment_id;
END; $$;

GRANT EXECUTE ON FUNCTION recompute_session_consumption(UUID) TO authenticated;

-- ─── 4. Backfill: recompute all active enrollments ───────────────────────────

SELECT * FROM recompute_session_consumption();
