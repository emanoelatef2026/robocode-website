-- Migration 0076: Session Credits Model
-- Contracts own ONLY session credits + financials + dates + status.
-- NOT course, group, or instructor.
--
-- Changes:
--   1. Index: FIFO ordering for enrollment lookup by student
--   2. increment_consumed_sessions_batch() — real-time atomic increment after attendance
--   3. Replace recompute_session_consumption() — pure FIFO waterfall, no group/course dependency
-- ADDITIVE ONLY. Safe to re-run.

-- ─── 1. Index for FIFO enrollment ordering ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollments_student_start
  ON public.student_enrollments(student_id, start_date ASC, created_at ASC)
  WHERE status = 'ACTIVE';

-- ─── 2. increment_consumed_sessions_batch ────────────────────────────────────
-- Called in real-time after attendance_records are inserted.
-- Atomically increments consumed_sessions and decrements remaining_sessions
-- for each enrollment in the list.

CREATE OR REPLACE FUNCTION increment_consumed_sessions_batch(p_enrollment_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.student_enrollments
  SET
    consumed_sessions  = consumed_sessions + 1,
    remaining_sessions = GREATEST(0, remaining_sessions - 1)
  WHERE id = ANY(p_enrollment_ids)
    AND status = 'ACTIVE';
END; $$;

GRANT EXECUTE ON FUNCTION increment_consumed_sessions_batch(UUID[]) TO authenticated;

-- ─── 3. Replace recompute_session_consumption ────────────────────────────────
-- Pure FIFO waterfall: no group_id / course_id filter.
-- Counts all attendance records for the student (all statuses that consume a slot)
-- then distributes across enrollments oldest-first.

CREATE OR REPLACE FUNCTION recompute_session_consumption(p_enrollment_id UUID DEFAULT NULL)
RETURNS TABLE(enrollment_id UUID, old_consumed INT, new_consumed INT, fixed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Total slot-consuming attendance per student (all statuses consume a seat)
  all_attendance AS (
    SELECT
      ar.student_id,
      COUNT(*) AS total_slots
    FROM attendance_records ar
    WHERE ar.status IN ('present', 'absent', 'late', 'makeup', 'excused')
    GROUP BY ar.student_id
  ),
  -- Enrollments with FIFO cumulative caps (ordered by start_date, then created_at)
  enrollment_buckets AS (
    SELECT
      se.id,
      se.student_id,
      se.consumed_sessions             AS old_consumed,
      se.enrolled_sessions,
      -- cumulative sessions capacity UP TO AND INCLUDING this enrollment
      SUM(se.enrolled_sessions) OVER (
        PARTITION BY se.student_id
        ORDER BY se.start_date ASC, se.created_at ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )                                AS cap_end,
      -- cumulative sessions capacity BEFORE this enrollment
      COALESCE(SUM(se.enrolled_sessions) OVER (
        PARTITION BY se.student_id
        ORDER BY se.start_date ASC, se.created_at ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0)                            AS cap_start
    FROM student_enrollments se
    WHERE se.status = 'ACTIVE'
      AND se.enrolled_sessions > 0
      AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
  ),
  -- FIFO allocation: how many slots fall into each enrollment bucket
  fifo AS (
    SELECT
      eb.id,
      eb.old_consumed,
      GREATEST(0,
        LEAST(
          COALESCE(aa.total_slots, 0) - eb.cap_start,
          eb.enrolled_sessions
        )
      )::INT AS new_consumed
    FROM enrollment_buckets eb
    LEFT JOIN all_attendance aa ON aa.student_id = eb.student_id
  ),
  updated AS (
    UPDATE student_enrollments se
    SET
      consumed_sessions  = f.new_consumed,
      remaining_sessions = GREATEST(0, se.enrolled_sessions - f.new_consumed)
    FROM fifo f
    WHERE se.id = f.id
      AND ABS(se.consumed_sessions - f.new_consumed) > 0
    RETURNING se.id, f.old_consumed, f.new_consumed
  )
  SELECT
    f.id            AS enrollment_id,
    f.old_consumed,
    f.new_consumed,
    (u.id IS NOT NULL) AS fixed
  FROM fifo f
  LEFT JOIN updated u ON u.id = f.id;
END; $$;

GRANT EXECUTE ON FUNCTION recompute_session_consumption(UUID) TO authenticated;

-- ─── 4. Backfill ─────────────────────────────────────────────────────────────

SELECT * FROM recompute_session_consumption();
