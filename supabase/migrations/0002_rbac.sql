-- Migration: 0002_rbac
-- Purpose: Roles, permissions, and user-role assignments
-- Dependencies: 0001_init_auth

-- ─── Roles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Fixed role definitions. is_system=true roles cannot be deleted.';

-- ─── Permissions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  category    TEXT NOT NULL, -- 'system' | 'academic' | 'financial' | 'content' | 'communication' | 'analytics' | 'audit' | 'ai'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Role → Permission assignments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ─── User → Role assignments (branch-scoped) ─────────────────────────────────
-- branch_id = NULL means the role is global (super_admin, or cross-branch)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  branch_id   UUID,  -- FK added in 0003_organization after branches table exists
  assigned_by UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, branch_id)
);

-- ─── Function: check permission from DB (used in RLS policies) ───────────────
-- This centralizes permission logic so RLS policies don't duplicate it.
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id    UUID,
  p_permission TEXT,
  p_branch_id  UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.name = p_permission
      AND (
        ur.branch_id IS NULL                                    -- global role
        OR ur.branch_id = p_branch_id                          -- exact branch match
        OR p_branch_id IS NULL                                  -- no branch filter
      )
  )
$$;

COMMENT ON FUNCTION public.user_has_permission IS
  'Returns true if user has the named permission, optionally scoped to a branch. Used in RLS policies.';

-- ─── Function: get user global role ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.branch_id IS NULL
  ORDER BY
    CASE r.name
      WHEN 'super_admin'  THEN 5
      WHEN 'team_leader'  THEN 4
      WHEN 'instructor'   THEN 3
      WHEN 'student'      THEN 2
      WHEN 'parent'       THEN 1
      ELSE 0
    END DESC
  LIMIT 1
$$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id   ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id   ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id ON public.user_roles(branch_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Roles and permissions are readable by all authenticated users
CREATE POLICY "roles_readable_by_authenticated"
  ON public.roles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "permissions_readable_by_authenticated"
  ON public.permissions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "role_permissions_readable_by_authenticated"
  ON public.role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- user_roles: users can see their own; admins see all via service role
CREATE POLICY "user_roles_self_read"
  ON public.user_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_permissions')
    OR public.user_has_permission(auth.uid(), 'manage_users')
  );

-- Only super_admin can write role assignments (via service role in Server Actions)
CREATE POLICY "user_roles_admin_insert"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_permissions'));

CREATE POLICY "user_roles_admin_delete"
  ON public.user_roles FOR DELETE
  USING (public.user_has_permission(auth.uid(), 'manage_permissions'));
