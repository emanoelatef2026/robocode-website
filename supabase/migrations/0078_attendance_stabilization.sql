-- Migration 0078: Attendance Stabilization — Ledger, Snapshots, Integrity
--
-- New model:
--   • attendance_consumptions — one row per attendance_record, enrollment_id attribution
--   • snapshot columns on attendance_records — group/course/instructor/branch at session time
--   • consume_attendance_sessions_batch() — idempotent real-time consumption
--   • recompute_session_consumption() — ledger-driven, deterministic repair
--   • Diagnostic views — v_enrollment_integrity, v_consumption_integrity,
--                         v_student_history_health
--   • Performance indexes
--
-- ADDITIVE ONLY. Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE throughout).

-- ─── 1. Snapshot columns on attendance_records ────────────────────────────────
-- Capture who taught what in which group at the moment attendance is recorded.
-- NULL on pre-migration rows (history falls back to live joins).

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS group_name_snapshot      TEXT,
  ADD COLUMN IF NOT EXISTS course_name_snapshot     TEXT,
  ADD COLUMN IF NOT EXISTS instructor_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS branch_name_snapshot     TEXT;

-- ─── 2. Consumption ledger ────────────────────────────────────────────────────
-- One row per attendance record. UNIQUE prevents double-consumption.
-- ON DELETE RESTRICT keeps financial history safe even if attendance is cleaned up.

CREATE TABLE IF NOT EXISTS public.attendance_consumptions (
  id                   UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE RESTRICT,
  enrollment_id        UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  student_id           UUID NOT NULL,
  consumed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_consumptions_record_unique UNIQUE (attendance_record_id)
);

CREATE INDEX IF NOT EXISTS idx_consumptions_enrollment_id
  ON public.attendance_consumptions(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_consumptions_student_id
  ON public.attendance_consumptions(student_id);

CREATE INDEX IF NOT EXISTS idx_consumptions_consumed_at
  ON public.attendance_consumptions(consumed_at);

-- RLS — service client writes; students/parents read their own
ALTER TABLE public.attendance_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "consumption_read_own_student"
  ON public.attendance_consumptions FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "consumption_read_own_parent"
  ON public.attendance_consumptions FOR SELECT
  USING (student_id IN (
    SELECT ps.student_id FROM public.parent_students ps
    JOIN public.parents p ON p.id = ps.parent_id
    WHERE p.user_id = auth.uid()
  ));

-- ─── 3. consume_attendance_sessions_batch ─────────────────────────────────────
-- Idempotent real-time consumption. Called after attendance_records are inserted.
-- Takes parallel arrays: record IDs, enrollment IDs, student IDs.
-- IF the ledger already has the record → skips (no double-count).

CREATE OR REPLACE FUNCTION public.consume_attendance_sessions_batch(
  p_record_ids     UUID[],
  p_enrollment_ids UUID[],
  p_student_ids    UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  i   INT;
  len INT;
BEGIN
  len := array_length(p_record_ids, 1);
  IF len IS NULL THEN RETURN; END IF;

  FOR i IN 1..len LOOP
    INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
    VALUES (p_record_ids[i], p_enrollment_ids[i], p_student_ids[i])
    ON CONFLICT (attendance_record_id) DO NOTHING;

    -- Only update the counter when the INSERT actually happened
    IF FOUND THEN
      -- remaining_sessions is a GENERATED column — only update consumed_sessions
      UPDATE public.student_enrollments
      SET consumed_sessions = consumed_sessions + 1
      WHERE id = p_enrollment_ids[i]
        AND status = 'ACTIVE';
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_attendance_sessions_batch(UUID[], UUID[], UUID[]) TO authenticated;

-- ─── 4. recompute_session_consumption (ledger-driven) ─────────────────────────
-- Source of truth: attendance_consumptions ledger, not attendance_records directly.
-- Deterministic: consumed_sessions = COUNT(*) FROM ledger WHERE enrollment_id = se.id.
-- No group/course dependency. No FIFO waterfall complexity — attribution already
-- happened at recording time.

CREATE OR REPLACE FUNCTION public.recompute_session_consumption(
  p_enrollment_id UUID DEFAULT NULL
)
RETURNS TABLE(enrollment_id UUID, old_consumed INT, new_consumed INT, fixed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  ledger_counts AS (
    SELECT ac.enrollment_id, COUNT(*)::INT AS ledger_count
    FROM public.attendance_consumptions ac
    GROUP BY ac.enrollment_id
  ),
  enrollment_state AS (
    SELECT
      se.id,
      se.consumed_sessions   AS old_val,
      COALESCE(lc.ledger_count, 0) AS new_val,
      se.enrolled_sessions
    FROM public.student_enrollments se
    LEFT JOIN ledger_counts lc ON lc.enrollment_id = se.id
    WHERE se.enrolled_sessions > 0
      AND (p_enrollment_id IS NULL OR se.id = p_enrollment_id)
  ),
  updated AS (
    UPDATE public.student_enrollments se
    SET consumed_sessions = es.new_val
    FROM enrollment_state es
    WHERE se.id = es.id
      AND es.old_val <> es.new_val
    RETURNING se.id
  )
  SELECT
    es.id               AS enrollment_id,
    es.old_val          AS old_consumed,
    es.new_val          AS new_consumed,
    (u.id IS NOT NULL)  AS fixed
  FROM enrollment_state es
  LEFT JOIN updated u ON u.id = es.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_session_consumption(UUID) TO authenticated;

-- ─── 5. Performance indexes ───────────────────────────────────────────────────

-- FIFO ordering: find oldest active enrollment per student quickly
CREATE INDEX IF NOT EXISTS idx_enrollments_student_fifo
  ON public.student_enrollments(student_id, start_date ASC, created_at ASC)
  WHERE status = 'ACTIVE';

-- Snapshot lookups on attendance
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_at
  ON public.attendance_records(recorded_at);

-- Student history: all attendance ordered by date
CREATE INDEX IF NOT EXISTS idx_attendance_student_recorded
  ON public.attendance_records(student_id, recorded_at DESC);

-- ─── 6. Backfill: snapshot columns on existing attendance_records ─────────────
-- Best-effort: joins back through schedules → group_courses → groups/courses/instructors.
-- Leaves NULL where data is unavailable.

UPDATE public.attendance_records ar
SET
  group_name_snapshot  = g.name,
  course_name_snapshot = c.title
FROM public.schedules sch
JOIN public.group_courses gc ON gc.id = sch.group_course_id
JOIN public.groups g          ON g.id  = gc.group_id
LEFT JOIN public.courses c    ON c.id  = gc.course_id
WHERE ar.schedule_id = sch.id
  AND ar.group_name_snapshot IS NULL;

-- ─── 7. Backfill: attendance_consumptions from existing attendance_records ─────
-- Uses FIFO waterfall: row-number within student partitioned by recorded_at
-- maps to enrollment bucket [cap_start, cap_end).
-- Skips records already in the ledger (ON CONFLICT DO NOTHING).

WITH
ranked_attendance AS (
  SELECT
    ar.id            AS attendance_record_id,
    ar.student_id,
    ar.recorded_at,
    ROW_NUMBER() OVER (
      PARTITION BY ar.student_id
      ORDER BY ar.recorded_at ASC, ar.id ASC
    ) AS rn
  FROM public.attendance_records ar
  WHERE NOT EXISTS (
    SELECT 1 FROM public.attendance_consumptions ac
    WHERE ac.attendance_record_id = ar.id
  )
),
enrollment_bounds AS (
  SELECT
    se.id         AS enrollment_id,
    se.student_id,
    se.enrolled_sessions,
    SUM(se.enrolled_sessions) OVER (
      PARTITION BY se.student_id
      ORDER BY se.start_date ASC, se.created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cap_end,
    COALESCE(SUM(se.enrolled_sessions) OVER (
      PARTITION BY se.student_id
      ORDER BY se.start_date ASC, se.created_at ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS cap_start
  FROM public.student_enrollments se
  WHERE se.enrolled_sessions > 0
    AND se.status IN ('ACTIVE', 'COMPLETED', 'TRANSFERRED', 'DROPPED', 'CANCELLED', 'PAUSED')
),
assignments AS (
  SELECT
    ra.attendance_record_id,
    eb.enrollment_id,
    ra.student_id
  FROM ranked_attendance ra
  JOIN enrollment_bounds eb ON eb.student_id = ra.student_id
    AND ra.rn >  eb.cap_start
    AND ra.rn <= eb.cap_end
)
INSERT INTO public.attendance_consumptions (attendance_record_id, enrollment_id, student_id)
SELECT attendance_record_id, enrollment_id, student_id
FROM   assignments
ON CONFLICT (attendance_record_id) DO NOTHING;

-- ─── 8. Reconcile consumed_sessions from ledger after backfill ────────────────

SELECT * FROM public.recompute_session_consumption();

-- ─── 9. Diagnostic views ──────────────────────────────────────────────────────

-- v_enrollment_integrity: enrollments where stored consumed ≠ ledger count
CREATE OR REPLACE VIEW public.v_enrollment_integrity AS
SELECT
  se.id                                   AS enrollment_id,
  se.student_id,
  se.status,
  se.enrolled_sessions,
  se.consumed_sessions                    AS stored_consumed,
  COALESCE(lc.ledger_count, 0)            AS ledger_consumed,
  se.consumed_sessions - COALESCE(lc.ledger_count, 0) AS drift,
  se.remaining_sessions
FROM public.student_enrollments se
LEFT JOIN (
  SELECT enrollment_id, COUNT(*)::INT AS ledger_count
  FROM public.attendance_consumptions
  GROUP BY enrollment_id
) lc ON lc.enrollment_id = se.id
WHERE se.enrolled_sessions > 0
  AND se.consumed_sessions <> COALESCE(lc.ledger_count, 0);

GRANT SELECT ON public.v_enrollment_integrity TO authenticated;

-- v_consumption_integrity: attendance records missing a ledger entry
CREATE OR REPLACE VIEW public.v_consumption_integrity AS
SELECT
  ar.id             AS attendance_record_id,
  ar.student_id,
  ar.schedule_id,
  ar.status,
  ar.recorded_at,
  ac.enrollment_id,
  CASE WHEN ac.id IS NULL THEN 'MISSING' ELSE 'OK' END AS ledger_state
FROM public.attendance_records ar
LEFT JOIN public.attendance_consumptions ac ON ac.attendance_record_id = ar.id;

GRANT SELECT ON public.v_consumption_integrity TO authenticated;

-- v_student_history_health: per-student session accounting summary
CREATE OR REPLACE VIEW public.v_student_history_health AS
SELECT
  ar.student_id,
  COUNT(ar.id)                                         AS total_attendance_records,
  COUNT(ac.id)                                         AS ledger_entries,
  COUNT(ar.id) - COUNT(ac.id)                          AS missing_ledger_entries,
  COALESCE(SUM(se.enrolled_sessions), 0)               AS total_enrolled_sessions,
  COALESCE(SUM(se.consumed_sessions), 0)               AS total_consumed_sessions,
  COUNT(ar.id) FILTER (WHERE ar.status = 'present')    AS present_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'absent')     AS absent_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'late')       AS late_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'makeup')     AS makeup_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'excused')    AS excused_count
FROM public.attendance_records ar
LEFT JOIN public.attendance_consumptions ac ON ac.attendance_record_id = ar.id
LEFT JOIN public.student_enrollments se
  ON se.student_id = ar.student_id AND se.enrolled_sessions > 0
GROUP BY ar.student_id;

GRANT SELECT ON public.v_student_history_health TO authenticated;

-- ─── 10. Refresh schema cache ──────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
