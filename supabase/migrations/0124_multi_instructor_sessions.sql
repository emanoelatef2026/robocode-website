-- Phase XXXVI: Multi-Instructor Sessions
-- Creates session_instructors table to track which instructors actually
-- attended/submitted attendance for each session (source of truth for payroll).
-- Instructor allocations (group_instructors) remain PERMISSION-only.

-- ── 1. session_instructors junction table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_instructors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_instructors_unique UNIQUE (session_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_session_instructors_session_id
  ON public.session_instructors (session_id);

CREATE INDEX IF NOT EXISTS idx_session_instructors_instructor_id
  ON public.session_instructors (instructor_id);

-- ── 2. Backfill from schedules.created_by ─────────────────────────────────────
-- Attribute historical sessions to the instructor who created/opened them.
-- Only runs for completed sessions where created_by resolves to an instructor.

INSERT INTO public.session_instructors (session_id, instructor_id, submitted_at, created_at)
SELECT
  s.id,
  i.id,
  s.created_at,
  now()
FROM public.schedules s
JOIN public.instructors i ON i.user_id = s.created_by
WHERE s.status = 'completed'
  AND s.created_by IS NOT NULL
ON CONFLICT (session_id, instructor_id) DO NOTHING;

-- ── 3. Allow overlapping instructor allocations ────────────────────────────────
-- Remove the v_instructor_overlap_audit view enforcement note:
-- overlapping allocations are now INTENTIONALLY allowed (same session covered
-- by multiple instructors). The view is retained for observability only.
-- No constraint changes needed — the view was advisory only.
