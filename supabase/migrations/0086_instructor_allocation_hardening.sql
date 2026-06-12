-- PHASE 18: Instructor allocation lifecycle hardening.
-- Extends group_instructors with immutable ownership range fields and lifecycle state.

ALTER TABLE public.group_instructors
  ADD COLUMN IF NOT EXISTS to_session        INT,
  ADD COLUMN IF NOT EXISTS allocation_status TEXT NOT NULL DEFAULT 'active'
    CHECK (allocation_status IN ('active', 'completed', 'released')),
  ADD COLUMN IF NOT EXISTS handoff_notes     TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS released_at       TIMESTAMPTZ;

-- Backfill to_session from existing allocated_sessions (idempotent).
UPDATE public.group_instructors
SET    to_session = from_session + allocated_sessions - 1
WHERE  allocated_sessions IS NOT NULL
  AND  to_session IS NULL;

-- Index for fast range-based ownership lookups.
CREATE INDEX IF NOT EXISTS idx_gi_allocation_range
  ON public.group_instructors (group_id, from_session, to_session);

-- Extend groups.status CHECK to include lifecycle states we will use.
ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_status_check;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_status_check
    CHECK (status IN ('forming', 'active', 'handoff_pending', 'completed', 'cancelled', 'archived'));
