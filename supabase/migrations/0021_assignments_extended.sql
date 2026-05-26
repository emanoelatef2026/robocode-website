-- Migration: 0021_assignments_extended
-- Purpose: Extend assignments for Robocode-specific types, rich submission workflows, and structured feedback

-- ── 1. Extend assignments.type CHECK ──────────────────────────────────────────
-- Drop the auto-named CHECK constraint on type column, recreate with extended values
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.assignments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%homework%'
    AND pg_get_constraintdef(oid) NOT LIKE '%submission_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_type_check
  CHECK (type IN ('homework', 'classwork', 'project', 'quiz', 'exam', 'presentation', 'challenge', 'competition'));

-- ── 2. New columns on assignments ─────────────────────────────────────────────
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS rubric JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resubmission_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_resubmissions INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS portfolio_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_grading_enabled BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assignments'::regclass
      AND conname = 'assignments_submission_type_check'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_submission_type_check
      CHECK (submission_type IN ('text', 'file', 'image', 'video_link', 'drive_link', 'github_link', 'url', 'multiple'));
  END IF;
END $$;

-- ── 3. New columns on submissions ─────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS submission_type TEXT,
  ADD COLUMN IF NOT EXISTS drive_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS project_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

-- ── 4. assignment_feedback table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  given_by      UUID NOT NULL REFERENCES public.users(id),
  type          TEXT NOT NULL DEFAULT 'instructor'
                CHECK (type IN ('instructor', 'peer', 'ai', 'self')),
  content       TEXT NOT NULL,
  rubric_scores JSONB NOT NULL DEFAULT '{}',
  is_public     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Triggers ───────────────────────────────────────────────────────────────
CREATE TRIGGER set_assignment_feedback_updated_at
  BEFORE UPDATE ON public.assignment_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignment_feedback_submission ON public.assignment_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignment_feedback_given_by   ON public.assignment_feedback(given_by);
CREATE INDEX IF NOT EXISTS idx_assignments_type_ext           ON public.assignments(type)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_submission_type    ON public.assignments(submission_type)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_is_late            ON public.submissions(is_late)          WHERE is_late = true;
CREATE INDEX IF NOT EXISTS idx_submissions_portfolio          ON public.submissions(portfolio_visible) WHERE portfolio_visible = true;

-- ── 7. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.assignment_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_instructor_all"
  ON public.assignment_feedback FOR ALL
  USING (public.user_has_permission(auth.uid(), 'grade_assignments'));

CREATE POLICY "feedback_public_read"
  ON public.assignment_feedback FOR SELECT
  USING (
    is_public = true
    AND submission_id IN (
      SELECT s.id FROM public.submissions s
      JOIN public.students st ON st.id = s.student_id
      WHERE st.user_id = auth.uid()
        OR st.id IN (
          SELECT ps.student_id FROM public.parent_students ps
          JOIN public.parents p ON p.id = ps.parent_id
          WHERE p.user_id = auth.uid()
        )
    )
  );
