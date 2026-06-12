-- Add per-instructor session allocation fields to group_instructors.
-- from_session: the session number this instructor starts from (1-based, defaults to 1).
-- allocated_sessions: how many sessions this instructor is assigned to teach (NULL = no cap).
ALTER TABLE public.group_instructors
  ADD COLUMN IF NOT EXISTS from_session       INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allocated_sessions INT;
