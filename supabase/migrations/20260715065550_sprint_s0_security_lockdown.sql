-- Sprint S0 — Security Lockdown
-- Applied via mcp apply_migration; registered as version 20260715065550 in
-- supabase_migrations.schema_migrations. This file mirrors that exact SQL.

-- 1. Close the user_has_permission enumeration oracle.
-- Every real caller (RLS policies) already passes auth.uid() as p_user_id, and
-- repo-wide grep confirms zero application code calls this RPC directly, so
-- restricting to "self or service_role" is behavior-preserving for all
-- legitimate callers while blocking anon/authenticated from querying an
-- arbitrary other user's permissions.
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_permission text, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.name = p_permission
      AND (p_user_id = auth.uid() OR auth.role() = 'service_role')
      AND (
        ur.branch_id IS NULL
        OR ur.branch_id = p_branch_id
        OR p_branch_id IS NULL
      )
  )
$function$;

-- 2. Three backup tables left in the public, PostgREST-exposed schema from a
-- prior repair session have RLS disabled (ERROR-level in the security
-- advisor). Enable RLS (no policy = deny-all via PostgREST) and revoke
-- direct grants as belt-and-suspenders.
ALTER TABLE public.finance_installments_backup_20260706 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_student_branch_fix_20260706 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_enrollment_status_fix_20260706 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.finance_installments_backup_20260706 FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public._backup_student_branch_fix_20260706 FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public._backup_enrollment_status_fix_20260706 FROM anon, authenticated, PUBLIC;

-- 3. student_parent_contacts.service_full_access is an unrestricted ALL
-- policy (USING true / WITH CHECK true) scoped to role {public} instead of
-- {service_role} -- clearly meant to be a service-role-only backstop.
DROP POLICY IF EXISTS service_full_access ON public.student_parent_contacts;
CREATE POLICY service_full_access ON public.student_parent_contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
