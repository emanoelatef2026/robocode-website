-- ============================================================================
-- Fix: reconcile_student_attendance_sql fails with "column reference
-- enrollment_id is ambiguous" whenever it actually has unmatched attendance
-- to process. RETURNS TABLE(enrollment_id uuid, ...) implicitly declares an
-- `enrollment_id` OUT variable in the function body, which collides with the
-- `_tmp_recon_assignments.enrollment_id` column in bare (unqualified)
-- references. Never caught before because the function was reviewed but
-- never actually executed against real unmatched-attendance data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_student_attendance_sql(p_student_id uuid)
RETURNS TABLE(enrollment_id uuid, sessions_matched integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  -- (table alias required: bare `enrollment_id` is ambiguous with the
  -- RETURNS TABLE OUT parameter of the same name)
  INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
  SELECT ta.attendance_record_id, ta.enrollment_id, p_student_id
  FROM _tmp_recon_assignments ta
  ON CONFLICT (attendance_record_id) DO NOTHING;

  -- Recompute consumed_sessions for affected enrollments
  PERFORM public.recompute_session_consumption(x.enrollment_id)
  FROM (SELECT DISTINCT ta.enrollment_id FROM _tmp_recon_assignments ta) x;

  -- Return per-enrollment counts
  RETURN QUERY
  SELECT
    ta.enrollment_id,
    COUNT(*)::INT AS sessions_matched
  FROM _tmp_recon_assignments ta
  GROUP BY ta.enrollment_id;
END;
$function$;
