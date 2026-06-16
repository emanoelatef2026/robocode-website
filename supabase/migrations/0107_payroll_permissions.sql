-- ─────────────────────────────────────────────────────────────────────────────
-- 0107  PAYROLL PERMISSIONS — PHASE 19
-- ─────────────────────────────────────────────────────────────────────────────
-- Seeds the manage_payroll permission (already type-registered in permissions.ts
-- since 0062 but never inserted into the DB) and grants it to super_admin and
-- team_leader roles.
--
-- manage_payroll is NOT added to CONFIGURABLE_PERMISSIONS — it flows from role,
-- not from per-user overrides, since payroll management is a core TL capability.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Seed permission ────────────────────────────────────────────────────────

INSERT INTO public.permissions (name, description)
VALUES (
  'manage_payroll',
  'Generate, view, approve, and manage instructor payroll runs and items'
)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- ── 2. Grant to super_admin ───────────────────────────────────────────────────

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'super_admin' AND p.name = 'manage_payroll'
ON CONFLICT DO NOTHING;

-- ── 3. Grant to team_leader ───────────────────────────────────────────────────

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'team_leader' AND p.name = 'manage_payroll'
ON CONFLICT DO NOTHING;
