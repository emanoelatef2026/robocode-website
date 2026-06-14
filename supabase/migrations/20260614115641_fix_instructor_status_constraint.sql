-- Fix: instructors_status_check constraint was missing 'deleted'
-- Migration 0065 was recorded but the DDL did not apply to the live database.
-- This migration re-applies the correct constraint.

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.instructors'::regclass
    AND contype   = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.instructors DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;

ALTER TABLE public.instructors
  ADD CONSTRAINT instructors_status_check
    CHECK (status IN ('active', 'inactive', 'on_leave', 'deleted'));
