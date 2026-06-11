-- Migration 0073: Courses table — stable column guarantee + schema cache reload
--
-- Guarantees every column referenced by modules/courses/queries.ts and
-- modules/courses/actions.ts exists before the app queries them.
--
-- 100 % IDEMPOTENT — every statement uses ADD COLUMN IF NOT EXISTS.
-- Safe to run on a fresh DB or one already patched by 0049/0058/0072.

ALTER TABLE public.courses
  -- Core (0006) — already exist; included for absolute safety on restore scenarios
  ADD COLUMN IF NOT EXISTS code              TEXT,
  -- Resource center (0058 / 0072)
  ADD COLUMN IF NOT EXISTS drive_url         TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes  TEXT,
  ADD COLUMN IF NOT EXISTS resource_links    JSONB,
  ADD COLUMN IF NOT EXISTS session_plans     TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide    TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered    TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites     TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap    TEXT,
  -- Academic asset fields (0049)
  ADD COLUMN IF NOT EXISTS syllabus_url           TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_url         TEXT,
  ADD COLUMN IF NOT EXISTS homework_drive_url     TEXT,
  ADD COLUMN IF NOT EXISTS resources_url          TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url            TEXT,
  ADD COLUMN IF NOT EXISTS preparation_notes      TEXT,
  ADD COLUMN IF NOT EXISTS ai_tools_used          TEXT,
  ADD COLUMN IF NOT EXISTS recommended_age        TEXT,
  ADD COLUMN IF NOT EXISTS prerequisite_course_id UUID REFERENCES public.courses(id);

-- Ensure group_courses has total_sessions (referenced in saveGroupAcademicConfig)
ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER;

-- Reload PostgREST schema cache — makes all new columns immediately usable
NOTIFY pgrst, 'reload schema';
