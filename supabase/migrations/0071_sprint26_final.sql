-- =============================================================================
-- SPRINT 26 FINAL — Portfolio + Session Feedback Production SQL
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times. Uses IF NOT EXISTS everywhere.
-- Run in Supabase SQL Editor.
-- =============================================================================



-- =============================================================================
-- SECTION A: STORAGE — portfolio-images bucket
-- =============================================================================

-- A1. Create bucket (skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-images',
  'portfolio-images',
  true,
  524288,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 524288,
      allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- A2. Public read policy (anyone can view portfolio images)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'portfolio_images_public_read'
  ) THEN
    CREATE POLICY "portfolio_images_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'portfolio-images');
  END IF;
END $$;

-- A3. Authenticated users can upload (upload route uses service role, but this
--     allows direct client uploads if ever needed)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
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

-- A4. Owner can delete their own images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
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



-- =============================================================================
-- SECTION B: PORTFOLIO — portfolio_projects columns + RLS
-- =============================================================================

-- B1. Add `category` column (safe — skipped if already exists)
ALTER TABLE public.portfolio_projects
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other';

-- B2. Add CHECK constraint for category (safe add if not present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage cu
      ON cu.constraint_name = cc.constraint_name
    WHERE cu.table_schema = 'public'
      AND cu.table_name   = 'portfolio_projects'
      AND cu.column_name  = 'category'
      AND cc.check_clause LIKE '%Game%'
  ) THEN
    ALTER TABLE public.portfolio_projects
      ADD CONSTRAINT portfolio_projects_category_check
        CHECK (category IN ('Game','AI','Website','Robotics','Mobile App','Other'));
  END IF;
END $$;

-- B3. Add `status` column (safe — skipped if already exists)
ALTER TABLE public.portfolio_projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';

-- B4. Add CHECK constraint for status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage cu
      ON cu.constraint_name = cc.constraint_name
    WHERE cu.table_schema = 'public'
      AND cu.table_name   = 'portfolio_projects'
      AND cu.column_name  = 'status'
      AND cc.check_clause LIKE '%pending_review%'
  ) THEN
    ALTER TABLE public.portfolio_projects
      ADD CONSTRAINT portfolio_projects_status_check
        CHECK (status IN ('pending_review','approved','needs_improvement','featured'));
  END IF;
END $$;

-- B5. Sync is_featured = true → status = 'featured' for existing rows
UPDATE public.portfolio_projects
  SET status = 'featured'
  WHERE is_featured = true
    AND is_archived  = false
    AND status       = 'pending_review';

-- B5b. Ensure RLS is enabled (idempotent — already done in 0023, but explicit for safety)
ALTER TABLE public.portfolio_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_portfolios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- B6. Index on status (for instructor review queue)
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_status
  ON public.portfolio_projects(status)
  WHERE is_archived = false;

-- B7. RLS — students can INSERT their own portfolio_projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'portfolio_projects'
      AND policyname = 'portfolio_projects_student_insert'
  ) THEN
    CREATE POLICY "portfolio_projects_student_insert"
      ON public.portfolio_projects FOR INSERT
      WITH CHECK (
        student_id IN (
          SELECT id FROM public.students WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- B8. RLS — students can UPDATE their own portfolio_projects
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'portfolio_projects'
      AND policyname = 'portfolio_projects_student_update'
  ) THEN
    CREATE POLICY "portfolio_projects_student_update"
      ON public.portfolio_projects FOR UPDATE
      USING  (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()))
      WITH CHECK (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));
  END IF;
END $$;

-- B9. RLS — students can INSERT their own student_portfolios record
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_portfolios'
      AND policyname = 'portfolio_student_insert'
  ) THEN
    CREATE POLICY "portfolio_student_insert"
      ON public.student_portfolios FOR INSERT
      WITH CHECK (
        student_id IN (
          SELECT id FROM public.students WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- B10. RLS — instructors can UPDATE portfolio_projects for students in their groups
--      (needed for reviewPortfolioProject action if ever called with anon client)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'portfolio_projects'
      AND policyname = 'portfolio_projects_instructor_update'
  ) THEN
    CREATE POLICY "portfolio_projects_instructor_update"
      ON public.portfolio_projects FOR UPDATE
      USING (
        student_id IN (
          SELECT gs.student_id
          FROM public.group_students gs
          JOIN public.group_courses gc ON gc.group_id = gs.group_id
          JOIN public.instructors i ON (
            i.id = gc.instructor_id
            OR EXISTS (
              SELECT 1 FROM public.group_instructors gi
              WHERE gi.group_id = gs.group_id AND gi.instructor_id = i.id
            )
          )
          WHERE i.user_id = auth.uid()
            AND gs.status = 'active'
        )
      );
  END IF;
END $$;

-- B11. RLS — instructors can SELECT portfolio_projects for students in their groups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'portfolio_projects'
      AND policyname = 'portfolio_projects_instructor_read'
  ) THEN
    CREATE POLICY "portfolio_projects_instructor_read"
      ON public.portfolio_projects FOR SELECT
      USING (
        student_id IN (
          SELECT gs.student_id
          FROM public.group_students gs
          JOIN public.group_courses gc ON gc.group_id = gs.group_id
          JOIN public.instructors i ON (
            i.id = gc.instructor_id
            OR EXISTS (
              SELECT 1 FROM public.group_instructors gi
              WHERE gi.group_id = gs.group_id AND gi.instructor_id = i.id
            )
          )
          WHERE i.user_id = auth.uid()
            AND gs.status = 'active'
        )
      );
  END IF;
END $$;



-- =============================================================================
-- SECTION C: SESSION FEEDBACK TABLE
-- =============================================================================

-- C1. Create table
CREATE TABLE IF NOT EXISTS public.session_feedback (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID      NOT NULL REFERENCES public.schedules(id)  ON DELETE CASCADE,
  student_id   UUID      NOT NULL REFERENCES public.students(id)   ON DELETE CASCADE,
  q1_score     SMALLINT  NOT NULL CHECK (q1_score  BETWEEN 1 AND 5),
  q2_score     SMALLINT  NOT NULL CHECK (q2_score  BETWEEN 1 AND 5),
  q3_score     SMALLINT  NOT NULL CHECK (q3_score  BETWEEN 1 AND 5),
  comment      TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT session_feedback_unique_submission UNIQUE (schedule_id, student_id)
);

COMMENT ON TABLE public.session_feedback IS
  'One star-rating submission per student per completed session. '
  'Instructors see aggregates only. TL/Admin see full data.';

-- C2. Indexes
CREATE INDEX IF NOT EXISTS idx_session_feedback_schedule
  ON public.session_feedback (schedule_id);

CREATE INDEX IF NOT EXISTS idx_session_feedback_student
  ON public.session_feedback (student_id);

-- C3. Enable RLS
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

-- C4. Students can INSERT their own feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'session_feedback'
      AND policyname = 'feedback_student_insert'
  ) THEN
    CREATE POLICY "feedback_student_insert"
      ON public.session_feedback FOR INSERT
      WITH CHECK (
        student_id IN (
          SELECT id FROM public.students WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- C5. Students can SELECT their own feedback (to detect if already submitted)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'session_feedback'
      AND policyname = 'feedback_student_read_own'
  ) THEN
    CREATE POLICY "feedback_student_read_own"
      ON public.session_feedback FOR SELECT
      USING (
        student_id IN (
          SELECT id FROM public.students WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- C6. Admins and users with manage_system or manage_attendance can do everything
--     (Instructors use service role which bypasses RLS, but this covers TL direct queries)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'session_feedback'
      AND policyname = 'feedback_admin_all'
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



-- =============================================================================
-- SECTION D: VALIDATION — verify every required object exists
-- =============================================================================

-- D1. Storage bucket
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'portfolio-images')
    THEN 'PASS: bucket portfolio-images EXISTS'
    ELSE 'FAIL: bucket portfolio-images MISSING'
  END AS storage_bucket_check;

-- D2. portfolio_projects columns
SELECT
  column_name,
  data_type,
  column_default,
  'EXISTS' AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'portfolio_projects'
  AND column_name  IN ('id','student_id','title','description','thumbnail_url',
                       'project_url','video_url','instructor_feedback','final_score',
                       'is_featured','is_public','is_archived','sort_order',
                       'created_at','updated_at','category','status')
ORDER BY column_name;

-- D3. session_feedback table + columns
SELECT
  column_name,
  data_type,
  'EXISTS' AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'session_feedback'
ORDER BY ordinal_position;

-- D4. UNIQUE constraint on session_feedback
SELECT
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_schema     = 'public'
      AND table_name       = 'session_feedback'
      AND constraint_name  = 'session_feedback_unique_submission'
  )
    THEN 'PASS: UNIQUE(schedule_id, student_id) EXISTS'
    ELSE 'FAIL: UNIQUE constraint MISSING'
  END AS unique_constraint_check;

-- D5. RLS policies for portfolio_projects
SELECT policyname, cmd, 'EXISTS' AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'portfolio_projects'
  AND policyname IN (
    'portfolio_projects_student_insert',
    'portfolio_projects_student_update',
    'portfolio_projects_instructor_read',
    'portfolio_projects_instructor_update',
    'portfolio_projects_admin_all'
  )
ORDER BY policyname;

-- D6. RLS policies for session_feedback
SELECT policyname, cmd, 'EXISTS' AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'session_feedback'
ORDER BY policyname;

-- D7. Storage policies
SELECT policyname, cmd, 'EXISTS' AS result
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
  AND policyname IN (
    'portfolio_images_public_read',
    'portfolio_images_auth_insert',
    'portfolio_images_owner_delete'
  )
ORDER BY policyname;

-- D8. Indexes
SELECT
  indexname,
  'EXISTS' AS result
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  IN ('portfolio_projects', 'session_feedback')
  AND indexname  IN (
    'idx_portfolio_projects_status',
    'idx_session_feedback_schedule',
    'idx_session_feedback_student'
  )
ORDER BY indexname;

-- =============================================================================
-- END — If all D* queries return EXISTS/PASS, the system is production-ready.
-- =============================================================================
