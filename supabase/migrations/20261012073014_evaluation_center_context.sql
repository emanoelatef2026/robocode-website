-- Context for evaluations authored from the instructor's group workspace.
-- Existing free-form evaluations keep their null context and history.
ALTER TABLE public.student_evaluations
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS next_goal TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.student_evaluations'::regclass AND conname = 'student_evaluations_source_type_check') THEN
    ALTER TABLE public.student_evaluations ADD CONSTRAINT student_evaluations_source_type_check
      CHECK (source_type IS NULL OR source_type IN ('assignment', 'video', 'project'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.student_evaluations'::regclass AND conname = 'student_evaluations_source_pair_check') THEN
    ALTER TABLE public.student_evaluations ADD CONSTRAINT student_evaluations_source_pair_check
      CHECK ((source_type IS NULL) = (source_id IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.student_evaluations'::regclass AND conname = 'student_evaluations_single_context_check') THEN
    ALTER TABLE public.student_evaluations ADD CONSTRAINT student_evaluations_single_context_check
      CHECK (schedule_id IS NULL OR source_id IS NULL);
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_student_evaluations_group_session
  ON public.student_evaluations (group_id, schedule_id, student_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_evaluations_session_criterion
  ON public.student_evaluations (student_id, group_id, schedule_id, criterion, author_id)
  WHERE schedule_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_evaluations_source_criterion
  ON public.student_evaluations (student_id, group_id, source_type, source_id, criterion, author_id)
  WHERE source_id IS NOT NULL AND deleted_at IS NULL;

-- The existing student_evaluations RLS policies and audit trigger cover these
-- columns. Access remains limited to the student, linked parents, and staff.
