-- Migration 0081: Attendance Reconciliation Engine
--
-- Adds infrastructure for retroactive attendance-to-enrollment matching:
--   • v_unmatched_attendance  — attendance records with no consumption entry
--   • v_attendance_funding_status — per-record funding state (FUNDED / UNFUNDED / NON_CONSUMING)
--   • v_reconciliation_candidates — students with unmatched + eligible enrollments
--   • reconcile_student_attendance_sql(UUID) — DB-side FIFO reconciler (callable from admin)
--   • Additional performance indexes
--
-- ADDITIVE ONLY. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout).

-- ─── 1. v_unmatched_attendance ────────────────────────────────────────────────
-- All attendance_records that have no attendance_consumptions entry.
-- "Unfunded" sessions: real academic history, not yet attributed to a package.

CREATE OR REPLACE VIEW public.v_unmatched_attendance AS
SELECT
  ar.id                          AS attendance_record_id,
  ar.student_id,
  ar.schedule_id,
  ar.status,
  ar.recorded_at,
  ar.group_name_snapshot,
  ar.course_name_snapshot,
  ar.instructor_name_snapshot,
  ar.branch_name_snapshot,
  sch.scheduled_at               AS session_date,
  sch.branch_id
FROM public.attendance_records ar
LEFT JOIN public.schedules sch ON sch.id = ar.schedule_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.attendance_consumptions ac
  WHERE ac.attendance_record_id = ar.id
)
AND ar.status IN ('present', 'absent', 'late', 'makeup', 'excused');

GRANT SELECT ON public.v_unmatched_attendance TO authenticated;

-- ─── 2. v_attendance_funding_status ──────────────────────────────────────────
-- Every attendance record annotated with its funding state.
--
--   FUNDED         → linked to an enrollment via attendance_consumptions
--   UNFUNDED       → slot-consuming status but no consumption entry
--   NON_CONSUMING  → status does not consume a slot (future extension)

CREATE OR REPLACE VIEW public.v_attendance_funding_status AS
SELECT
  ar.id                          AS attendance_record_id,
  ar.student_id,
  ar.schedule_id,
  ar.status,
  ar.recorded_at,
  sch.scheduled_at               AS session_date,
  sch.branch_id,
  ar.group_name_snapshot,
  ar.course_name_snapshot,
  ar.instructor_name_snapshot,
  ar.branch_name_snapshot,
  ac.enrollment_id,
  CASE
    WHEN ac.id IS NOT NULL                                          THEN 'FUNDED'
    WHEN ar.status IN ('present','absent','late','makeup','excused') THEN 'UNFUNDED'
    ELSE 'NON_CONSUMING'
  END AS funding_status
FROM public.attendance_records ar
LEFT JOIN public.schedules sch ON sch.id = ar.schedule_id
LEFT JOIN public.attendance_consumptions ac ON ac.attendance_record_id = ar.id;

GRANT SELECT ON public.v_attendance_funding_status TO authenticated;

-- ─── 3. v_reconciliation_candidates ──────────────────────────────────────────
-- Students who have both:
--   a) at least one unmatched slot-consuming attendance record
--   b) at least one active/historical enrollment with remaining capacity

CREATE OR REPLACE VIEW public.v_reconciliation_candidates AS
SELECT
  ua.student_id,
  COUNT(DISTINCT ua.attendance_record_id) AS unmatched_sessions,
  COUNT(DISTINCT se.id)                   AS eligible_enrollments,
  MIN(ua.session_date)                    AS earliest_unmatched,
  MAX(ua.session_date)                    AS latest_unmatched
FROM public.v_unmatched_attendance ua
JOIN public.student_enrollments se
  ON  se.student_id = ua.student_id
  AND se.enrolled_sessions > 0
  AND se.remaining_sessions > 0
  AND se.status IN ('ACTIVE', 'COMPLETED', 'TRANSFERRED', 'DROPPED', 'PAUSED')
GROUP BY ua.student_id;

GRANT SELECT ON public.v_reconciliation_candidates TO authenticated;

-- ─── 4. reconcile_student_attendance_sql ──────────────────────────────────────
-- SQL-side FIFO reconciler: mirrors the TypeScript logic in
-- modules/attendance/reconciliation.ts.
-- Callable from the admin recovery panel or directly via rpc().
--
-- Steps:
--   1. Collect unlinked slot-consuming attendance records for p_student_id
--      ordered by session_date ASC
--   2. Collect enrollments ordered FIFO with available capacity
--   3. Assign each unlinked record to the oldest eligible enrollment
--   4. Insert attendance_consumptions (ON CONFLICT DO NOTHING)
--   5. Recompute consumed_sessions via recompute_session_consumption()
--
-- Returns per-enrollment match counts.

CREATE OR REPLACE FUNCTION public.reconcile_student_attendance_sql(
  p_student_id UUID
)
RETURNS TABLE(enrollment_id UUID, sessions_matched INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec         RECORD;
  v_enr         RECORD;
  v_bucket_cap  INT;
  v_matched_enr UUID;
BEGIN
  -- Temporary store: (record_id, matched enrollment_id)
  CREATE TEMP TABLE IF NOT EXISTS _tmp_recon_assignments (
    attendance_record_id UUID,
    enrollment_id        UUID
  ) ON COMMIT DROP;

  TRUNCATE _tmp_recon_assignments;

  -- Unlinked records ordered by session_date ASC
  FOR v_rec IN (
    SELECT
      ar.id          AS record_id,
      COALESCE(sch.scheduled_at, ar.recorded_at) AS session_date
    FROM public.attendance_records ar
    LEFT JOIN public.schedules sch ON sch.id = ar.schedule_id
    WHERE ar.student_id = p_student_id
      AND ar.status IN ('present','absent','late','makeup','excused')
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance_consumptions ac
        WHERE ac.attendance_record_id = ar.id
      )
    ORDER BY COALESCE(sch.scheduled_at, ar.recorded_at) ASC, ar.id ASC
  ) LOOP
    v_matched_enr := NULL;

    -- Find oldest eligible enrollment with capacity
    FOR v_enr IN (
      SELECT
        se.id             AS enrollment_id,
        se.start_date,
        se.end_date,
        se.enrolled_sessions,
        se.consumed_sessions,
        -- Subtract already-assigned-in-this-run from capacity
        se.enrolled_sessions - se.consumed_sessions
          - COALESCE((
              SELECT COUNT(*)::INT
              FROM _tmp_recon_assignments ta
              WHERE ta.enrollment_id = se.id
            ), 0)         AS available
      FROM public.student_enrollments se
      WHERE se.student_id = p_student_id
        AND se.enrolled_sessions > 0
        AND se.status IN ('ACTIVE','COMPLETED','TRANSFERRED','DROPPED','CANCELLED','PAUSED')
      ORDER BY se.start_date ASC, se.created_at ASC
    ) LOOP
      -- Date eligibility + capacity check
      IF v_rec.session_date::date < v_enr.start_date THEN
        CONTINUE;
      END IF;
      IF v_enr.end_date IS NOT NULL AND v_rec.session_date::date > v_enr.end_date THEN
        CONTINUE;
      END IF;
      IF v_enr.available <= 0 THEN
        CONTINUE;
      END IF;

      v_matched_enr := v_enr.enrollment_id;
      EXIT;
    END LOOP;

    IF v_matched_enr IS NOT NULL THEN
      INSERT INTO _tmp_recon_assignments (attendance_record_id, enrollment_id)
      VALUES (v_rec.record_id, v_matched_enr);
    END IF;
  END LOOP;

  -- Persist matches to attendance_consumptions
  INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
  SELECT attendance_record_id, enrollment_id, p_student_id
  FROM _tmp_recon_assignments
  ON CONFLICT (attendance_record_id) DO NOTHING;

  -- Recompute consumed_sessions for affected enrollments
  PERFORM public.recompute_session_consumption(ta.enrollment_id)
  FROM (SELECT DISTINCT enrollment_id FROM _tmp_recon_assignments) ta;

  -- Return per-enrollment counts
  RETURN QUERY
  SELECT
    ta.enrollment_id,
    COUNT(*)::INT AS sessions_matched
  FROM _tmp_recon_assignments ta
  GROUP BY ta.enrollment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_student_attendance_sql(UUID) TO authenticated;

-- ─── 5. reconcile_all_unmatched_sql ──────────────────────────────────────────
-- Convenience wrapper: reconciles ALL students with unmatched sessions.
-- Safe to run repeatedly (idempotent).

CREATE OR REPLACE FUNCTION public.reconcile_all_unmatched_sql()
RETURNS TABLE(student_id UUID, sessions_matched INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student UUID;
BEGIN
  FOR v_student IN (
    SELECT DISTINCT ar.student_id
    FROM public.attendance_records ar
    WHERE ar.status IN ('present','absent','late','makeup','excused')
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance_consumptions ac
        WHERE ac.attendance_record_id = ar.id
      )
  ) LOOP
    RETURN QUERY
    SELECT
      v_student,
      COALESCE(SUM(r.sessions_matched)::INT, 0)
    FROM public.reconcile_student_attendance_sql(v_student) r;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_all_unmatched_sql() TO authenticated;

-- ─── 6. Additional performance indexes ───────────────────────────────────────

-- Fast lookup: "which attendance records for this student have no consumption?"
CREATE INDEX IF NOT EXISTS idx_att_records_student_status
  ON public.attendance_records(student_id, status);

-- Fast lookup: all consumptions for a given student
CREATE INDEX IF NOT EXISTS idx_consumptions_student_record
  ON public.attendance_consumptions(student_id, attendance_record_id);

-- Enrollment FIFO lookup by student + date
CREATE INDEX IF NOT EXISTS idx_enrollments_student_start_status
  ON public.student_enrollments(student_id, start_date ASC)
  WHERE enrolled_sessions > 0;

-- Schedules by branch (already used in TL branch-filtered attendance queries)
CREATE INDEX IF NOT EXISTS idx_schedules_branch_scheduled
  ON public.schedules(branch_id, scheduled_at DESC);

-- ─── 7. Add session_date column to attendance_records if missing ──────────────
-- Computed column (generated) reflecting the scheduled_at from the linked schedule.
-- Provides a stable column to index and query without always joining schedules.
-- NOTE: Only added if not already present (safe).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'attendance_records'
      AND column_name  = 'session_date'
  ) THEN
    -- session_date is stored redundantly for query convenience
    ALTER TABLE public.attendance_records
      ADD COLUMN session_date DATE;

    -- Backfill from schedules
    UPDATE public.attendance_records ar
    SET session_date = sch.scheduled_at::date
    FROM public.schedules sch
    WHERE sch.id = ar.schedule_id
      AND ar.session_date IS NULL;

    -- Index it
    CREATE INDEX IF NOT EXISTS idx_attendance_session_date
      ON public.attendance_records(student_id, session_date DESC);
  END IF;
END;
$$;

-- ─── 8. Trigger: auto-populate session_date on insert ─────────────────────────

CREATE OR REPLACE FUNCTION public.trg_attendance_session_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_date IS NULL AND NEW.schedule_id IS NOT NULL THEN
    SELECT scheduled_at::date INTO NEW.session_date
    FROM public.schedules
    WHERE id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_session_date ON public.attendance_records;
CREATE TRIGGER trg_set_session_date
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_attendance_session_date();

-- ─── 9. Refresh schema cache ──────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
