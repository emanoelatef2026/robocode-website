-- Migration 0072: Ensure all course resource columns exist
-- These columns were applied directly to the production DB in earlier sprints
-- but never captured in a migration file. This migration is fully idempotent.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS drive_url         TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes  TEXT,
  ADD COLUMN IF NOT EXISTS resource_links    JSONB,
  ADD COLUMN IF NOT EXISTS session_plans     TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide    TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered    TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites     TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap    TEXT;
