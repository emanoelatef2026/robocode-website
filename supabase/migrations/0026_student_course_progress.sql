-- Migration: 0026_student_course_progress
-- Purpose: Academic progress tracking per student per course per semester
-- Dependencies: 0004_people, 0005_academic, 0006_curriculum, 0007_schedule_attendance,
--               0008_assessments, 0019_grade_triggers, 0020_semesters, 0023_portfolio_system
--
-- Tables:
--   student_course_progress — aggregated snapshot updated by calculateStudentProgress()
--
-- Design notes:
--   * One row per (student, course, semester) — unique constraint enforces this.
--   * group_id is required to scope attendance lookups to the correct schedules.
--   * All component scores are 0–100 percentages.
--   * completion_percentage is a weighted aggregate:
--       attendance (40%) + assignment (40%) + portfolio (20%)
--   * status transitions: active → completed | failed (triggered on semester close).
--   * last_calculated_at tracks staleness; the service refreshes on grade/submission events.
--   * The service role bypasses RLS entirely — no service-role policy needed.
--
-- Also seeds missing academic permissions (manage_assignments, grade_assignments,
-- read_grades) using ON CONFLICT DO NOTHING so the migration is idempotent.

-- ─── student_course_progress ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_course_progress (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID         NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  course_id             UUID         NOT NULL REFERENCES public.courses(id)   ON DELETE CASCADE,
  semester_id           UUID         NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  -- group_id scopes attendance to the correct group_courses + schedules
  group_id              UUID         NOT NULL REFERENCES public.groups(id)    ON DELETE CASCADE,
  -- Component scores: 0–100 each
  attendance_score      NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (attendance_score  BETWEEN 0 AND 100),
  assignment_score      NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (assignment_score  BETWEEN 0 AND 100),
  portfolio_score       NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (portfolio_score   BETWEEN 0 AND 100),
  -- Weighted aggregate: attendance 40% + assignment 40% + portfolio 20%
  completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (completion_percentage BETWEEN 0 AND 100),
  -- Lifecycle status
  status                TEXT         NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'failed')),
  -- Staleness tracking
  last_calculated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- One progress row per student per course per semester
  UNIQUE (student_id, course_id, semester_id)
);

COMMENT ON TABLE public.student_course_progress IS
  'Aggregated academic progress per student per course per semester. '
  'Refreshed by calculateStudentProgress() on grade events and manual triggers.';

COMMENT ON COLUMN public.student_course_progress.completion_percentage IS
  'Weighted aggregate: attendance_score * 0.4 + assignment_score * 0.4 + portfolio_score * 0.2';

-- ─── Trigger: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_student_course_progress_updated_at
  BEFORE UPDATE ON public.student_course_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scp_student
  ON public.student_course_progress(student_id);

CREATE INDEX IF NOT EXISTS idx_scp_course
  ON public.student_course_progress(course_id);

CREATE INDEX IF NOT EXISTS idx_scp_semester
  ON public.student_course_progress(semester_id);

CREATE INDEX IF NOT EXISTS idx_scp_group
  ON public.student_course_progress(group_id);

CREATE INDEX IF NOT EXISTS idx_scp_status
  ON public.student_course_progress(status);

CREATE INDEX IF NOT EXISTS idx_scp_student_semester
  ON public.student_course_progress(student_id, semester_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.student_course_progress ENABLE ROW LEVEL SECURITY;

-- Student: read own progress
CREATE POLICY "scp_self_read"
  ON public.student_course_progress FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Parent: read linked child's progress
CREATE POLICY "scp_parent_read"
  ON public.student_course_progress FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id
      FROM   public.parent_students ps
      JOIN   public.parents         p  ON p.id = ps.parent_id
      WHERE  p.user_id = auth.uid()
    )
  );

-- Instructor: read progress of students in groups they teach
CREATE POLICY "scp_instructor_read"
  ON public.student_course_progress FOR SELECT
  USING (
    group_id IN (
      SELECT gi.group_id
      FROM   public.group_instructors gi
      JOIN   public.instructors        i  ON i.id = gi.instructor_id
      WHERE  i.user_id = auth.uid()
    )
  );

-- Admin / team_leader: full management
CREATE POLICY "scp_admin_all"
  ON public.student_course_progress FOR ALL
  USING (
    public.user_has_permission(auth.uid(), 'manage_system')
    OR public.user_has_permission(auth.uid(), 'manage_students')
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_system')
    OR public.user_has_permission(auth.uid(), 'manage_students')
  );

-- ─── Seed missing academic permissions ───────────────────────────────────────
-- These exist in TypeScript (modules/rbac/permissions.ts) but were never seeded.
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO public.permissions (name, description, category) VALUES
  ('manage_assignments', 'Create, edit, publish, and delete course assignments',    'academic'),
  ('grade_assignments',  'Review and grade student assignment submissions',          'academic'),
  ('read_grades',        'View assignment grades and submission scores',             'academic')
ON CONFLICT (name) DO NOTHING;

-- Assign manage_assignments: super_admin, team_leader, instructor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
CROSS  JOIN public.permissions p
WHERE  r.name IN ('super_admin', 'team_leader', 'instructor')
  AND  p.name = 'manage_assignments'
ON CONFLICT DO NOTHING;

-- Assign grade_assignments: super_admin, team_leader, instructor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
CROSS  JOIN public.permissions p
WHERE  r.name IN ('super_admin', 'team_leader', 'instructor')
  AND  p.name = 'grade_assignments'
ON CONFLICT DO NOTHING;

-- Assign read_grades: all roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles       r
CROSS  JOIN public.permissions p
WHERE  r.name IN ('super_admin', 'team_leader', 'instructor', 'student', 'parent')
  AND  p.name = 'read_grades'
ON CONFLICT DO NOTHING;
