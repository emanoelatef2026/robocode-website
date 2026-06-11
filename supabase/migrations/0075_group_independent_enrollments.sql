-- Migration 0075: Group-Independent Enrollment Support
-- Contracts belong to student + course, NOT to group.
-- Groups are delivery containers only.
--
-- Changes:
--   1. Index for course-only enrollment lookups (group_id IS NULL, course_id set)
--   2. Replace recompute_session_consumption to handle both:
--        a) Group-linked enrollments  (group_course_id IS NOT NULL)
--        b) Group-independent enrollments (group_course_id IS NULL, course_id IS NOT NULL)
--   3. Backfill: recompute all active enrollments with the updated logic
-- ADDITIVE ONLY. Safe to re-run.

-- ─── 1. Index for group-independent enrollment lookups ────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollments_course_standalone
  ON public.student_enrollments(course_id, status)
  WHERE course_id IS NOT NULL AND group_id IS NULL;

-- ─── 2. Replace recompute_session_consumption ────────────────────────────────
-- Handles group-independent enrollments by joining via course_id → group_courses
-- instead of directly via group_course_id when the latter is NULL.
-- FIFO rule: for group-independent, ALL completed sessions for the course count.

CREATE OR REPLACE FUNCTION recompute_session_consumption(p_enrollment_id UUID DEFAULT NULL)
RETURNS TABLE(enrollment_id UUID, old_consumed INT, new_consumed INT, fixed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH
  attendance_counts AS (
    SELECT
      se.id                          AS enrollment_id,
      se.consumed_sessions           AS old_consumed,
      COALESCE(COUNT(ar.id) FILTER (
        WHERE ar.status IN ('present','absent','late','makeup')
        AND   ar.recorded_at >= se.start_date::TIMESTAMPTZ
      ), 0)::INT                     AS actual_attended
    FROM student_enrollments se
    -- For group-linked (group_course_id set): join directly.
    -- For group-independent (group_course_id NULL, course_id set): find any active
    -- group_course for that course so we can reach its schedules.
    LEFT JOIN group_courses gc ON (
        (se.group_course_id IS NOT NULL AND gc.id = se.group_course_id)
      OR
        (se.group_course_id IS NULL AND se.course_id IS NOT NULL
         AND gc.course_id = se.course_id AND gc.status = 'active')
    )
    LEFT JOIN schedules sch ON sch.group_course_id = gc.id
      AND sch.status  = 'completed'
      AND sch.scheduled_at >= se.start_date::TIMESTAMPTZ
    LEFT JOIN attendance_records ar ON ar.schedule_id = sch.id
      AND ar.student_id = se.student_id
    WHERE se.status = 'ACTIVE'
      AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
    GROUP BY se.id, se.consumed_sessions
  ),
  updated AS (
    UPDATE student_enrollments se
    SET
      consumed_sessions  = ac.actual_attended,
      remaining_sessions = GREATEST(0, se.enrolled_sessions - ac.actual_attended)
    FROM attendance_counts ac
    WHERE se.id  = ac.enrollment_id
      AND ABS(se.consumed_sessions - ac.actual_attended) > 0
      AND se.enrolled_sessions > 0
    RETURNING se.id, ac.old_consumed, ac.actual_attended
  )
  SELECT
    ac.enrollment_id,
    ac.old_consumed,
    ac.actual_attended  AS new_consumed,
    (u.id IS NOT NULL)  AS fixed
  FROM attendance_counts ac
  LEFT JOIN updated u ON u.id = ac.enrollment_id;
END; $$;

GRANT EXECUTE ON FUNCTION recompute_session_consumption(UUID) TO authenticated;

-- ─── 3. Backfill ─────────────────────────────────────────────────────────────

SELECT * FROM recompute_session_consumption();
