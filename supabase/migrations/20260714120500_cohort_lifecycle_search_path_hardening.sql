-- Migration: 20260714120500_cohort_lifecycle_search_path_hardening
-- Purpose: security-advisor follow-up to 20260714120000_cohort_lifecycle_archive_enforcement.
-- get_advisors (security) flagged the 5 new functions from that migration as
-- "Function Search Path Mutable" (WARN). Pin search_path = '' on each, matching
-- the project-wide hardening convention already established in
-- 20260705202917_security_hardening.sql. All 5 functions already fully
-- qualify every table reference with `public.`, so this is a no-op behavior
-- change, pure hardening.

ALTER FUNCTION public.is_group_archived(UUID) SET search_path = '';
ALTER FUNCTION public.prevent_mutation_on_archived_group() SET search_path = '';
ALTER FUNCTION public.prevent_schedule_mutation_on_archived_group() SET search_path = '';
ALTER FUNCTION public.prevent_attendance_mutation_on_archived_group() SET search_path = '';
ALTER FUNCTION public.sync_group_archived_at() SET search_path = '';

NOTIFY pgrst, 'reload schema';
