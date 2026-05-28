-- Migration: 0033_consistency_repair
-- Purpose: Repair auth/identity consistency gaps.
--
-- Root cause: Users created directly in Supabase Dashboard (or via other paths)
-- may be missing rows in public.users or public.user_roles. Without a user_roles
-- entry the resolver defaults the session role to 'parent', locking out the user.
--
-- This migration is safe to run multiple times (all statements are idempotent).

-- ─── 1. Sync any auth.users that are missing from public.users ────────────────
-- The handle_new_auth_user trigger does this on INSERT, but rows created before
-- the trigger was in place, or created by direct API calls that bypassed it,
-- will have gaps here.
INSERT INTO public.users (id, email)
SELECT au.id, au.email
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Backfill user_roles for students without a student role entry ─────────
-- A student record exists but no user_roles row → resolver assigns 'parent'.
INSERT INTO public.user_roles (user_id, role_id, branch_id)
SELECT s.user_id, r.id, s.branch_id
FROM public.students s
CROSS JOIN (SELECT id FROM public.roles WHERE name = 'student') r
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id   = s.user_id
      AND ur.role_id   = r.id
      AND ur.branch_id = s.branch_id
  )
ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

-- ─── 3. Backfill user_roles for instructors without an instructor role entry ───
INSERT INTO public.user_roles (user_id, role_id, branch_id)
SELECT i.user_id, r.id, i.branch_id
FROM public.instructors i
CROSS JOIN (SELECT id FROM public.roles WHERE name = 'instructor') r
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id   = i.user_id
      AND ur.role_id   = r.id
      AND ur.branch_id = i.branch_id
  )
ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

-- ─── 4. Backfill profiles for users that have auth accounts but no profile ────
-- Required so name fields display correctly in all portals.
INSERT INTO public.profiles (user_id, first_name, last_name)
SELECT u.id, '', ''
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT DO NOTHING;
