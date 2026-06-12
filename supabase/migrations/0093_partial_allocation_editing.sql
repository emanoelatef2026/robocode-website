-- PHASE 18.4: Partial allocation editing.
-- Adds highest_consumed_session to v_instructor_allocation_summary so the app
-- can distinguish unlocked / partially_locked / fully_locked state per allocation.
-- A "partially locked" allocation has consumed sessions 1..N but future sessions
-- N+1..to_session are still editable by TL/Admin.

CREATE OR REPLACE VIEW public.v_instructor_allocation_summary AS
SELECT
  gi.group_id,
  gi.instructor_id,
  gi.role,
  gi.from_session,
  gi.to_session,
  gi.allocated_sessions,
  gi.allocation_status,
  gi.assigned_at,
  gi.released_at,
  gi.handoff_notes,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules  s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id        = gi.group_id
      AND  s.session_number  >= gi.from_session
      AND  (gi.to_session IS NULL OR s.session_number <= gi.to_session)
      AND  s.status           = 'completed'
  ), 0) AS sessions_completed_in_range,
  -- Highest session number that has been historically consumed (completed) in this
  -- instructor's range.  0 means nothing consumed yet.
  COALESCE((
    SELECT MAX(s.session_number)
    FROM   public.schedules  s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id        = gi.group_id
      AND  s.session_number  >= gi.from_session
      AND  (gi.to_session IS NULL OR s.session_number <= gi.to_session)
      AND  s.status           = 'completed'
  ), 0) AS highest_consumed_session
FROM public.group_instructors gi;
