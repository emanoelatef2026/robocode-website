-- Sprint 21.7: Course Semester (Module) tracking on group_courses
--
-- Strategy: Option A — keep course_modules table as-is, rename at UI layer only.
-- No data migration needed. UI replaces "Module" with "Semester" everywhere.
--
-- Only schema change: add course_module_id to group_courses so each group
-- can be associated with a specific Semester (module) of its course.
-- This drives:
--   - AcademicConfigCard cascade selector (Course → Semester)
--   - Session progress showing "Semester X, Session N/Total"

ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS course_module_id UUID
    REFERENCES public.course_modules(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.group_courses.course_module_id IS
  'The specific course semester (course_modules row) this group is currently studying. '
  'NULL = whole course / semester not yet selected.';

CREATE INDEX IF NOT EXISTS idx_group_courses_module_id
  ON public.group_courses(course_module_id)
  WHERE course_module_id IS NOT NULL;
