-- ============================================================
-- Super Admin OS — Consolidated Migration (Sprints 33 + 34 + 34b)
-- Supersedes: sprint33_super_admin_os.sql
--             sprint34_super_admin_complete.sql
--             sprint34b_finalization.sql
-- Run once in Supabase SQL Editor on a clean database.
-- Safe to run repeatedly: all statements use IF NOT EXISTS.
-- ============================================================

-- ── 1. Course Resource Center (Sprint 33) ────────────────────────────────────
-- Enables admins and instructors to attach learning materials to courses.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS drive_url          TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_folder  TEXT,
  ADD COLUMN IF NOT EXISTS instructor_notes   TEXT,
  ADD COLUMN IF NOT EXISTS resource_links     JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.courses.drive_url         IS 'Google Drive folder or file URL for course materials';
COMMENT ON COLUMN public.courses.curriculum_folder IS 'Link to curriculum / lesson plan folder';
COMMENT ON COLUMN public.courses.instructor_notes  IS 'Teaching notes, prerequisites, tips for instructors';
COMMENT ON COLUMN public.courses.resource_links    IS 'Array of {label, url} resource link objects';

-- ── 2. Course Documentation Expansion (Sprint 34) ────────────────────────────
-- Full pedagogical documentation layer on each course.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS session_plans      TEXT,
  ADD COLUMN IF NOT EXISTS teaching_guide     TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcomes  TEXT,
  ADD COLUMN IF NOT EXISTS skills_covered     TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites      TEXT,
  ADD COLUMN IF NOT EXISTS course_roadmap     TEXT;

COMMENT ON COLUMN public.courses.session_plans     IS 'How sessions are structured: duration, activities, flow';
COMMENT ON COLUMN public.courses.teaching_guide    IS 'Pedagogy notes, methodologies, classroom management tips';
COMMENT ON COLUMN public.courses.expected_outcomes IS 'What students can do after completing this course';
COMMENT ON COLUMN public.courses.skills_covered    IS 'Skills, tools, and technologies taught';
COMMENT ON COLUMN public.courses.prerequisites     IS 'What students should know before starting';
COMMENT ON COLUMN public.courses.course_roadmap    IS 'Sequence of topics, milestones, and progression path';

-- ── 3. Studio CMS Fix ────────────────────────────────────────────────────────
-- Adds columns used by the Studio CMS that were missing from earlier migrations.

ALTER TABLE public.student_projects
  ADD COLUMN IF NOT EXISTS technologies TEXT[],
  ADD COLUMN IF NOT EXISTS difficulty   TEXT,
  ADD COLUMN IF NOT EXISTS age_group    TEXT,
  ADD COLUMN IF NOT EXISTS featured     BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Force PostgREST schema reload ─────────────────────────────────────────

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Course resource columns (expect 10 rows):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'courses'
--   AND column_name IN (
--     'drive_url','curriculum_folder','instructor_notes','resource_links',
--     'session_plans','teaching_guide','expected_outcomes',
--     'skills_covered','prerequisites','course_roadmap'
--   );

-- Studio project columns (expect 4 rows):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'student_projects'
--   AND column_name IN ('technologies','difficulty','age_group','featured');

-- ============================================================
-- SPRINT 33+34+34b SCOPE SUMMARY
-- ============================================================
--
-- SCHEMA CHANGES (this file):
--   courses:          10 new columns — resource center + course docs
--   student_projects:  4 new columns — Studio CMS fix
--
-- NO SCHEMA CHANGES for 34b: all pages query existing tables.
--
-- NEW PAGES / ROUTES:
--   /admin                              Executive command center
--   /admin/analytics                    5-domain analytics (academic, groups, courses,
--                                       operations, marketing, instructors, branches, revenue)
--   /admin/system-health                8-section gap detector
--   /admin/production-readiness         PASS/WARN/FAIL readiness audit
--   /admin/communications               Parent message center
--   /admin/sessions                     Redirect → /admin/attendance
--   /admin/attendance                   Sessions Monitor (observe-only)
--   /admin/assignments                  Assignment Intelligence Center (observe-only)
--   /admin/leads                        Full CRM list + mini-funnel
--   /admin/leads/[id]                   Lead detail
--   /admin/leads/funnel                 Lead → Student conversion funnel
--   /admin/team-leaders/[id]            Enable / archive / delete / transfer leads
--   /admin/team-leaders/[id]/performance TL performance metrics
--   /admin/branches/[id]/performance    Branch performance center
--   /admin/instructors/[id]             Workload & health card
--   /admin/groups/[id]                  Group health card added
--   /admin/courses/[id]                 Course resource center added
--
-- KEY ACTIONS ADDED (use existing tables):
--   enableTeamLeader, archiveTeamLeader, deleteTeamLeader
--   transferTeamLeaderOwnership
--   getCourseResources, updateCourseResources
--
-- ROLE BOUNDARIES ENFORCED:
--   Super Admin does NOT record attendance (Sessions Monitor = observe only)
--   Super Admin does NOT create assignments (Assignment Intelligence = observe only)
--
-- BUILD STATUS: 0 TypeScript errors
-- ============================================================
-- END OF MIGRATION
-- ============================================================
