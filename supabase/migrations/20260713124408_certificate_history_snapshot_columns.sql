-- Migration: 20260713124408_certificate_history_snapshot_columns
-- Purpose: Phase 0 of the Group/Cohort Academic Lifecycle feature — schema
--          only, closing the gap noted in docs/DOMAIN_RULES.md #6.
--
-- Today, certificates display course_title and semester_name via a live join
-- (modules/certificates/queries.ts: courses!certificates_course_id_fkey(title),
-- semesters!certificates_semester_id_fkey(name)). Renaming a course or
-- semester later silently rewrites the text on a certificate issued months or
-- years ago. This migration adds nullable snapshot columns to allow freezing
-- that text at issuance time.
--
-- Explicitly NOT in this migration:
--   * No backfill from the existing live joins.
--   * No change to certificate generation/query logic — queries.ts keeps
--     reading the live join exactly as it does today.
--   * No trigger, no NOT NULL constraint, no default.

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS course_title_snapshot   TEXT,
  ADD COLUMN IF NOT EXISTS semester_name_snapshot   TEXT;

COMMENT ON COLUMN public.certificates.course_title_snapshot IS
  'Immutable copy of courses.title at issuance time. Nullable, not yet populated or read by app code. See docs/DOMAIN_RULES.md #6.';
COMMENT ON COLUMN public.certificates.semester_name_snapshot IS
  'Immutable copy of semesters.name at issuance time. Nullable, not yet populated or read by app code. See docs/DOMAIN_RULES.md #6.';
