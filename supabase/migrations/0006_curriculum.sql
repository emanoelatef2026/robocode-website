-- Migration: 0006_curriculum
-- Purpose: Courses, modules, lessons, resources, group-course assignments
-- Dependencies: 0005_academic

-- ─── Courses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  -- NULL branch_id = global template (managed by super_admin)
  title           TEXT NOT NULL,
  description     TEXT,
  code            TEXT,
  category        TEXT,
  level           TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  estimated_hours INTEGER,
  thumbnail_url   TEXT,
  scope           TEXT NOT NULL DEFAULT 'branch'
                  CHECK (scope IN ('branch', 'template', 'global')),
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES public.users(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Course-Group assignment ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  start_date    DATE,
  end_date      DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, course_id)
);

-- ─── Course Modules ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  order_index  INTEGER NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, order_index)
);

-- ─── Lessons ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          JSONB,           -- rich content: {type, blocks[]}
  type             TEXT NOT NULL DEFAULT 'text'
                   CHECK (type IN ('video', 'text', 'live', 'quiz', 'mixed')),
  duration_minutes INTEGER,
  order_index      INTEGER NOT NULL,
  -- External video: YouTube, Vimeo, or Google Drive link
  -- We do NOT store video files in Supabase Storage for educational videos
  video_url        TEXT,
  video_provider   TEXT CHECK (video_provider IN ('youtube', 'vimeo', 'google_drive', 'other')),
  video_id         TEXT,            -- provider-specific video ID for embed
  is_published     BOOLEAN NOT NULL DEFAULT false,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, order_index)
);

-- ─── Lesson Resources (attachments) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('pdf', 'link', 'video', 'image', 'other')),
  url           TEXT,             -- external URL or Supabase signed URL path
  storage_key   TEXT,            -- Supabase storage key (if file stored there)
  size_bytes    BIGINT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Lesson Completions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id          UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_spent_seconds INTEGER,
  UNIQUE (lesson_id, student_id)
);

-- ─── Student Progress (per group_course) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_course_id       UUID NOT NULL REFERENCES public.group_courses(id) ON DELETE CASCADE,
  completed_lessons     INTEGER NOT NULL DEFAULT 0,
  total_lessons         INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  last_activity_at      TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  UNIQUE (student_id, group_course_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_branch_id          ON public.courses(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_scope              ON public.courses(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_courses_group_id     ON public.group_courses(group_id);
CREATE INDEX IF NOT EXISTS idx_group_courses_course_id    ON public.group_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_group_courses_instructor   ON public.group_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_id   ON public.course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id          ON public.lessons(module_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_completions_student ON public.lesson_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson  ON public.lesson_completions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_student   ON public.student_progress(student_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

-- Courses: readable by branch members; global/template readable by all authenticated
CREATE POLICY "courses_read"
  ON public.courses FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published = true
    AND (
      scope IN ('global', 'template')
      OR branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = auth.uid() AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "courses_manage"
  ON public.courses FOR ALL
  USING (
    public.user_has_permission(auth.uid(), 'manage_courses', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

-- Lessons: students in enrolled groups can read published lessons
CREATE POLICY "lessons_read_by_enrolled_student"
  ON public.lessons FOR SELECT
  USING (
    deleted_at IS NULL
    AND is_published = true
    AND module_id IN (
      SELECT m.id FROM public.course_modules m
      JOIN public.group_courses gc ON gc.course_id = m.course_id
      JOIN public.group_students gs ON gs.group_id = gc.group_id
      JOIN public.students s ON s.id = gs.student_id
      WHERE s.user_id = auth.uid()
      AND gs.status = 'active'
    )
  );

-- Lesson completions: student sees own
CREATE POLICY "lesson_completions_self"
  ON public.lesson_completions FOR ALL
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- Progress: student + parent + branch staff
CREATE POLICY "student_progress_read"
  ON public.student_progress FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
      AND public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
    )
  );
