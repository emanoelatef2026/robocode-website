-- Migration: 0037_user_permissions
-- Purpose: Per-user permission overrides for team leaders and instructors.
--          When a user has rows here, these REPLACE their role's configurable
--          permissions in resolveUserPermissions(). Users with no rows continue
--          using their role's default permissions (backward compatible).
-- Dependencies: 0002_rbac, 0004_people

-- ─── Per-user permission grants ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id       UUID        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  permission_id UUID        NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_by    UUID                 REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

COMMENT ON TABLE public.user_permissions IS
  'Per-user permission overrides. When populated for a user, these replace the '
  'role-level configurable permissions. Managed through admin TL/instructor forms.';

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
  ON public.user_permissions(user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permissions_self_read"
  ON public.user_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_permissions')
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "user_permissions_admin_insert"
  ON public.user_permissions FOR INSERT
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_permissions')
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "user_permissions_admin_delete"
  ON public.user_permissions FOR DELETE
  USING (
    public.user_has_permission(auth.uid(), 'manage_permissions')
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

-- ─── New permission: manage_semesters ─────────────────────────────────────────
-- Was defined in TypeScript types but never seeded into the DB.

INSERT INTO public.permissions (name, description, category) VALUES
  ('manage_semesters', 'Create and manage academic semesters and academic years', 'academic')
ON CONFLICT (name) DO NOTHING;

-- Assign to super_admin and team_leader
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name IN ('super_admin', 'team_leader')
  AND p.name = 'manage_semesters'
ON CONFLICT DO NOTHING;
