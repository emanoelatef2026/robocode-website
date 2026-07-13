-- Migration: 20260713124359_cohort_lifecycle_foundation
-- Purpose: Phase 0 of the Group/Cohort Academic Lifecycle feature — additive
--          schema only. See docs/DOMAIN_RULES.md for the business invariants
--          this schema exists to eventually enforce.
--
-- Scope (deliberately minimal):
--   * New table `group_series` — recurring class-slot identity, independent
--     of any single semester's `groups` row (DOMAIN_RULES.md #9).
--   * `groups.series_id` — nullable FK to group_series.
--   * `groups.archived_at` — nullable timestamp, set only when a group
--     reaches the terminal Archived stage (DOMAIN_RULES.md #3).
--
-- Explicitly NOT in this migration:
--   * No trigger enforcing immutability (Phase 1).
--   * No backfill of series_id on existing groups.
--   * No workflow/business logic writes 'archived' or sets archived_at yet.
--   * groups.status already allows 'archived' as of migration 0086 — this
--     migration does not touch that CHECK constraint.

-- ─── Table: group_series ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.group_series (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  day_of_week        TEXT CHECK (day_of_week IN (
                       'monday', 'tuesday', 'wednesday', 'thursday',
                       'friday', 'saturday', 'sunday')),
  time               TEXT,
  default_capacity   INTEGER,
  default_room       TEXT,
  default_course_id  UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.group_series IS
  'Recurring class-slot identity (branch/day/time/room), independent of any single semester''s groups row. See docs/DOMAIN_RULES.md #9.';

CREATE TRIGGER set_group_series_updated_at
  BEFORE UPDATE ON public.group_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_group_series_branch_id ON public.group_series(branch_id);

-- ─── groups: new nullable columns ──────────────────────────────────────────

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS series_id   UUID REFERENCES public.group_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.groups.series_id IS
  'Operational slot lineage — links this semester''s group to its recurring class-slot identity. See docs/DOMAIN_RULES.md #9. Nullable; not backfilled by this migration.';
COMMENT ON COLUMN public.groups.archived_at IS
  'Set once, when the group reaches the terminal Archived stage. See docs/DOMAIN_RULES.md #3. Not written by any app code as of this migration.';

CREATE INDEX IF NOT EXISTS idx_groups_series_id ON public.groups(series_id) WHERE series_id IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Mirrors the existing groups RLS pattern (0005_academic.sql) — branch-scoped
-- read for staff assigned to the branch, write gated on the same
-- 'manage_groups' permission already used for groups itself. No new
-- permission or business rule is introduced.

ALTER TABLE public.group_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_series_read_by_branch_member"
  ON public.group_series FOR SELECT
  USING (
    branch_id IN (
      SELECT DISTINCT branch_id FROM public.user_roles
      WHERE user_id = auth.uid() AND branch_id IS NOT NULL
    )
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "group_series_write_by_staff"
  ON public.group_series FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_groups', branch_id))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_groups', branch_id));
