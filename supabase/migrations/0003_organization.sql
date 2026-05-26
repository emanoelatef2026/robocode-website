-- Migration: 0003_organization
-- Purpose: Organizations, branches (upgrade existing CMS table), semesters, and settings
-- Dependencies: 0001, 0002
--
-- IMPORTANT: public.branches already exists from the CMS (marketing website).
-- It has different columns than the LMS schema expects.
-- This migration ADDS the missing LMS columns via ALTER TABLE — it does NOT drop
-- the existing CMS columns or any existing data.
--
-- Existing CMS columns preserved: phone, location, image_url, active, sort_order, study_mode
-- New LMS columns added:          org_id, slug, type, location_data, timezone,
--                                  settings, is_active, deleted_at, updated_at

-- ─── Organizations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert the default organization so existing branches can be assigned to it.
-- ON CONFLICT DO NOTHING makes this idempotent.
INSERT INTO public.organizations (id, name, slug)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'Robocode',
  'robocode'
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Upgrade existing branches table ─────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS is idempotent — safe to re-run.

-- Step 1: Add new LMS columns (nullable first so we can backfill before NOT NULL)
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS org_id        UUID,
  ADD COLUMN IF NOT EXISTS slug          TEXT,
  ADD COLUMN IF NOT EXISTS type          TEXT,
  ADD COLUMN IF NOT EXISTS location_data JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone      TEXT         NOT NULL DEFAULT 'Africa/Cairo',
  ADD COLUMN IF NOT EXISTS settings      JSONB        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now();

-- Step 2: Backfill org_id — all existing branches belong to the default org
UPDATE public.branches
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Step 3: Backfill slug from name (lowercase, non-alphanumeric runs → dash, trim dashes)
UPDATE public.branches
SET slug = regexp_replace(
             regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
             '^-+|-+$', '', 'g'
           )
WHERE slug IS NULL;

-- Deduplicate slugs within org if two branches have the same name
-- (append the short id suffix to any duplicate after the first)
UPDATE public.branches b
SET slug = slug || '-' || substring(id::TEXT, 1, 8)
WHERE id NOT IN (
  SELECT DISTINCT ON (org_id, slug) id
  FROM public.branches
  ORDER BY org_id, slug, created_at
);

-- Step 4: Backfill type from study_mode (values already match the CHECK constraint)
UPDATE public.branches
SET type = CASE
  WHEN study_mode IN ('online', 'offline', 'hybrid') THEN study_mode
  ELSE 'offline'
END
WHERE type IS NULL;

-- Step 5: Backfill is_active from the CMS `active` column
UPDATE public.branches
SET is_active = active
WHERE is_active IS DISTINCT FROM active;

-- Step 6: Now enforce NOT NULL on the columns we just backfilled
ALTER TABLE public.branches
  ALTER COLUMN org_id  SET NOT NULL,
  ALTER COLUMN slug    SET NOT NULL,
  ALTER COLUMN type    SET NOT NULL;

-- Step 7: Add constraints (check for existence to make idempotent)
DO $$
BEGIN
  -- CHECK constraint on type
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branches_type_check'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_type_check
      CHECK (type IN ('online', 'offline', 'hybrid'));
  END IF;

  -- FK: org_id → organizations
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branches_org_id_fkey'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  -- UNIQUE (org_id, slug)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branches_org_id_slug_key'
      AND conrelid = 'public.branches'::regclass
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_org_id_slug_key
      UNIQUE (org_id, slug);
  END IF;

  -- FK: user_roles.branch_id → branches.id (deferred from 0002)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_user_roles_branch'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT fk_user_roles_branch
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── Semesters ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.semesters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT semesters_date_order CHECK (start_date < end_date)
);

-- ─── Settings (key-value per entity) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('org', 'branch', 'user')),
  entity_id   UUID NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES public.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, key)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_branches_org_id    ON public.branches(org_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON public.branches(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_semesters_branch   ON public.semesters(branch_id);
CREATE INDEX IF NOT EXISTS idx_settings_entity    ON public.settings(entity_type, entity_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches      ENABLE ROW LEVEL SECURITY;  -- already enabled; idempotent
ALTER TABLE public.semesters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings      ENABLE ROW LEVEL SECURITY;

-- Drop any old conflicting branch policies before re-creating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'branches'
      AND policyname = 'branches_read_by_member'
  ) THEN
    DROP POLICY "branches_read_by_member" ON public.branches;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'branches'
      AND policyname = 'branches_write_by_admin'
  ) THEN
    DROP POLICY "branches_write_by_admin" ON public.branches;
  END IF;
END $$;

-- Branches: visible to LMS users assigned to that branch
CREATE POLICY "branches_read_by_member"
  ON public.branches FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      id IN (
        SELECT branch_id FROM public.user_roles
        WHERE user_id = auth.uid()
        AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "branches_write_by_admin"
  ON public.branches FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_branches'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_branches'));

CREATE POLICY "semesters_read_by_branch_member"
  ON public.semesters FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND branch_id IS NOT NULL
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "settings_read_own"
  ON public.settings FOR SELECT
  USING (
    (entity_type = 'user' AND entity_id = auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_settings')
  );
