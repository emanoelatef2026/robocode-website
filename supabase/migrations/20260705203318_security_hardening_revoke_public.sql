-- ============================================================================
-- Security Hardening — follow-up fix
-- The prior migration's `REVOKE EXECUTE ... FROM anon, authenticated` had no
-- effect: these functions were never granted EXECUTE explicitly to anon or
-- authenticated — they were reachable through the implicit EXECUTE grant to
-- PUBLIC that Postgres adds at CREATE FUNCTION time (every role, including
-- anon/authenticated, is a member of PUBLIC). Revoking from PUBLIC removes
-- that implicit path. `postgres` and `service_role` keep working because they
-- hold their own explicit EXECUTE grants (verified via pg_proc.proacl).
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.audit_student_note_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_schedule_with_cascade(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_attendance_sessions_batch(uuid[], uuid[], uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.full_recompute_all_consumption() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_consumed_sessions_batch(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_feature_enabled(text, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_group_completed_sessions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_schedule_consumptions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_session_consumption(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_student_consumed_sessions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_session_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_unmatched_sql() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_cancelled_session_attendance(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_student_attendance_sql(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_student_consumption(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_grade_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_student_progress() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_student_consumption(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.repair_student_portal_accounts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_entities(text, uuid, text[], integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_enrollment_financial_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_consumed_sessions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_enrollment_fin_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid) FROM PUBLIC;
