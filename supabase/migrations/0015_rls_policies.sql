-- Migration: 0015_rls_policies
-- Purpose: Additional cross-cutting RLS policies, service role bypass,
--          and policy audit summary
-- Dependencies: all prior migrations

-- ─── Service Role Bypass ─────────────────────────────────────────────────────
-- Supabase service role bypasses RLS by default (it uses BYPASSRLS).
-- We enforce this explicitly and document which tables allow it.
-- All server-side admin operations use lib/supabase/service.ts.
-- This is the correct and intended behavior — no additional config needed.

-- ─── Ensure no table is missing RLS ──────────────────────────────────────────
-- Run this query to verify: SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND NOT rowsecurity;
-- All public tables must have RLS enabled before going to production.

-- ─── Feature Flags ───────────────────────────────────────────────────────────
-- Simple feature flag system for safe rollouts
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  -- Scope: 'all' | specific branch IDs | specific user IDs
  enabled_for     JSONB NOT NULL DEFAULT '{"scope": "none"}',
  is_enabled      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flags IS
  'Controls feature rollout per branch or user. Use before releasing new LMS features.';

CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_flag_name TEXT,
  p_user_id   UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN is_enabled = false THEN false
          WHEN (enabled_for->>'scope') = 'all' THEN true
          WHEN p_branch_id IS NOT NULL
            AND (enabled_for->'branches') ? p_branch_id::TEXT THEN true
          WHEN p_user_id IS NOT NULL
            AND (enabled_for->'users') ? p_user_id::TEXT THEN true
          ELSE false
        END
      FROM public.feature_flags
      WHERE name = p_flag_name
    ),
    false
  )
$$;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_read_authenticated"
  ON public.feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "feature_flags_manage_admin"
  ON public.feature_flags FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'));

-- ─── Security Summary ─────────────────────────────────────────────────────────
--
-- SECURITY LAYERS (in order of enforcement):
--
-- 1. Next.js Middleware (middleware.ts)
--    - Checks: session exists, role matches portal
--    - Reads: JWT claims only (no DB query)
--    - Does NOT: check granular permissions
--
-- 2. Server Action Guards (modules/rbac/guards.ts)
--    - requirePermission() called at top of every Server Action
--    - Checks: JWT claims permission list
--    - Does NOT: bypass RLS
--
-- 3. PostgreSQL RLS (this and prior migrations)
--    - Every table has RLS enabled
--    - All queries filtered at DB level regardless of app code
--    - user_has_permission() function used in policies
--
-- 4. Service Role (lib/supabase/service.ts)
--    - Bypasses RLS only in explicitly authorized Server Actions
--    - Never used in client components
--    - Never used in middleware
--
-- ANTI-PATTERNS TO AVOID:
--    - Never check permissions only in middleware
--    - Never check permissions only in the app layer
--    - Never use service role in browser clients
--    - Never trust user-supplied role claims without DB verification for sensitive ops
--    - Never store passwords or PII in JWT claims
