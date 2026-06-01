-- ============================================================
-- Studio CMS Schema Fix
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns to student_projects
--    (Studio CMS uses these but they were never migrated)
-- ============================================================
ALTER TABLE public.student_projects
  ADD COLUMN IF NOT EXISTS technologies TEXT[],
  ADD COLUMN IF NOT EXISTS difficulty   TEXT,
  ADD COLUMN IF NOT EXISTS age_group    TEXT,
  ADD COLUMN IF NOT EXISTS featured     BOOLEAN NOT NULL DEFAULT false;

-- 2. Force PostgREST to reload its schema cache
--    This fixes PGRST204 and 42703 errors for columns that exist
--    in PostgreSQL but are unknown to the REST layer:
--    - featured_students.achievement_title
--    - featured_students.achievement_description
--    - student_projects.sort_order
-- ============================================================
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
