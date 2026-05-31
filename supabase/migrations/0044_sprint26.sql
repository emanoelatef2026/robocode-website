-- Migration: 0044_sprint26
-- Purpose: Portfolio upload by students + Session Feedback system
-- Depends on: 0023_portfolio_system, 0007_schedule_attendance

-- ─── 1. Portfolio projects: add category + status ─────────────────────────────

ALTER TABLE public.portfolio_projects
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other'
    CHECK (category IN ('Game','AI','Website','Robotics','Mobile App','Other')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','needs_improvement','featured'));

COMMENT ON COLUMN public.portfolio_projects.category IS 'Project category for showcase filtering.';
COMMENT ON COLUMN public.portfolio_projects.status   IS 'Review workflow: pending_review → approved/needs_improvement/featured.';

-- Sync is_featured with status=featured so existing queries still work
UPDATE public.portfolio_projects SET status = 'featured' WHERE is_featured = true AND is_archived = false;

-- ─── 2. RLS: students can self-manage their own portfolio projects ─────────────
-- Existing policies only allow manage_portfolio (admin) or read-only.
-- Students need INSERT + UPDATE on their own rows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_projects' AND policyname = 'portfolio_projects_student_insert'
  ) THEN
    CREATE POLICY "portfolio_projects_student_insert"
      ON public.portfolio_projects FOR INSERT
      WITH CHECK (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_projects' AND policyname = 'portfolio_projects_student_update'
  ) THEN
    CREATE POLICY "portfolio_projects_student_update"
      ON public.portfolio_projects FOR UPDATE
      USING  (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()))
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
  END IF;
END $$;

-- student_portfolios: students need INSERT to create their own portfolio record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'student_portfolios' AND policyname = 'portfolio_student_insert'
  ) THEN
    CREATE POLICY "portfolio_student_insert"
      ON public.student_portfolios FOR INSERT
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ─── 3. Storage bucket: portfolio-images ──────────────────────────────────────
-- Creates the bucket if it does not exist.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-images',
  'portfolio-images',
  true,
  524288,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (anyone can view project images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'portfolio_images_public_read'
  ) THEN
    CREATE POLICY "portfolio_images_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'portfolio-images');
  END IF;
END $$;

-- Authenticated users can upload (students upload via API route with service key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'portfolio_images_auth_insert'
  ) THEN
    CREATE POLICY "portfolio_images_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'portfolio-images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Owner can delete their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'portfolio_images_owner_delete'
  ) THEN
    CREATE POLICY "portfolio_images_owner_delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'portfolio-images'
        AND owner = auth.uid()
      );
  END IF;
END $$;

-- ─── 4. session_feedback table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_feedback (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID      NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id   UUID      NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  -- Three 1-5 star questions
  q1_score     SMALLINT  NOT NULL CHECK (q1_score BETWEEN 1 AND 5),
  q2_score     SMALLINT  NOT NULL CHECK (q2_score BETWEEN 1 AND 5),
  q3_score     SMALLINT  NOT NULL CHECK (q3_score BETWEEN 1 AND 5),
  comment      TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One submission per student per session
  UNIQUE (schedule_id, student_id)
);

COMMENT ON TABLE public.session_feedback IS
  'Anonymous star ratings (1-5) per student per completed session. '
  'Instructors see only aggregates. TL can see full detail.';

CREATE INDEX IF NOT EXISTS idx_session_feedback_schedule
  ON public.session_feedback(schedule_id);

CREATE INDEX IF NOT EXISTS idx_session_feedback_student
  ON public.session_feedback(student_id);

-- ─── 5. session_feedback RLS ──────────────────────────────────────────────────

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

-- Students: insert own feedback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_feedback' AND policyname = 'feedback_student_insert'
  ) THEN
    CREATE POLICY "feedback_student_insert"
      ON public.session_feedback FOR INSERT
      WITH CHECK (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Students: read own feedback (to detect if already submitted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_feedback' AND policyname = 'feedback_student_read_own'
  ) THEN
    CREATE POLICY "feedback_student_read_own"
      ON public.session_feedback FOR SELECT
      USING (
        student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Admins / TL: full access (service role bypasses RLS anyway, but for completeness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_feedback' AND policyname = 'feedback_admin_all'
  ) THEN
    CREATE POLICY "feedback_admin_all"
      ON public.session_feedback FOR ALL
      USING (
        public.user_has_permission(auth.uid(), 'manage_system')
        OR public.user_has_permission(auth.uid(), 'manage_attendance')
      )
      WITH CHECK (
        public.user_has_permission(auth.uid(), 'manage_system')
        OR public.user_has_permission(auth.uid(), 'manage_attendance')
      );
  END IF;
END $$;
