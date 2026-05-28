-- Migration: 0035_enrollment_type
-- Adds enrollment_type to group_students.
-- primary: the student's main group for a semester
-- secondary: makeup sessions, workshop add-ons, or supplementary groups

ALTER TABLE public.group_students
  ADD COLUMN IF NOT EXISTS enrollment_type TEXT NOT NULL DEFAULT 'primary'
  CONSTRAINT group_students_enrollment_type_check
  CHECK (enrollment_type IN ('primary', 'secondary'));
