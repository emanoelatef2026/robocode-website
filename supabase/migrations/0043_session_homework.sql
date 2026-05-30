-- Migration: 0043_session_homework
-- Purpose: Allow homework assignments to be created directly for a session
--          without requiring a course module or lesson.
--
-- Background: Sprint 22 removed the requirement for course modules from the
-- group activation flow. Groups can now be active with only a Course assigned.
-- Previously, the assignment_has_parent constraint required every assignment to
-- have either lesson_id or module_id, making it impossible to create homework
-- in the session workflow without legacy curriculum content.
--
-- Changes:
--   Drops assignment_has_parent CHECK constraint and replaces it with a relaxed
--   version that allows a third valid state:
--     lesson_id IS NULL AND module_id IS NULL AND schedule_id IS NOT NULL
--   (session-only assignment — no curriculum parent required)
--
-- Backward compat: all existing assignments remain valid under the new constraint.
--   • lesson-owned  (lesson_id IS NOT NULL, module_id IS NULL) ✓
--   • module-owned  (lesson_id IS NULL, module_id IS NOT NULL) ✓
--   • session-only  (lesson_id IS NULL, module_id IS NULL, schedule_id IS NOT NULL) ← NEW

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignment_has_parent;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignment_has_parent CHECK (
    -- Legacy: assignment owned by a lesson
    (lesson_id IS NOT NULL AND module_id IS NULL)
    -- Legacy: assignment owned by a course module (may also carry schedule_id)
    OR (lesson_id IS NULL AND module_id IS NOT NULL)
    -- New: assignment created directly for a session (no module or lesson parent)
    OR (lesson_id IS NULL AND module_id IS NULL AND schedule_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT assignment_has_parent ON public.assignments IS
  'Ensures every assignment has at least one parent context: '
  'a lesson, a course module, or a session (schedule). '
  'Session-only assignments are created by instructors during the session workflow '
  'for groups that have no course modules defined.';
