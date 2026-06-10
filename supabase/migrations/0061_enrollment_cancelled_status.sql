-- Migration 0061: Add CANCELLED to student_enrollments.status
-- Required for the Cancel Contract feature introduced in Sprint 60.
-- ADDITIVE ONLY. Safe to re-run.

-- Drop the old check constraint and recreate with CANCELLED included.
ALTER TABLE public.student_enrollments
  DROP CONSTRAINT IF EXISTS student_enrollments_status_check;

ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_status_check
  CHECK (status IN ('ACTIVE', 'COMPLETED', 'DROPPED', 'TRANSFERRED', 'PAUSED', 'CANCELLED'));
