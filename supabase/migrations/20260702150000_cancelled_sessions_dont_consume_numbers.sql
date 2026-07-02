-- Cancelled sessions must not consume a session_number slot going forward.
-- Previously MAX(session_number) counted cancelled rows too, so every
-- cancellation permanently pushed the group's numbering one slot past its
-- real total_sessions target — making the group/instructor look like they
-- picked up an extra session that was never actually delivered or planned.
-- Fix: exclude cancelled rows from the MAX() lookup so the next real session
-- reuses the freed slot. The cancelled row itself keeps its own number
-- (still visible in history) — only future INSERTs are affected.
CREATE OR REPLACE FUNCTION public.assign_session_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.session_number IS NULL THEN
    SELECT COALESCE(MAX(session_number), 0) + 1
    INTO   NEW.session_number
    FROM   public.schedules
    WHERE  group_course_id = NEW.group_course_id
      AND  session_number  IS NOT NULL
      AND  status          <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;
