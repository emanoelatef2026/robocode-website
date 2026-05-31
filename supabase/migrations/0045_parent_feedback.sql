-- =============================================================================
-- SPRINT 27 — Parent Feedback System
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times.
-- =============================================================================

-- A1. Create parent_feedback table
CREATE TABLE IF NOT EXISTS public.parent_feedback (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id         UUID         NOT NULL REFERENCES public.parents(id)  ON DELETE CASCADE,
  student_id        UUID         NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_milestone INTEGER      NOT NULL CHECK (session_milestone > 0 AND session_milestone % 6 = 0),
  q1_yes            BOOLEAN      NOT NULL,
  q2_yes            BOOLEAN      NOT NULL,
  q3_yes            BOOLEAN      NOT NULL,
  q4_yes            BOOLEAN      NOT NULL,
  rating            SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes             TEXT,
  submitted_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT parent_feedback_unique_milestone UNIQUE (parent_id, student_id, session_milestone)
);

COMMENT ON TABLE public.parent_feedback IS
  'One parent feedback submission per milestone (every 6 completed sessions) per student. '
  'session_milestone stores the session count that triggered the feedback (6, 12, 18, ...).';

-- A2. Indexes
CREATE INDEX IF NOT EXISTS idx_parent_feedback_student
  ON public.parent_feedback (student_id);

CREATE INDEX IF NOT EXISTS idx_parent_feedback_parent
  ON public.parent_feedback (parent_id);

-- A3. Enable RLS
ALTER TABLE public.parent_feedback ENABLE ROW LEVEL SECURITY;

-- A4. Parents can INSERT their own feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_feedback'
      AND policyname = 'parent_feedback_insert'
  ) THEN
    CREATE POLICY "parent_feedback_insert"
      ON public.parent_feedback FOR INSERT
      WITH CHECK (
        parent_id IN (
          SELECT id FROM public.parents WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- A5. Parents can SELECT their own feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_feedback'
      AND policyname = 'parent_feedback_read_own'
  ) THEN
    CREATE POLICY "parent_feedback_read_own"
      ON public.parent_feedback FOR SELECT
      USING (
        parent_id IN (
          SELECT id FROM public.parents WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- A6. Admins / TLs can read all feedback (for analytics)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_feedback'
      AND policyname = 'parent_feedback_admin_read'
  ) THEN
    CREATE POLICY "parent_feedback_admin_read"
      ON public.parent_feedback FOR SELECT
      USING (
        public.user_has_permission(auth.uid(), 'manage_system')
        OR public.user_has_permission(auth.uid(), 'manage_students')
      );
  END IF;
END $$;

-- =============================================================================
-- VALIDATION
-- =============================================================================

SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'parent_feedback'
ORDER BY ordinal_position;
