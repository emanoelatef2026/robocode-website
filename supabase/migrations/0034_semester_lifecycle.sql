-- Migration: 0034_semester_lifecycle
-- Adds target_sessions / completed_sessions tracking to groups.
-- A trigger keeps completed_sessions in sync as schedule statuses change.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS target_sessions    INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS completed_sessions INTEGER NOT NULL DEFAULT 0;

-- Backfill completed_sessions from existing completed schedules
UPDATE public.groups g
SET completed_sessions = (
  SELECT COALESCE(COUNT(*), 0)
  FROM public.schedules s
  JOIN public.group_courses gc ON gc.id = s.group_course_id
  WHERE gc.group_id = g.id
    AND s.status = 'completed'
);

-- ── Trigger: keep completed_sessions accurate ─────────────────────────────────

CREATE OR REPLACE FUNCTION manage_group_completed_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.group_courses
  WHERE id = COALESCE(NEW.group_course_id, OLD.group_course_id);

  IF v_group_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.groups
        SET completed_sessions = completed_sessions + 1
        WHERE id = v_group_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
      UPDATE public.groups
        SET completed_sessions = completed_sessions + 1
        WHERE id = v_group_id;
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      UPDATE public.groups
        SET completed_sessions = GREATEST(0, completed_sessions - 1)
        WHERE id = v_group_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' THEN
      UPDATE public.groups
        SET completed_sessions = GREATEST(0, completed_sessions - 1)
        WHERE id = v_group_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_group_completed_sessions ON public.schedules;
CREATE TRIGGER trg_group_completed_sessions
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION manage_group_completed_sessions();
