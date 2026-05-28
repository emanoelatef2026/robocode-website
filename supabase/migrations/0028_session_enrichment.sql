-- Migration: 0028_session_enrichment
-- Purpose: Enrich schedules with session content fields
-- Dependencies: 0007_schedule_attendance
--
-- Changes:
--   schedules.topic  TEXT  — what was covered in this session (set by instructor)
--   schedules.notes  TEXT  — instructor post-session observations (visible to team leader)
--
-- Both columns are nullable so existing rows are unaffected.
-- No RLS change required — schedules_manage already covers writes.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.schedules.topic IS
  'Subject or topic covered in this session. Set by the instructor after the class.';

COMMENT ON COLUMN public.schedules.notes IS
  'Instructor post-session notes visible to team leaders and admins. '
  'Not shown to students or parents.';
