-- Follow-up to 20260724220531_historical_enrollment_reconciliation.sql.
-- apply_historical_reconciliation_records is a SECURITY DEFINER RPC meant to
-- be called only from the server-side service-role client (see
-- modules/enrollments/historical-reconciliation.ts) -- never directly by a
-- signed-in or anonymous PostgREST caller. Matches the exact hardening
-- already applied to every other consumption RPC in
-- 20260705202917_security_hardening.sql / 20260705203318_security_hardening_revoke_public.sql.

REVOKE EXECUTE ON FUNCTION public.apply_historical_reconciliation_records(uuid[], integer, uuid, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_historical_reconciliation_records(uuid[], integer, uuid, uuid, uuid) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
