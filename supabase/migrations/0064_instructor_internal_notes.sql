-- Migration 0064: Add internal_notes column to instructors
-- This column was referenced in modal-actions.ts and operational.ts
-- but was never added to the schema, causing getInstructorDetailData to fail.

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;
