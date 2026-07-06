-- Phase 4.2b: same fix, for the 4 policies using auth.role() instead of auth.uid()/auth.jwt()
ALTER POLICY "roles_readable_by_authenticated" ON public."roles"
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "permissions_readable_by_authenticated" ON public."permissions"
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "role_permissions_readable_by_authenticated" ON public."role_permissions"
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "feature_flags_read_authenticated" ON public."feature_flags"
  USING (((select auth.role()) = 'authenticated'::text));
