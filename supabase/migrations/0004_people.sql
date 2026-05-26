-- Migration: 0004_people
-- Purpose: Students, instructors, parents, and parent-student relationships
-- Dependencies: 0003_organization

-- ─── Students ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id         UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  student_code      TEXT,              -- human-readable ID e.g. "STU-2026-001"
  enrollment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'graduated', 'paused', 'banned')),
  notes             TEXT,
  emergency_contact JSONB NOT NULL DEFAULT '{}',  -- {name, phone, relationship}
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

-- ─── Instructors ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instructors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  employee_id     TEXT,
  hire_date       DATE,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'on_leave')),
  specializations TEXT[] NOT NULL DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

-- ─── Parents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Parent-Student relationships ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_students (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                   UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id                  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship                TEXT NOT NULL DEFAULT 'guardian'
                              CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary                  BOOLEAN NOT NULL DEFAULT false,
  can_view_financials         BOOLEAN NOT NULL DEFAULT true,
  can_receive_notifications   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_branch_id    ON public.students(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_user_id      ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_status       ON public.students(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_instructors_branch_id ON public.instructors(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_instructors_user_id   ON public.instructors(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_user_id       ON public.parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_pid   ON public.parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_sid   ON public.parent_students(student_id);

-- Search: full-text index on profile name (joined via view or function later)
-- Actual FTS indexes added in 0014_search_indexes.sql

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- Students: visible to branch staff or the student themselves
CREATE POLICY "students_read_by_branch_staff"
  ON public.students FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_students', branch_id)
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "students_read_by_parent"
  ON public.students FOR SELECT
  USING (
    deleted_at IS NULL
    AND id IN (
      SELECT ps.student_id
      FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "students_write_by_staff"
  ON public.students FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_students', branch_id));

CREATE POLICY "students_update_by_staff"
  ON public.students FOR UPDATE
  USING (public.user_has_permission(auth.uid(), 'manage_students', branch_id));

-- Instructors: visible to branch staff
CREATE POLICY "instructors_read_by_branch_staff"
  ON public.instructors FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_instructors', branch_id)
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

-- Parent: can view their own parent record
CREATE POLICY "parents_self_read"
  ON public.parents FOR SELECT
  USING (user_id = auth.uid());

-- parent_students: parent sees their own links; staff sees all in their branch
CREATE POLICY "parent_students_read"
  ON public.parent_students FOR SELECT
  USING (
    parent_id IN (
      SELECT id FROM public.parents WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
      AND public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
    )
  );
