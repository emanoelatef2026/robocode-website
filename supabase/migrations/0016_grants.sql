-- Migration: 0016_grants
-- Purpose: Grant table-level privileges to Supabase roles.
--
-- WHY THIS IS NEEDED:
-- Migrations run as the `postgres` superuser, which owns all created tables.
-- The `service_role`, `authenticated`, and `anon` PostgreSQL roles are distinct
-- from `postgres` and do not automatically inherit access to new tables.
-- `BYPASSRLS` (held by service_role) only skips row-level security policies —
-- it does NOT grant table-level SELECT/INSERT/UPDATE/DELETE.
-- Without these grants, every query from the application returns
-- "permission denied for table <name>".
--
-- This migration is idempotent — GRANT is a no-op if already granted.

GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;

-- service_role: full access (used by Server Actions via lib/supabase/service.ts)
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

-- authenticated: full table access; RLS policies enforce row-level restrictions
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO authenticated;

-- anon: SELECT only on the two lookup tables needed by the unauthenticated login page
GRANT SELECT ON public.roles       TO anon;
GRANT SELECT ON public.permissions TO anon;

-- Default privileges: any table created AFTER this migration also receives grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES  TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
