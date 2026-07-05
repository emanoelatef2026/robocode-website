-- ============================================================
-- Sprint 34 — Super Admin Academy Operating System
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Course Resource Center Expansion ─────────────────────────────────────
-- Additional fields for comprehensive course documentation

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS session_plans      TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide     TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes  TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered     TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites      TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap     TEXT;

COMMENT ON COLUMN public.courses.session_plans     IS 'How sessions are structured: duration, activities, flow';
COMMENT ON COLUMN public.courses.teaching_guide    IS 'Pedagogy notes, methodologies, classroom management tips';
COMMENT ON COLUMN public.courses.expected_outcomes IS 'What students will be able to do after completing this course';
COMMENT ON COLUMN public.courses.skills_covered    IS 'Skills, tools, and technologies taught (comma-separated or prose)';
COMMENT ON COLUMN public.courses.prerequisites     IS 'What students should know before starting this course';
COMMENT ON COLUMN public.courses.course_roadmap    IS 'Sequence of topics, milestones, and progression path';

-- ── 2. Force PostgREST schema reload ────────────────────────────────────────

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify course resource columns:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'courses'
--   AND column_name IN (
--     'drive_url','curriculum_folder','instructor_notes','resource_links',
--     'session_plans','teaching_guide','expected_outcomes',
--     'skills_covered','prerequisites','course_roadmap'
--   );
-- Expected: 10 rows

-- ============================================================
-- SPRINT 34 CHANGES SUMMARY (no other schema changes needed)
-- ============================================================
--
-- ALL NEW PAGES (no schema required):
--   /admin/team-leaders/[id]         — enable, archive, transfer lead ownership
--   /admin/team-leaders/[id]/performance — TL performance metrics
--   /admin/branches/[id]/performance  — Branch performance center
--   /admin/instructors/[id]           — Workload & health card added
--   /admin/system-health              — Expanded: 8 check sections
--   /admin/communications             — Parent message center
--   /admin/analytics                  — Added Groups + Courses performance tabs
--
-- NEW ACTIONS (use existing tables):
--   enableTeamLeader     — re-inserts user_roles rows (existing table)
--   archiveTeamLeader    — removes user_roles + updates metadata (existing)
--   transferTeamLeaderOwnership — updates leads.assigned_to + lead_timeline (existing)
--   getTeamLeaderResponsibilities — read-only query on existing tables
--
-- SCHEMA CHANGES (this file):
--   courses: 6 new TEXT columns (session_plans, teaching_guide,
--            expected_outcomes, skills_covered, prerequisites, course_roadmap)
--
-- SCHEMA CHANGES (Sprint 33 file — if not yet run):
--   courses: 4 new columns (drive_url, curriculum_folder,
--            instructor_notes, resource_links)
--   Run sprint33_super_admin_os.sql first.
--
-- ============================================================
-- END OF MIGRATION
-- ============================================================
