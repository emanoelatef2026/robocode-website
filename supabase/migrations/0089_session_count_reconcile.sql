-- PHASE 18.2: Session count reconciliation functions.
-- Provides safe, idempotent RPCs to reconcile stored session counts against
-- actual schedule/consumption records after any data migration or integrity event.

-- ── 1. Health view: groups where stored count drifts from actual ──────────────
-- Query this first to assess scope before running any recompute.

CREATE OR REPLACE VIEW public.v_session_count_health AS
SELECT
  g.id                             AS group_id,
  g.name                           AS group_name,
  g.status                         AS group_status,
  g.completed_sessions             AS stored_count,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules    s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id = g.id
      AND  s.status    = 'completed'
  ), 0)                            AS actual_count,
  g.completed_sessions - COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules    s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id = g.id
      AND  s.status    = 'completed'
  ), 0)                            AS drift
FROM public.groups g
WHERE g.deleted_at IS NULL;

-- ── 2. Recompute groups.completed_sessions ────────────────────────────────────
-- Overwrites stored value with ground truth (schedules.status='completed').
-- Mirrors the trigger from migration 0034 but allows manual reconciliation.
-- Pass p_group_id to fix a single group; NULL recomputes all.

CREATE OR REPLACE FUNCTION public.recompute_group_completed_sessions(
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
  group_id  UUID,
  old_count INT,
  new_count INT,
  changed   BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      g.id,
      g.completed_sessions AS old_count,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM   public.schedules     s
        JOIN   public.group_courses gc ON gc.id = s.group_course_id
        WHERE  gc.group_id = g.id
          AND  s.status    = 'completed'
      ), 0) AS new_count
    FROM public.groups g
    WHERE g.deleted_at IS NULL
      AND (p_group_id IS NULL OR g.id = p_group_id)
  LOOP
    IF r.old_count IS DISTINCT FROM r.new_count THEN
      UPDATE public.groups
      SET    completed_sessions = r.new_count
      WHERE  id = r.id;
    END IF;

    group_id  := r.id;
    old_count := r.old_count;
    new_count := r.new_count;
    changed   := r.old_count IS DISTINCT FROM r.new_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 3. Recompute student_enrollments.consumed_sessions ───────────────────────
-- Counts attendance_consumptions ledger rows per enrollment.
-- Safe to run after reconcile_cancelled_session_attendance (0088 RPC) removes
-- stale consumption entries for cancelled sessions.
-- Pass p_student_id to fix a single student; NULL recomputes all active enrollments.

CREATE OR REPLACE FUNCTION public.recompute_student_consumed_sessions(
  p_student_id UUID DEFAULT NULL
)
RETURNS TABLE (
  enrollment_id UUID,
  student_id    UUID,
  old_count     INT,
  new_count     INT,
  changed       BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      e.id         AS enrollment_id,
      e.student_id,
      e.consumed_sessions AS old_count,
      COALESCE((
        SELECT COUNT(*)::INT
        FROM   public.attendance_consumptions ac
        WHERE  ac.enrollment_id = e.id
      ), 0) AS new_count
    FROM public.student_enrollments e
    WHERE e.status = 'ACTIVE'
      AND (p_student_id IS NULL OR e.student_id = p_student_id)
  LOOP
    IF r.old_count IS DISTINCT FROM r.new_count THEN
      UPDATE public.student_enrollments
      SET    consumed_sessions = r.new_count
      WHERE  id = r.enrollment_id;
    END IF;

    enrollment_id := r.enrollment_id;
    student_id    := r.student_id;
    old_count     := r.old_count;
    new_count     := r.new_count;
    changed       := r.old_count IS DISTINCT FROM r.new_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 4. Full reconciliation sweep (convenience wrapper) ────────────────────────
-- Runs both recompute functions in sequence and returns a combined summary.
-- Intended for post-migration admin use only.

CREATE OR REPLACE FUNCTION public.reconcile_all_session_counts()
RETURNS TABLE (
  entity        TEXT,
  entity_id     UUID,
  old_count     INT,
  new_count     INT,
  changed       BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    'group'::TEXT AS entity,
    group_id      AS entity_id,
    old_count,
    new_count,
    changed
  FROM public.recompute_group_completed_sessions(NULL);

  RETURN QUERY
  SELECT
    'enrollment'::TEXT AS entity,
    enrollment_id      AS entity_id,
    old_count,
    new_count,
    changed
  FROM public.recompute_student_consumed_sessions(NULL);
END;
$$;

NOTIFY pgrst, 'reload schema';
