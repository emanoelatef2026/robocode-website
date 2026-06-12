-- Phase 16: Group Course Assignment Lifecycle Fix
-- Root cause: UNIQUE(group_id, course_id) blocked re-assigning a previously-used
--   course to the same group (e.g. assign Course A, cancel, re-assign Course A).
-- Fix: drop the global unique constraint; replace with a PARTIAL unique index
--   on (group_id) WHERE status='active' — enforcing "one active assignment per group"
--   while allowing unlimited historical rows.
-- Safe, idempotent, non-destructive. Preserves all existing rows.

BEGIN;

-- ── 1. Lifecycle columns ──────────────────────────────────────────────────────

ALTER TABLE public.group_courses
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ;

-- ── 2. Widen status CHECK to allow 'inactive' ─────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.group_courses DROP CONSTRAINT group_courses_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.group_courses
  ADD CONSTRAINT group_courses_status_check
  CHECK (status IN ('active', 'completed', 'cancelled', 'inactive'));

-- ── 3. Drop the old blocking global unique constraint ─────────────────────────

ALTER TABLE public.group_courses
  DROP CONSTRAINT IF EXISTS group_courses_group_id_course_id_key;

-- ── 4. Safety: keep at most one active row per group before creating index ────
--    (guards against any data integrity drift; keeps the most recently created)

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at DESC NULLS LAST) AS rn
  FROM public.group_courses
  WHERE status = 'active'
)
UPDATE public.group_courses
  SET status     = 'inactive',
      ended_at   = now(),
      updated_at = now()
  FROM ranked
  WHERE public.group_courses.id = ranked.id
    AND ranked.rn > 1;

-- ── 5. New partial unique index: one ACTIVE assignment per group ──────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_courses_active
  ON public.group_courses(group_id)
  WHERE (status = 'active');

-- ── 6. Backfill started_at from created_at ────────────────────────────────────

UPDATE public.group_courses
  SET started_at = created_at
  WHERE started_at IS NULL;

-- ── 7. Normalize programmatic cancellations → 'inactive' ─────────────────────
--    All existing 'cancelled' rows were set by code (not by a user action);
--    'inactive' is the correct semantic: "replaced by a newer assignment".

UPDATE public.group_courses
  SET status = 'inactive'
  WHERE status = 'cancelled';

-- ── PostgREST schema reload ───────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
