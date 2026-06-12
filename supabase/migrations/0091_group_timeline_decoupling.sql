-- Migration 0091: Group Timeline Decoupling (Phase 18.5)
--
-- Decouples group academic timelines from course defaults.
-- Courses become recommendation-only templates; groups own their real session plans.
--
-- Changes:
--   1. courses.recommended_sessions  — advisory hint, not authoritative
--   2. group_courses.total_sessions  — drop NOT NULL + DEFAULT 24 (TL must set explicitly)
--   3. group_courses.open_ended      — flag for clubs/mentorship with no fixed session count
--
-- Migration is 100% IDEMPOTENT (IF NOT EXISTS / IF EXISTS guards throughout).
-- Existing rows keep their current total_sessions value; no data is overwritten.

BEGIN;

-- ── 1. Add recommended_sessions to courses (template hint only) ───────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS recommended_sessions INTEGER;

-- ── 2. Remove the forced DEFAULT 24 from group_courses.total_sessions ─────────
--    After this, new rows inserted without specifying total_sessions will get NULL.
--    Existing rows are untouched — they already have their values.
DO $$
BEGIN
  -- Drop the column default if it still exists (idempotent)
  ALTER TABLE public.group_courses ALTER COLUMN total_sessions DROP DEFAULT;
EXCEPTION WHEN undefined_object THEN
  NULL; -- column has no default, that's fine
END;
$$;

-- Allow NULL: open-ended groups and groups whose TL hasn't set a plan yet
DO $$
BEGIN
  ALTER TABLE public.group_courses ALTER COLUMN total_sessions DROP NOT NULL;
EXCEPTION WHEN undefined_object THEN
  NULL; -- column already nullable
END;
$$;

-- ── 3. Add open_ended flag ────────────────────────────────────────────────────
--    open_ended = TRUE means no fixed session ceiling (clubs, mentorship, etc.)
--    Allocation validation skips the upper-bound check for open-ended groups.
ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS open_ended BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. Index for fast open-ended lookups ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_courses_open_ended
  ON public.group_courses (group_id)
  WHERE open_ended = TRUE;

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;
