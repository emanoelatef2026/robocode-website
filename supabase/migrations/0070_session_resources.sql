-- Migration: 0035_session_resources
-- Purpose: Add resource links storage to schedules for instructor-shared materials
-- Dependencies: 0007_schedule_attendance
--
-- Changes:
--   schedules.resources_links  JSONB  — array of {title, url} objects
--
-- Format: [{"title": "Slides", "url": "https://..."}, ...]
-- Nullable. Defaults to empty array on insert via application layer.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS resources_links JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.schedules.resources_links IS
  'Array of resource links shared for this session. '
  'Format: [{title: string, url: string}]. '
  'Visible to instructors; future releases may expose to students/parents.';
