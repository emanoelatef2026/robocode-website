-- =============================================================================
-- SPRINT 27.5 — Parent Messages (Contact Team Leader)
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times.
-- =============================================================================

-- A1. Create table
CREATE TABLE IF NOT EXISTS public.parent_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id  UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  student_id      UUID                    REFERENCES public.students(id) ON DELETE SET NULL,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id)  ON DELETE CASCADE,
  category        TEXT        NOT NULL CHECK (category IN (
    'general_comment', 'suggestion', 'academic_concern',
    'instructor_feedback', 'schedule_request', 'technical_issue', 'other'
  )),
  message         TEXT        NOT NULL CHECK (char_length(message) >= 10),
  image_url       TEXT,
  status          TEXT        NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'resolved'
  )),
  internal_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parent_messages IS
  'Parent contact messages to the Team Leader. '
  'status lifecycle: submitted → under_review → resolved.';

-- A2. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_parent_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_parent_messages_updated_at'
  ) THEN
    CREATE TRIGGER trg_parent_messages_updated_at
      BEFORE UPDATE ON public.parent_messages
      FOR EACH ROW EXECUTE FUNCTION public.set_parent_messages_updated_at();
  END IF;
END $$;

-- A3. Indexes
CREATE INDEX IF NOT EXISTS idx_parent_messages_parent   ON public.parent_messages (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_branch   ON public.parent_messages (branch_id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_status   ON public.parent_messages (status);
CREATE INDEX IF NOT EXISTS idx_parent_messages_created  ON public.parent_messages (created_at DESC);

-- A4. Enable RLS
ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

-- A5. Parents: INSERT own messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_messages'
      AND policyname = 'parent_messages_insert'
  ) THEN
    CREATE POLICY "parent_messages_insert"
      ON public.parent_messages FOR INSERT
      WITH CHECK (parent_user_id = auth.uid());
  END IF;
END $$;

-- A6. Parents: SELECT own messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'parent_messages'
      AND policyname = 'parent_messages_select_own'
  ) THEN
    CREATE POLICY "parent_messages_select_own"
      ON public.parent_messages FOR SELECT
      USING (parent_user_id = auth.uid());
  END IF;
END $$;

-- =============================================================================
-- VALIDATION
-- =============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'parent_messages'
ORDER BY ordinal_position;
