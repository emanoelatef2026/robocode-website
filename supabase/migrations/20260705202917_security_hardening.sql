-- ============================================================================
-- Security Hardening — Phase 1 (permissions only, no data changes)
-- Closes: 12 tables with RLS disabled, 27 SECURITY DEFINER functions callable
-- by anon/authenticated, 43 SECURITY DEFINER views, mutable search_path on
-- ~55 functions, open storage.objects listing on portfolio-images.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS on the 12 exposed tables + service_role-only policies
-- ----------------------------------------------------------------------------

-- trial_bookings: legacy policy predates the current architecture (booking
-- form now writes to `leads` via service-role client in
-- app/api/book-session/route.ts -> modules/leads/actions.ts::createWebsiteLead).
-- All trial_bookings reads/writes today go through getSupabaseAdmin() in the
-- /studio admin routes, so no anon INSERT policy is needed.
DROP POLICY IF EXISTS "Anyone can submit a booking" ON public.trial_bookings;

ALTER TABLE public.trial_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_bookings_service_role ON public.trial_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY gallery_service_role ON public.gallery
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_plans_service_role ON public.subscription_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY installment_plans_service_role ON public.installment_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_reads_service_role ON public.announcement_reads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.analytics_events_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_events_default_service_role ON public.analytics_events_default
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_interactions_service_role ON public.ai_interactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.session_instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_instructors_service_role ON public.session_instructors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_reads_service_role ON public.notification_reads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.trial_session_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_session_students_service_role ON public.trial_session_students
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.makeup_session_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY makeup_session_students_service_role ON public.makeup_session_students
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.welcome_message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY welcome_message_logs_service_role ON public.welcome_message_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. Revoke EXECUTE on internal/admin functions from anon + authenticated.
--    user_has_permission is EXCLUDED: it's called from inside ~60 existing RLS
--    policy quals (students, groups, finance_*, invoices, ...) and revoking it
--    would break policy evaluation for any authenticated-role query.
--    get_user_role has no RLS policy references, so it's safe to revoke.
--    Trigger functions (trg_*, handle_new_auth_user) fire regardless of the
--    invoking role's EXECUTE grant, so revoking is safe for them too.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.audit_student_note_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_schedule_with_cascade(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_attendance_sessions_batch(uuid[], uuid[], uuid[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.full_recompute_all_consumption() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_consumed_sessions_batch(uuid[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_group_completed_sessions(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_schedule_consumptions(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_session_consumption(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_student_consumed_sessions(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_session_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_unmatched_sql() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_cancelled_session_attendance(boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_student_attendance_sql(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_student_consumption(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_grade_summary() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_student_progress() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_student_consumption(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_student_portal_accounts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_entities(text, uuid, text[], integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_enrollment_financial_status(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_consumed_sessions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_enrollment_fin_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid) FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Flip all v_* views + search_index to security_invoker so they respect
--    the querying role's RLS instead of running as the view owner.
-- ----------------------------------------------------------------------------

ALTER VIEW public.search_index SET (security_invoker = true);
ALTER VIEW public.v_allocation_gaps SET (security_invoker = true);
ALTER VIEW public.v_archived_families SET (security_invoker = true);
ALTER VIEW public.v_attendance_drift SET (security_invoker = true);
ALTER VIEW public.v_attendance_funding_status SET (security_invoker = true);
ALTER VIEW public.v_attendance_without_eligible_contract SET (security_invoker = true);
ALTER VIEW public.v_cancelled_sessions_with_consumption SET (security_invoker = true);
ALTER VIEW public.v_consumption_integrity SET (security_invoker = true);
ALTER VIEW public.v_contract_consumption_mismatch SET (security_invoker = true);
ALTER VIEW public.v_dashboard_overview SET (security_invoker = true);
ALTER VIEW public.v_enrollment_academic_progress SET (security_invoker = true);
ALTER VIEW public.v_enrollment_integrity SET (security_invoker = true);
ALTER VIEW public.v_enrollment_session_integrity SET (security_invoker = true);
ALTER VIEW public.v_finance_contract_summary SET (security_invoker = true);
ALTER VIEW public.v_financial_collection_health SET (security_invoker = true);
ALTER VIEW public.v_group_attendance_mismatch SET (security_invoker = true);
ALTER VIEW public.v_group_count_drift SET (security_invoker = true);
ALTER VIEW public.v_group_health SET (security_invoker = true);
ALTER VIEW public.v_group_progress_integrity SET (security_invoker = true);
ALTER VIEW public.v_group_readiness SET (security_invoker = true);
ALTER VIEW public.v_instructor_allocation_summary SET (security_invoker = true);
ALTER VIEW public.v_instructor_overlap_audit SET (security_invoker = true);
ALTER VIEW public.v_instructor_progress_drift SET (security_invoker = true);
ALTER VIEW public.v_integrity_audit SET (security_invoker = true);
ALTER VIEW public.v_invalid_attendance_consumption SET (security_invoker = true);
ALTER VIEW public.v_invalid_package_consumption SET (security_invoker = true);
ALTER VIEW public.v_open_ended_groups SET (security_invoker = true);
ALTER VIEW public.v_operations_alerts SET (security_invoker = true);
ALTER VIEW public.v_orphan_attendance SET (security_invoker = true);
ALTER VIEW public.v_orphan_attendance_consumption SET (security_invoker = true);
ALTER VIEW public.v_orphan_sessions SET (security_invoker = true);
ALTER VIEW public.v_reconciliation_candidates SET (security_invoker = true);
ALTER VIEW public.v_session_consumption_status SET (security_invoker = true);
ALTER VIEW public.v_session_count_health SET (security_invoker = true);
ALTER VIEW public.v_sessions_missing_topics SET (security_invoker = true);
ALTER VIEW public.v_sessions_without_number SET (security_invoker = true);
ALTER VIEW public.v_student_attendance_summary SET (security_invoker = true);
ALTER VIEW public.v_student_contract_drift SET (security_invoker = true);
ALTER VIEW public.v_student_course_history SET (security_invoker = true);
ALTER VIEW public.v_student_dashboard_integrity SET (security_invoker = true);
ALTER VIEW public.v_student_history_health SET (security_invoker = true);
ALTER VIEW public.v_student_package_ledger SET (security_invoker = true);
ALTER VIEW public.v_student_risk SET (security_invoker = true);
ALTER VIEW public.v_unmatched_attendance SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 4. Pin search_path = '' on every public-schema function that doesn't already
--    set one. Skips functions owned by an extension (pg_trgm) since those are
--    managed by the extension, not application code.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proconfig IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''''', r.proname, r.args);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Narrow storage.objects listing on the portfolio-images bucket.
--    The bucket stays `public` (direct-URL fetch of a known path still works,
--    per app/api/portfolio/upload-image/route.ts using getPublicUrl()), but
--    the open SELECT policy currently lets anon/authenticated enumerate every
--    object in the bucket via the storage list/API. Nothing in the app lists
--    via that API — uploads/URLs go through the service-role client — so
--    listing is restricted to service_role only.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS portfolio_images_public_read ON storage.objects;
CREATE POLICY portfolio_images_service_read ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'portfolio-images');
