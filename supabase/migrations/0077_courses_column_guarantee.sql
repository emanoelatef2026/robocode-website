-- Migration 0077: Courses — definitive column guarantee + forced schema cache reload
--
-- This migration is a final safety-net pass that ensures every column referenced
-- by modules/courses/queries.ts and modules/courses/actions.ts exists in the DB
-- AND that PostgREST's schema cache is refreshed.
--
-- Root cause addressed: prior migrations (0049, 0058, 0072, 0073) added these
-- columns but the PostgREST schema cache was not always refreshed reliably.
-- Any "Could not find column ... in schema cache" error is fixed by running this.
--
-- 100% IDEMPOTENT — every statement uses IF NOT EXISTS / IF EXISTS guards.
-- Safe on: fresh DB, partially migrated DB, fully migrated DB.

BEGIN;

-- ── Core columns (migration 0006 baseline) ───────────────────────────────────
-- Include here so a bare restore from dump still works.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS code            TEXT,
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS level           TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
  ADD COLUMN IF NOT EXISTS thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS scope           TEXT    NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS is_published    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by      UUID,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- ── Academic asset columns (migration 0049) ───────────────────────────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS resources_url          TEXT,
  ADD COLUMN IF NOT EXISTS syllabus_url           TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_url         TEXT,
  ADD COLUMN IF NOT EXISTS homework_drive_url     TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url            TEXT,
  ADD COLUMN IF NOT EXISTS preparation_notes      TEXT,
  ADD COLUMN IF NOT EXISTS ai_tools_used          TEXT,
  ADD COLUMN IF NOT EXISTS recommended_age        TEXT,
  ADD COLUMN IF NOT EXISTS prerequisite_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- ── Resource center columns (migrations 0058 / 0072 / 0073) ──────────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS drive_url          TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder  TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes   TEXT,
  ADD COLUMN IF NOT EXISTS resource_links     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS session_plans      TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide     TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes  TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered     TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites      TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap     TEXT;

-- ── group_courses.total_sessions (referenced by academic config) ──────────────

ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER;

-- ── Performance indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_courses_deleted_at
  ON public.courses (deleted_at);

CREATE INDEX IF NOT EXISTS idx_courses_is_published
  ON public.courses (is_published)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_courses_scope
  ON public.courses (scope)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_courses_created_by
  ON public.courses (created_by)
  WHERE deleted_at IS NULL;

-- ── Force PostgREST schema cache reload ───────────────────────────────────────
-- Send NOTIFY twice with a pg_sleep in between to maximise the chance that
-- PostgREST's background listener receives the signal even under heavy load.

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Second notify after transaction commit (PostgREST listens post-commit)
NOTIFY pgrst, 'reload schema';
