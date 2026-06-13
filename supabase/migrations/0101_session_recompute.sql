-- Migration 0101: recompute_schedule_consumptions()
--
-- Purpose: Given a schedule (session) ID, re-evaluate every non-invalidated
-- attendance record and ensure the attendance_consumptions ledger is correct:
--   • Adding entries for students now eligible (consuming status + active enrollment
--     whose window covers the session date)
--   • Removing entries for students no longer eligible (status changed to
--     non-consuming, or session date moved outside enrollment window)
--   • Recomputing student_enrollments.consumed_sessions for all affected rows.
--
-- Used by editGroupSessionAction after topic/date/status changes.
-- Safe to call at any time — fully idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.recompute_schedule_consumptions(
  p_schedule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_date        TIMESTAMPTZ;
  v_added               INT := 0;
  v_removed             INT := 0;
  v_recomputed          INT := 0;
  v_enroll_ids_affected UUID[];
  v_rec                 RECORD;
  v_enroll_id           UUID;
  v_rows                INT;
BEGIN
  -- Resolve session date
  SELECT scheduled_at INTO v_session_date
  FROM   public.schedules
  WHERE  id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recompute_schedule_consumptions: schedule % not found', p_schedule_id;
  END IF;

  v_enroll_ids_affected := ARRAY[]::UUID[];

  -- Iterate every non-invalidated attendance record for this session
  FOR v_rec IN
    SELECT ar.id AS rec_id, ar.student_id, ar.status
    FROM   public.attendance_records ar
    WHERE  ar.schedule_id    = p_schedule_id
      AND  ar.invalidated_at IS NULL
  LOOP

    IF v_rec.status IN ('present', 'absent', 'late', 'makeup', 'excused') THEN
      -- ── Consuming status ───────────────────────────────────────────────────
      -- Find the FIFO eligible enrollment: oldest active enrollment whose window
      -- covers the session date and is not open-ended (enrolled_sessions > 0).
      SELECT se.id INTO v_enroll_id
      FROM   public.student_enrollments se
      WHERE  se.student_id        = v_rec.student_id
        AND  se.status            = 'ACTIVE'
        AND  se.enrolled_sessions > 0
        AND  se.start_date::DATE <= v_session_date::DATE
        AND  (se.end_date IS NULL OR se.end_date::DATE >= v_session_date::DATE)
      ORDER  BY se.start_date ASC, se.created_at ASC
      LIMIT  1;

      IF FOUND THEN
        -- Eligible: ensure a consumption entry exists
        INSERT INTO public.attendance_consumptions
          (attendance_record_id, enrollment_id, student_id)
        VALUES
          (v_rec.rec_id, v_enroll_id, v_rec.student_id)
        ON CONFLICT (attendance_record_id) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_added := v_added + v_rows;
        IF v_rows > 0 THEN
          v_enroll_ids_affected := array_append(v_enroll_ids_affected, v_enroll_id);
        END IF;
      ELSE
        -- No eligible enrollment: remove any stale consumption
        SELECT enrollment_id INTO v_enroll_id
        FROM   public.attendance_consumptions
        WHERE  attendance_record_id = v_rec.rec_id;

        IF FOUND THEN
          v_enroll_ids_affected := array_append(v_enroll_ids_affected, v_enroll_id);
          DELETE FROM public.attendance_consumptions
          WHERE  attendance_record_id = v_rec.rec_id;
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          v_removed := v_removed + v_rows;
        END IF;
      END IF;

    ELSE
      -- ── Non-consuming status ───────────────────────────────────────────────
      -- Remove any existing consumption entry.
      SELECT enrollment_id INTO v_enroll_id
      FROM   public.attendance_consumptions
      WHERE  attendance_record_id = v_rec.rec_id;

      IF FOUND THEN
        v_enroll_ids_affected := array_append(v_enroll_ids_affected, v_enroll_id);
        DELETE FROM public.attendance_consumptions
        WHERE  attendance_record_id = v_rec.rec_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_removed := v_removed + v_rows;
      END IF;
    END IF;
  END LOOP;

  -- Recompute consumed_sessions for every affected enrollment
  IF array_length(v_enroll_ids_affected, 1) > 0 THEN
    UPDATE public.student_enrollments se
       SET consumed_sessions = (
             SELECT COUNT(*)::INT
             FROM   public.attendance_consumptions
             WHERE  enrollment_id = se.id
           )
     WHERE id = ANY(v_enroll_ids_affected);
    GET DIAGNOSTICS v_recomputed = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'schedule_id', p_schedule_id,
    'added',       v_added,
    'removed',     v_removed,
    'recomputed',  v_recomputed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_schedule_consumptions(UUID) TO authenticated;

-- Additional audit view: v_session_consumption_status
-- Per-session summary: how many records are consuming, non-consuming, unlinked.
-- Useful for debugging drift after edits.

CREATE OR REPLACE VIEW public.v_session_consumption_status AS
SELECT
  sch.id                                        AS schedule_id,
  sch.scheduled_at,
  sch.topic,
  sch.status                                    AS session_status,
  g.name                                        AS group_name,
  COUNT(ar.id)                                  AS total_records,
  COUNT(ar.id) FILTER (
    WHERE ar.status IN ('present','absent','late','makeup','excused')
  )                                             AS consuming_records,
  COUNT(ac.id)                                  AS consumption_entries,
  COUNT(ar.id) FILTER (
    WHERE ar.status IN ('present','absent','late','makeup','excused')
  ) - COUNT(ac.id)                              AS unlinked_consuming
FROM public.schedules     sch
JOIN public.group_courses gc  ON gc.id  = sch.group_course_id
JOIN public.groups        g   ON g.id   = gc.group_id
LEFT JOIN public.attendance_records   ar
  ON  ar.schedule_id    = sch.id
  AND ar.invalidated_at IS NULL
LEFT JOIN public.attendance_consumptions ac
  ON  ac.attendance_record_id = ar.id
GROUP BY sch.id, sch.scheduled_at, sch.topic, sch.status, g.name;

NOTIFY pgrst, 'reload schema';

COMMIT;
