-- Migration 0058: courses — resource center fields
--
-- These columns are referenced in modules/courses/types.ts, queries.ts, and
-- actions.ts but were never created via a migration file. This caused
-- "Could not find column in schema cache" errors and silent insert failures.
--
-- 100 % IDEMPOTENT: every statement uses ADD COLUMN IF NOT EXISTS.
-- Safe to run against any database state (new install, or already patched).

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS drive_url         TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes  TEXT,
  ADD COLUMN IF NOT EXISTS session_plans     TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide    TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered    TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites     TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap    TEXT,
  ADD COLUMN IF NOT EXISTS resource_links    JSONB;

-- Reload PostgREST schema cache so new columns are immediately visible.
NOTIFY pgrst, 'reload schema';
