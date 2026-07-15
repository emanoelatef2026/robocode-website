-- Sprint 1 — finish 0054_schema_reconciliation.sql, which added enrollment_id
-- and a partial unique index on it, but never actually dropped the legacy
-- UNIQUE(student_id) constraint. Confirmed live: 134/134 students each had
-- at most 1 account, and the one student with 2 concurrent active
-- enrollments had exactly 1 account (linked to only one enrollment) because
-- this constraint physically blocked a second row.
-- Applied via mcp apply_migration; registered as version 20260715070334.

ALTER TABLE public.student_financial_accounts
  DROP CONSTRAINT student_financial_accounts_student_id_key;

-- Legacy accounts with no enrollment_id link stay capped at one per student
-- (this partial unique index did not exist live, only uq_sfa_enrollment_id did).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sfa_unique_student_no_enrollment
  ON public.student_financial_accounts(student_id)
  WHERE enrollment_id IS NULL;
