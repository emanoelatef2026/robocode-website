-- Migration: 0031_certificate_consolidation
-- Purpose: Fix broken FK on semester_enrollments.certificate_id
-- Dependencies: 0020_semesters, 0024_certificate_system
--
-- Problem:
--   Migration 0020 created semester_enrollments.certificate_id as a FK pointing
--   to public.student_certificates(id) — the legacy certificate table from 0018.
--   All application code (modules/certificates/*, student portal, parent portal,
--   verification page) exclusively uses the public.certificates table from 0024.
--   The two tables have incompatible schemas and the old reference is broken.
--
-- Fix:
--   1. Clear any stale certificate_id values (column has never been populated
--      in production; the FK was a forward-reference placeholder).
--   2. Drop the FK constraint to student_certificates.
--   3. Add a corrected FK to the active certificates table.
--
-- student_certificates (0018) is NOT dropped — it holds no data and is harmless,
-- but removing a table is irreversible. Mark it deprecated instead.

-- ─── 1. Clear stale references ────────────────────────────────────────────────
-- Safe: this column was never written by application code (the old system was
-- never wired up). All existing rows have certificate_id = NULL.

UPDATE public.semester_enrollments
  SET certificate_id = NULL
  WHERE certificate_id IS NOT NULL;

-- ─── 2. Drop the broken FK ────────────────────────────────────────────────────
-- Postgres names inline FK constraints as <table>_<column>_fkey by convention.
-- Use a DO block for safety in case the name differs on an older install.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  -- Find the FK constraint on semester_enrollments.certificate_id that points
  -- to student_certificates (not to certificates).
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class      t ON t.oid = c.conrelid
  JOIN pg_class      f ON f.oid = c.confrelid
  WHERE t.relname = 'semester_enrollments'
    AND c.contype  = 'f'
    AND f.relname  = 'student_certificates'
    AND c.conkey   = (
      SELECT ARRAY[attnum]
      FROM pg_attribute
      WHERE attrelid = t.oid AND attname = 'certificate_id'
    );

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.semester_enrollments DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- ─── 3. Add corrected FK → public.certificates ────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class f ON f.oid = c.confrelid
    WHERE t.relname = 'semester_enrollments'
      AND c.contype  = 'f'
      AND f.relname  = 'certificates'
      AND c.conkey   = (
        SELECT ARRAY[attnum]
        FROM pg_attribute
        WHERE attrelid = t.oid AND attname = 'certificate_id'
      )
  ) THEN
    ALTER TABLE public.semester_enrollments
      ADD CONSTRAINT semester_enrollments_certificate_id_fkey
      FOREIGN KEY (certificate_id)
      REFERENCES public.certificates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 4. Deprecation notice on the legacy table ────────────────────────────────

COMMENT ON TABLE public.student_certificates IS
  'DEPRECATED — superseded by public.certificates (migration 0024). '
  'Do not write to this table. Retained for schema history only. '
  'Will be dropped in a future cleanup migration once confirmed empty.';
