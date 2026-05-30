-- Sprint 20: session lifecycle timestamps
-- Adds started_at (when instructor explicitly starts the session)
-- and ended_at (when instructor explicitly ends/completes it).
-- Both are nullable so existing rows are unaffected.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS ended_at   TIMESTAMPTZ NULL;
