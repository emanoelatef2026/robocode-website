-- Phase 18.1: Backfill to_session for existing open-ended allocations.
-- For any group_instructors row where to_session IS NULL, set to_session
-- and allocated_sessions from the group's active group_course total_sessions.
-- This brings all pre-Phase-18 rows into the immutable range model.

UPDATE public.group_instructors gi
SET
  to_session         = gc.total_sessions,
  allocated_sessions = COALESCE(gi.allocated_sessions, gc.total_sessions)
FROM public.group_courses gc
WHERE gc.group_id        = gi.group_id
  AND gc.status          = 'active'
  AND gi.to_session      IS NULL
  AND gc.total_sessions  IS NOT NULL;
