-- Migration: 20260714131000_fix_missing_renewal_of_column
-- Root-cause fix for a real bug discovered during Phase 2 production
-- acceptance QA: migration 0054_schema_reconciliation.sql declared
-- `student_enrollments.renewal_of` inside a `CREATE TABLE IF NOT EXISTS`
-- statement. Since student_enrollments already existed on the live project
-- (under a different, earlier ad-hoc shape — confirmed via information_schema:
-- live columns include expected_sessions/attendance_count/
-- completion_percentage/pricing_plan/transferred_to, none of which 0054
-- declares, proving the live table predates and diverges from 0054's
-- definition), that CREATE TABLE was a no-op and renewal_of was never
-- actually added. Every "renewal_of is dormant since Phase 0" claim in
-- docs/DOMAIN_RULES.md and docs/GROUP_SERIES_RULES.md was accurate in the
-- sense that nothing wrote to it — but the column didn't even exist to write
-- to. Phase 2 is the first workflow to have surfaced this: it's the first
-- code path that ever attempts to INSERT into renewal_of.
--
-- Scoped to exactly the one missing column this bug report needs — no other
-- 0054-declared columns (dropout_score, collection_stage, etc.) are touched,
-- since a full audit of those is outside Phase 2's scope.

ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS renewal_of UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.student_enrollments.renewal_of IS
  'Self-referencing FK chaining a student''s enrollments across their academic journey (Scratch -> Python 1 -> Python 2 -> Arduino). Points at the PREVIOUS enrollment, never at a group or series. Populated by commit_cohort_graduation() (Phase 2) — see docs/DOMAIN_RULES.md Rule 10/14 and docs/GROUP_SERIES_RULES.md.';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_renewal_of
  ON public.student_enrollments(renewal_of) WHERE renewal_of IS NOT NULL;

NOTIFY pgrst, 'reload schema';
