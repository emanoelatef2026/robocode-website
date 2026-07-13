-- Migration: 20260713124637_group_series_performance_hardening
-- Purpose: Phase 0 follow-up — fix advisor findings raised by
--          20260713124359_cohort_lifecycle_foundation.sql's initial
--          group_series RLS policies, before anything depends on them.
--
-- Findings (get_advisors, run immediately after that migration):
--   1. group_series_read_by_branch_member / group_series_write_by_staff both
--      re-evaluate auth.uid() per row instead of once per statement.
--   2. Those same two policies are both permissive for SELECT, so Postgres
--      evaluates both on every read — the exact "multiple permissive
--      policies" pattern already remediated platform-wide for every other
--      table in 20260706061514_phase4_merge_permissive_policies_batch1.sql
--      (see its "-- groups" section, the identical branch-scoped shape).
--   3. group_series_default_course_id_fkey has no covering index.
--
-- This migration replaces the two original policies with the same
-- write-split + select-merged shape already standard everywhere else, and
-- adds the missing index. No table structure, no business logic, no
-- workflow — purely bringing group_series in line with the codebase's
-- already-established RLS performance convention.

DROP POLICY IF EXISTS group_series_write_by_staff       ON public.group_series;
DROP POLICY IF EXISTS group_series_read_by_branch_member ON public.group_series;

CREATE POLICY group_series_write_insert ON public.group_series
  FOR INSERT WITH CHECK (public.user_has_permission((select auth.uid()), 'manage_groups', branch_id));

CREATE POLICY group_series_write_update ON public.group_series
  FOR UPDATE USING (public.user_has_permission((select auth.uid()), 'manage_groups', branch_id))
  WITH CHECK (public.user_has_permission((select auth.uid()), 'manage_groups', branch_id));

CREATE POLICY group_series_write_delete ON public.group_series
  FOR DELETE USING (public.user_has_permission((select auth.uid()), 'manage_groups', branch_id));

CREATE POLICY group_series_select_merged ON public.group_series
  FOR SELECT USING (
    public.user_has_permission((select auth.uid()), 'manage_groups', branch_id)
    OR (
      branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = (select auth.uid()) AND branch_id IS NOT NULL
      )
      OR public.user_has_permission((select auth.uid()), 'manage_system')
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_series_default_course_id
  ON public.group_series(default_course_id) WHERE default_course_id IS NOT NULL;
