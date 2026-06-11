-- Migration: 0069_session_lifecycle_extended
-- Purpose: Extend session lifecycle with postponed/cancelled_with_makeup statuses,
--          cancellation metadata, and makeup session linking.
-- Dependencies: 0007_schedule_attendance, 0038_session_lifecycle

-- ─── Extend status check constraint ─────────────────────────────────────────
-- Drop old constraint and re-create with new allowed values.
-- 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
-- + 'cancelled_with_makeup' | 'postponed'
ALTER TABLE public.schedules
  DROP CONSTRAINT IF EXISTS schedules_status_check;

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_status_check
    CHECK (status IN (
      'scheduled',
      'ongoing',
      'completed',
      'cancelled',
      'cancelled_with_makeup',
      'postponed'
    ));

-- ─── Cancellation / postponement metadata ───────────────────────────────────
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS cancelled_by        UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS postponed_reason    TEXT,
  ADD COLUMN IF NOT EXISTS original_session_id UUID REFERENCES public.schedules(id);

-- ─── Comment: business rules ─────────────────────────────────────────────────
-- cancelled             : Session cancelled, no makeup planned.
-- cancelled_with_makeup : Session cancelled AND a makeup session was created
--                         (the makeup links back via original_session_id).
-- postponed             : Session postponed; kept visible, not counted.
-- Cancelled/postponed sessions MUST NOT:
--   - count toward instructor payroll
--   - consume student remaining sessions
--   - count in attendance percentages
--   - affect curriculum progress
-- They remain visible in history/audit.

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_original_session
  ON public.schedules(original_session_id)
  WHERE original_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_cancelled_at
  ON public.schedules(cancelled_at)
  WHERE cancelled_at IS NOT NULL;

-- Refresh PostgREST schema cache so new columns are immediately visible.
NOTIFY pgrst, 'reload schema';
