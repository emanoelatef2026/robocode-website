-- ============================================================
-- Sprint 33 — Super Admin Operating System
-- Run in Supabase SQL Editor (in order)
-- ============================================================

-- ── 1. Course Resource Center ────────────────────────────────────────────────
-- Adds resource fields to the courses table so instructors and admins
-- can attach Google Drive links, curriculum folders, and teaching notes.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS drive_url          TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder  TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes   TEXT,
  ADD COLUMN IF NOT EXISTS resource_links     JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.courses.drive_url         IS 'Google Drive folder or file URL for course materials';
COMMENT ON COLUMN public.courses.curriculum_folder IS 'Link to curriculum/lesson plan folder';
COMMENT ON COLUMN public.courses.instructor_notes  IS 'Teaching notes, prerequisites, tips for instructors';
COMMENT ON COLUMN public.courses.resource_links    IS 'Array of {label, url} resource link objects';

-- ── 2. Force PostgREST schema reload ────────────────────────────────────────
-- Required after adding columns so the REST layer sees the new schema.

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
--
-- WHAT TO EXECUTE IN SUPABASE:
-- 1. Open the Supabase project → SQL Editor
-- 2. Paste and run this entire file
-- 3. Verify with: SELECT column_name FROM information_schema.columns WHERE table_name = 'courses' AND column_name IN ('drive_url','curriculum_folder','instructor_notes','resource_links');
--
-- NOTE: No other schema changes are required for Sprint 33.
-- All new pages (leads, sessions, system-health, analytics, group health)
-- read from existing tables and require no new columns.
-- ============================================================
