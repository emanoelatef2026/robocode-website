-- PHASE 18: Canonical session numbering.
-- Every schedule row owns an immutable session_number assigned once on INSERT.
-- Rules:
--   * Assigned via trigger — survives edits, status changes, instructor changes.
--   * Cancelled/postponed sessions KEEP their number.
--   * Makeup sessions get their own number in the sequence + a makeup_of_session_nr pointer.
--   * No global reorder logic — numbers only ever increase within a group_course.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS session_number        INT,
  ADD COLUMN IF NOT EXISTS makeup_of_session_nr  INT;

-- Trigger function: assign next session_number within the group_course on INSERT.
-- Skipped if session_number is already set (allows manual overrides for retroactive inserts).
CREATE OR REPLACE FUNCTION public.assign_session_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.session_number IS NULL THEN
    SELECT COALESCE(MAX(session_number), 0) + 1
    INTO   NEW.session_number
    FROM   public.schedules
    WHERE  group_course_id = NEW.group_course_id
      AND  session_number  IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_session_number ON public.schedules;
CREATE TRIGGER trg_assign_session_number
  BEFORE INSERT ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.assign_session_number();

-- Safe idempotent backfill: number existing rows by (scheduled_at, created_at) within each group_course.
-- Starts from MAX(existing non-null session_number) + 1 so re-runs are safe.
DO $$
DECLARE
  gc_id  UUID;
  max_nr INT;
BEGIN
  FOR gc_id IN
    SELECT DISTINCT group_course_id
    FROM   public.schedules
    WHERE  session_number IS NULL
  LOOP
    SELECT COALESCE(MAX(session_number), 0)
    INTO   max_nr
    FROM   public.schedules
    WHERE  group_course_id = gc_id
      AND  session_number  IS NOT NULL;

    WITH ranked AS (
      SELECT id,
             max_nr + ROW_NUMBER() OVER (ORDER BY scheduled_at, created_at) AS rn
      FROM   public.schedules
      WHERE  group_course_id = gc_id
        AND  session_number  IS NULL
    )
    UPDATE public.schedules s
    SET    session_number = r.rn
    FROM   ranked r
    WHERE  s.id = r.id;
  END LOOP;
END;
$$;

-- Fast range lookups by session_number within a group_course.
CREATE INDEX IF NOT EXISTS idx_schedules_gc_session_nr
  ON public.schedules (group_course_id, session_number);
