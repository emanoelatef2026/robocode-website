-- Migration: 0005_academic
-- Purpose: Groups, cohorts, and group membership
-- Dependencies: 0004_people

-- ─── Groups ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  semester_id       UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  code              TEXT,
  type              TEXT NOT NULL DEFAULT 'class'
                    CHECK (type IN ('class', 'workshop', 'bootcamp', 'trial', 'makeup')),
  capacity          INTEGER,
  waitlist_capacity INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'forming'
                    CHECK (status IN ('forming', 'active', 'completed', 'cancelled')),
  metadata          JSONB NOT NULL DEFAULT '{}',
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Group-Student enrollment ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'dropped', 'graduated', 'paused', 'waitlisted')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  notes       TEXT,
  UNIQUE (group_id, student_id)
);

-- ─── Group-Instructor assignment ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_instructors (
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'lead' CHECK (role IN ('lead', 'assistant')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, instructor_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_branch_id       ON public.groups(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_semester_id     ON public.groups(semester_id);
CREATE INDEX IF NOT EXISTS idx_groups_status          ON public.groups(status);
CREATE INDEX IF NOT EXISTS idx_group_students_group   ON public.group_students(group_id);
CREATE INDEX IF NOT EXISTS idx_group_students_student ON public.group_students(student_id);
CREATE INDEX IF NOT EXISTS idx_group_instructors_inst ON public.group_instructors(instructor_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_read_by_branch_member"
  ON public.groups FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = auth.uid() AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "groups_write_by_staff"
  ON public.groups FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_groups', branch_id))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_groups', branch_id));

-- Students see their own group memberships
CREATE POLICY "group_students_read_own"
  ON public.group_students FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND public.user_has_permission(auth.uid(), 'manage_groups', g.branch_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE ps.student_id = group_students.student_id
      AND p.user_id = auth.uid()
    )
  );

-- Instructors see groups they're assigned to
CREATE POLICY "group_instructors_read"
  ON public.group_instructors FOR SELECT
  USING (
    instructor_id IN (
      SELECT id FROM public.instructors WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id
      AND public.user_has_permission(auth.uid(), 'manage_groups', g.branch_id)
    )
  );
