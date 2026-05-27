-- Migration: 0023_portfolio_system
-- Purpose: Student portfolio system — projects, achievements, badges
-- Dependencies: 0004_people (students), 0006_curriculum (courses),
--               0008_assessments (submissions), 0020_semesters
--
-- Tables:
--   student_portfolios    — one per student; lazy-created on first project add
--   portfolio_projects    — individual projects (from submissions or manual)
--   student_achievements  — achievements (competition wins, certificates, etc.)
--   student_badges        — micro-credentials / badges
--
-- Design notes:
--   * portfolio_projects.submission_id links back to the originating submission
--     (NULL for manually created projects)
--   * is_public gates visibility on future public-facing portfolio pages
--   * is_featured surfaces the project in showcase / parent reporting
--   * sort_order allows admin to reorder; default 0 = newest-first fallback
--   * All mutations write to audit_log via application layer
--   * Future-compat columns: ai_score, university_note, competition_id

-- ─── student_portfolios ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_portfolios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  bio        TEXT,
  is_public  BOOLEAN NOT NULL DEFAULT false,
  -- future: ai_summary TEXT, public_slug TEXT UNIQUE
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_portfolios IS
  'One portfolio per student. Lazy-created when the first project is added.';

-- ─── portfolio_projects ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.portfolio_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id        UUID NOT NULL REFERENCES public.student_portfolios(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id)            ON DELETE CASCADE,
  -- origin: null = manually created; set = promoted from a graded submission
  submission_id       UUID REFERENCES public.submissions(id)  ON DELETE SET NULL,
  -- context
  semester_id         UUID REFERENCES public.semesters(id)    ON DELETE SET NULL,
  course_id           UUID REFERENCES public.courses(id)      ON DELETE SET NULL,
  -- content
  title               TEXT NOT NULL,
  description         TEXT,
  thumbnail_url       TEXT,
  gallery_images      TEXT[] NOT NULL DEFAULT '{}',
  github_url          TEXT,
  drive_url           TEXT,
  video_url           TEXT,
  project_url         TEXT,
  -- grading snapshot (copied from submission at promotion time; editable later)
  instructor_feedback TEXT,
  final_score         NUMERIC(6,2),
  -- visibility & display
  is_featured         BOOLEAN NOT NULL DEFAULT false,
  is_public           BOOLEAN NOT NULL DEFAULT false,
  is_archived         BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  -- bookkeeping
  created_by          UUID REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portfolio_projects IS
  'Student portfolio projects. submission_id links to the originating submission '
  'for promoted projects; NULL for manually created entries.';

-- ─── student_achievements ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_achievements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  portfolio_id     UUID REFERENCES public.student_portfolios(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  achievement_type TEXT NOT NULL DEFAULT 'custom'
                   CHECK (achievement_type IN (
                     'project', 'competition', 'certificate',
                     'leadership', 'attendance', 'innovation', 'custom'
                   )),
  date_awarded     DATE NOT NULL DEFAULT CURRENT_DATE,
  image_url        TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  -- future: certificate_id UUID REFERENCES student_certificates(id)
  -- future: competition_id UUID
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_achievements IS
  'Achievements awarded to a student (competition wins, certificates, leadership, etc.).';

-- ─── student_badges ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_badges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.students(id)          ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.student_portfolios(id) ON DELETE SET NULL,
  badge_name   TEXT NOT NULL,
  badge_image  TEXT,
  description  TEXT,
  awarded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_badges IS
  'Micro-credentials / badges awarded to a student.';

-- ─── Triggers: updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_student_portfolios_updated_at
  BEFORE UPDATE ON public.student_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_portfolio_projects_updated_at
  BEFORE UPDATE ON public.portfolio_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_student_achievements_updated_at
  BEFORE UPDATE ON public.student_achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_student_portfolios_student
  ON public.student_portfolios(student_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_portfolio
  ON public.portfolio_projects(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_student
  ON public.portfolio_projects(student_id) WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_featured
  ON public.portfolio_projects(student_id) WHERE is_featured = true AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_submission
  ON public.portfolio_projects(submission_id) WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_course
  ON public.portfolio_projects(course_id) WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_achievements_student
  ON public.student_achievements(student_id);

CREATE INDEX IF NOT EXISTS idx_student_achievements_type
  ON public.student_achievements(achievement_type);

CREATE INDEX IF NOT EXISTS idx_student_badges_student
  ON public.student_badges(student_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.student_portfolios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges       ENABLE ROW LEVEL SECURITY;

-- student_portfolios ──────────────────────────────────────────────────────────

-- Student reads own
CREATE POLICY "portfolio_self_read"
  ON public.student_portfolios FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Parent reads linked child's
CREATE POLICY "portfolio_parent_read"
  ON public.student_portfolios FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Instructor reads portfolios of students in their groups
CREATE POLICY "portfolio_instructor_read"
  ON public.student_portfolios FOR SELECT
  USING (
    student_id IN (
      SELECT gs.student_id
      FROM public.group_students gs
      JOIN public.group_courses gc ON gc.group_id = gs.group_id
      JOIN public.instructors i ON i.id = (
        SELECT gi.instructor_id FROM public.group_instructors gi
        WHERE gi.group_id = gs.group_id LIMIT 1
      )
      WHERE i.user_id = auth.uid()
        AND gs.status = 'active'
    )
  );

-- Admin / staff full management
CREATE POLICY "portfolio_admin_all"
  ON public.student_portfolios FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_students'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_students'));

-- portfolio_projects ──────────────────────────────────────────────────────────

CREATE POLICY "portfolio_projects_self_read"
  ON public.portfolio_projects FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "portfolio_projects_parent_read"
  ON public.portfolio_projects FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "portfolio_projects_public_read"
  ON public.portfolio_projects FOR SELECT
  USING (is_public = true AND is_archived = false);

CREATE POLICY "portfolio_projects_admin_all"
  ON public.portfolio_projects FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_students'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_students'));

-- student_achievements ────────────────────────────────────────────────────────

CREATE POLICY "achievements_self_read"
  ON public.student_achievements FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "achievements_parent_read"
  ON public.student_achievements FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "achievements_admin_all"
  ON public.student_achievements FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_students'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_students'));

-- student_badges ──────────────────────────────────────────────────────────────

CREATE POLICY "badges_self_read"
  ON public.student_badges FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "badges_parent_read"
  ON public.student_badges FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "badges_admin_all"
  ON public.student_badges FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_students'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_students'));
