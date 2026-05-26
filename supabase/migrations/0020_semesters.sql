-- Migration: 0020_semesters
-- Purpose: Academic years, semesters, semester enrollments, and course assignments
-- Dependencies: 0003_organization, 0004_people, 0005_academic (groups), 0006_curriculum, 0018_learning_tracks
--
-- Tables:
--   academic_years        — named academic periods (e.g. 2025-2026)
--   semesters             — a semester within an academic year; status-driven lifecycle
--   semester_enrollments  — first-class student ↔ semester membership
--   semester_courses      — courses offered in a semester (catalog-level)
--
-- Also adds the FK constraint on groups.semester_id (deferred from 0005 because
-- the semesters table did not exist there).
--
-- Future compatibility columns are present but nullable:
--   semester_enrollments.payment_status  → financials / subscriptions
--   semester_enrollments.certificate_id  → certificates
--   semesters.billing_cycle              → subscription billing

-- ─── Academic Years ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,          -- e.g. "2025-2026"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name),
  CONSTRAINT academic_year_dates CHECK (end_date > start_date)
);

COMMENT ON TABLE public.academic_years IS
  'Named academic years (e.g. 2025-2026). is_current marks the active year; '
  'application logic should enforce at-most-one current per org.';

-- Backfill columns that may be missing on pre-existing academic_years
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS org_id      UUID,
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS end_date    DATE,
  ADD COLUMN IF NOT EXISTS is_current  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── Semesters ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.semesters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  academic_year_id      UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,          -- e.g. "Spring 2026"
  slug                  TEXT NOT NULL,          -- e.g. "spring-2026"
  status                TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  enrollment_open_at    TIMESTAMPTZ,            -- when students can enroll
  enrollment_close_at   TIMESTAMPTZ,            -- enrollment deadline
  max_capacity          INTEGER,               -- NULL = unlimited
  notes                 TEXT,
  -- Future: subscription / billing integration
  billing_cycle         TEXT                   -- e.g. 'monthly', 'per_semester', 'annual'
                        CHECK (billing_cycle IN ('monthly', 'per_semester', 'annual', 'custom')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug),
  CONSTRAINT semester_dates CHECK (end_date > start_date)
);

COMMENT ON TABLE public.semesters IS
  'A semester within an academic year. status drives the enrollment lifecycle. '
  'billing_cycle is reserved for future subscription integration.';

-- Backfill columns that may be missing on pre-existing semesters
ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS org_id               UUID,
  ADD COLUMN IF NOT EXISTS academic_year_id     UUID,
  ADD COLUMN IF NOT EXISTS name                 TEXT,
  ADD COLUMN IF NOT EXISTS slug                 TEXT,
  ADD COLUMN IF NOT EXISTS status               TEXT NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS start_date           DATE,
  ADD COLUMN IF NOT EXISTS end_date             DATE,
  ADD COLUMN IF NOT EXISTS enrollment_open_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrollment_close_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_capacity         INTEGER,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle        TEXT,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- Seed: default org initial semester placeholder (idempotent, can be deleted after)
-- INSERT INTO public.semesters ... ON CONFLICT DO NOTHING — skipped intentionally;
-- semesters are created by admins, not seeded.

-- ─── Wire deferred FK: groups.semester_id → semesters ────────────────────────
-- groups.semester_id was declared as plain UUID in 0005 (the semesters table
-- did not exist at that point). Add the FK constraint now.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'groups_semester_id_fkey' AND conrelid = 'public.groups'::regclass
  ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_semester_id_fkey
      FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ─── Semester Enrollments ────────────────────────────────────────────────────
-- First-class student ↔ semester membership. Not inferred from groups.
-- A student can be enrolled in a semester independently of group assignments.

CREATE TABLE IF NOT EXISTS public.semester_enrollments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id    UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'enrolled'
                 CHECK (status IN ('enrolled', 'dropped', 'completed', 'paused')),
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  -- Future: financials integration
  payment_status TEXT NOT NULL DEFAULT 'pending'
                 CHECK (payment_status IN ('pending', 'paid', 'partial', 'waived', 'overdue')),
  -- Future: certificates integration
  certificate_id UUID REFERENCES public.student_certificates(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (semester_id, student_id)
);

COMMENT ON TABLE public.semester_enrollments IS
  'First-class student semester enrollment. Not inferred from group membership. '
  'payment_status is reserved for financials; certificate_id for auto-issued certs.';

-- ─── Semester Courses ────────────────────────────────────────────────────────
-- Catalog of courses offered in a semester. Separate from group_courses, which
-- assigns a course to a specific group. A course may appear in semester_courses
-- while being delivered by multiple groups in that semester.

CREATE TABLE IF NOT EXISTS public.semester_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (semester_id, course_id)
);

COMMENT ON TABLE public.semester_courses IS
  'Catalog: which courses are offered in a semester. '
  'Per-group delivery is tracked in group_courses via groups.semester_id.';

-- ─── Triggers: updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_semesters_updated_at
  BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_semester_enrollments_updated_at
  BEFORE UPDATE ON public.semester_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academic_years_org_id
  ON public.academic_years(org_id);

CREATE INDEX IF NOT EXISTS idx_academic_years_current
  ON public.academic_years(org_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_semesters_org_id
  ON public.semesters(org_id);

CREATE INDEX IF NOT EXISTS idx_semesters_academic_year
  ON public.semesters(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_semesters_status
  ON public.semesters(status);

CREATE INDEX IF NOT EXISTS idx_semester_enrollments_semester
  ON public.semester_enrollments(semester_id);

CREATE INDEX IF NOT EXISTS idx_semester_enrollments_student
  ON public.semester_enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_semester_enrollments_branch
  ON public.semester_enrollments(branch_id);

CREATE INDEX IF NOT EXISTS idx_semester_enrollments_status
  ON public.semester_enrollments(status);

CREATE INDEX IF NOT EXISTS idx_semester_courses_semester
  ON public.semester_courses(semester_id);

CREATE INDEX IF NOT EXISTS idx_semester_courses_course
  ON public.semester_courses(course_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.academic_years       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_courses     ENABLE ROW LEVEL SECURITY;

-- Academic years: all authenticated users can read; only admins can write
CREATE POLICY "academic_years_read"
  ON public.academic_years FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "academic_years_manage"
  ON public.academic_years FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));

-- Semesters: all authenticated users can read; admins write
CREATE POLICY "semesters_read"
  ON public.semesters FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "semesters_manage"
  ON public.semesters FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));

-- Semester enrollments: student sees own; parent sees child's; staff with manage_students
CREATE POLICY "semester_enrollments_self"
  ON public.semester_enrollments FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "semester_enrollments_parent"
  ON public.semester_enrollments FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "semester_enrollments_staff"
  ON public.semester_enrollments FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), 'manage_students', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

CREATE POLICY "semester_enrollments_manage"
  ON public.semester_enrollments FOR ALL
  USING (
    public.user_has_permission(auth.uid(), 'manage_students', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_students', branch_id)
    OR public.user_has_permission(auth.uid(), 'manage_system')
  );

-- Semester courses: all authenticated read; curriculum managers write
CREATE POLICY "semester_courses_read"
  ON public.semester_courses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "semester_courses_manage"
  ON public.semester_courses FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_curriculum'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_curriculum'));
