-- Migration: 0008_assessments
-- Purpose: Assignments, submissions, quizzes, grade summaries
-- Dependencies: 0006_curriculum

-- ─── Assignments ─────────────────────────────────────────────────────────────
-- An assignment can belong to a lesson OR a module (not both).
-- Use a check constraint to enforce this.
CREATE TABLE IF NOT EXISTS public.assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  module_id     UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  instructions  TEXT,
  type          TEXT NOT NULL DEFAULT 'homework'
                CHECK (type IN ('homework', 'classwork', 'project', 'quiz', 'exam')),
  max_score     NUMERIC(6, 2) NOT NULL DEFAULT 100,
  due_at        TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'closed')),
  allow_late    BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES public.users(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assignment_has_parent CHECK (
    (lesson_id IS NOT NULL AND module_id IS NULL)
    OR (lesson_id IS NULL AND module_id IS NOT NULL)
  )
);

-- ─── Submissions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  content         TEXT,                -- Written answer
  file_keys       TEXT[] NOT NULL DEFAULT '{}',  -- Supabase storage keys
  score           NUMERIC(6, 2),
  graded_by       UUID REFERENCES public.users(id),
  graded_at       TIMESTAMPTZ,
  feedback        TEXT,               -- Private feedback (student + instructor)
  public_feedback TEXT,              -- Visible on parent portal
  rubric_scores   JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN (
                    'submitted', 'under_review', 'graded', 'returned',
                    'resubmission_requested', 'resubmitted'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

-- ─── Grade Summaries (per student per group_course) ───────────────────────────
-- Maintained by a trigger whenever a submission is graded
CREATE TABLE IF NOT EXISTS public.student_grade_summaries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_course_id      UUID NOT NULL REFERENCES public.group_courses(id) ON DELETE CASCADE,
  total_assignments    INTEGER NOT NULL DEFAULT 0,
  submitted_count      INTEGER NOT NULL DEFAULT 0,
  graded_count         INTEGER NOT NULL DEFAULT 0,
  total_possible_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  earned_score         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  grade_percentage     NUMERIC(5, 2),
  last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, group_course_id)
);

-- ─── Quizzes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id           UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  instructions        TEXT,
  time_limit_minutes  INTEGER,         -- NULL = no time limit
  passing_score       NUMERIC(5, 2),   -- NULL = no pass threshold
  attempts_allowed    INTEGER NOT NULL DEFAULT 1,  -- -1 = unlimited
  is_published        BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('mcq', 'true_false', 'short_answer')),
  points      NUMERIC(5, 2) NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL,
  explanation TEXT,  -- shown after answering
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score        NUMERIC(6, 2),
  passed       BOOLEAN,
  answers      JSONB NOT NULL DEFAULT '{}',  -- {question_id: selected_option_id}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assignments_lesson_id  ON public.assignments(lesson_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_module_id  ON public.assignments(module_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_status     ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status     ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_grade_summaries_student ON public.student_grade_summaries(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student  ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz    ON public.quiz_questions(quiz_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_grade_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Submissions: students submit and view own; instructors view for their groups
CREATE POLICY "submissions_self"
  ON public.submissions FOR ALL
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "submissions_instructor_read"
  ON public.submissions FOR SELECT
  USING (
    assignment_id IN (
      SELECT a.id FROM public.assignments a
      JOIN public.lessons l ON l.id = a.lesson_id
      JOIN public.course_modules m ON m.id = l.module_id
      JOIN public.group_courses gc ON gc.course_id = m.course_id
      JOIN public.group_instructors gi ON gi.group_id = gc.group_id
      JOIN public.instructors i ON i.id = gi.instructor_id
      WHERE i.user_id = auth.uid()
    )
  );

CREATE POLICY "submissions_grade"
  ON public.submissions FOR UPDATE
  USING (public.user_has_permission(auth.uid(), 'grade_assignments'));

-- Parents can read grades of their child
CREATE POLICY "grade_summaries_parent_read"
  ON public.student_grade_summaries FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
      AND public.user_has_permission(auth.uid(), 'read_grades', s.branch_id)
    )
  );
