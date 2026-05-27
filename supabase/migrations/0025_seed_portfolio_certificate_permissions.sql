-- Migration: add manage_portfolio and manage_certificates permissions
-- These were defined in TypeScript types but never seeded to the DB,
-- making all portfolio and certificate admin pages inaccessible to every role.

-- ─── Insert missing permissions ───────────────────────────────────────────────
INSERT INTO public.permissions (name, description, category) VALUES
  ('manage_portfolio',    'Create/edit/archive student portfolio projects and achievements', 'content'),
  ('manage_certificates', 'Issue, revoke, and manage student certificates',                 'content')
ON CONFLICT (name) DO NOTHING;

-- ─── Assign to super_admin ────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
  AND p.name IN ('manage_portfolio', 'manage_certificates')
ON CONFLICT DO NOTHING;

-- ─── Assign to team_leader ────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'team_leader'
  AND p.name IN ('manage_portfolio', 'manage_certificates')
ON CONFLICT DO NOTHING;
