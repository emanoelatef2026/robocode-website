-- Migration: 0029_assignment_schedule_link
-- Purpose: Link assignments to the session in which they were assigned
-- Dependencies: 0007_schedule_attendance, 0008_assessments
--
-- Changes:
--   assignments.schedule_id  UUID  nullable FK → schedules(id)
--
-- Design notes:
--   * Nullable — assignments that belong to a lesson or module without a specific
--     session remain valid (the existing lesson_id / module_id parent is unchanged).
--   * ON DELETE SET NULL — if a schedule is cancelled and removed, the assignment
--     keeps existing but loses its session context.
--   * The existing CHECK constraint (lesson_id XOR module_id) is unchanged;
--     schedule_id is an independent, optional context pointer.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS schedule_id UUID
    REFERENCES public.schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.assignments.schedule_id IS
  'Optional: the session in which this assignment was given. '
  'NULL means the assignment is not tied to a specific class session.';

-- Index: most queries that filter by schedule will also filter by deleted_at
CREATE INDEX IF NOT EXISTS idx_assignments_schedule_id
  ON public.assignments(schedule_id)
  WHERE schedule_id IS NOT NULL AND deleted_at IS NULL;
