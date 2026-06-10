-- Migration 0065: Add 'deleted' to instructors.status CHECK constraint
-- Required for the soft-delete (permanent delete) flow that uses status='deleted'
-- to distinguish from archived instructors (status='inactive').

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
