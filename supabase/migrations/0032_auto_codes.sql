-- Migration: 0032_auto_codes
-- Purpose: DB-generated immutable codes for every entity type.
--   STU-000001  students.student_code   (existing column, was nullable/manual)
--   INS-000001  instructors.instructor_code  (new column)
--   PAR-000001  parents.parent_code          (new column)
--   TL-000001   user_roles.tl_code           (new column, only for team_leader role)
--   GRP-000001  groups.code             (existing column, was nullable/manual)
--   CRS-000001  courses.code            (existing column, was nullable/manual)
--   SEM-YYYY-001 semesters.semester_code (new column, year prefix from insertion time)

-- ─── Sequences ────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.seq_student_code    START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_instructor_code START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_parent_code     START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_tl_code         START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_group_code      START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_course_code     START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_semester_code   START 1;

-- ─── New columns ──────────────────────────────────────────────────────────────
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS instructor_code TEXT;
ALTER TABLE public.parents     ADD COLUMN IF NOT EXISTS parent_code     TEXT;
ALTER TABLE public.semesters   ADD COLUMN IF NOT EXISTS semester_code   TEXT;
ALTER TABLE public.user_roles  ADD COLUMN IF NOT EXISTS tl_code         TEXT;

-- ─── Unique indexes (allow multiple NULLs; enforce uniqueness for non-NULL) ───
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_student_code
  ON public.students(student_code) WHERE student_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instructors_instructor_code
  ON public.instructors(instructor_code) WHERE instructor_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_parent_code
  ON public.parents(parent_code) WHERE parent_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_tl_code
  ON public.user_roles(tl_code) WHERE tl_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_code
  ON public.groups(code) WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_code
  ON public.courses(code) WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_semesters_semester_code
  ON public.semesters(semester_code) WHERE semester_code IS NOT NULL;

-- ─── Trigger: students ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_student_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.student_code IS NULL THEN
      NEW.student_code := 'STU-' || LPAD(nextval('public.seq_student_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.student_code IS NOT NULL AND NEW.student_code IS DISTINCT FROM OLD.student_code THEN
      RAISE EXCEPTION 'student_code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_student_code
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.manage_student_code();

-- ─── Trigger: instructors ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_instructor_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.instructor_code IS NULL THEN
      NEW.instructor_code := 'INS-' || LPAD(nextval('public.seq_instructor_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.instructor_code IS NOT NULL AND NEW.instructor_code IS DISTINCT FROM OLD.instructor_code THEN
      RAISE EXCEPTION 'instructor_code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_instructor_code
  BEFORE INSERT OR UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.manage_instructor_code();

-- ─── Trigger: parents ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_parent_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_code IS NULL THEN
      NEW.parent_code := 'PAR-' || LPAD(nextval('public.seq_parent_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.parent_code IS NOT NULL AND NEW.parent_code IS DISTINCT FROM OLD.parent_code THEN
      RAISE EXCEPTION 'parent_code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_parent_code
  BEFORE INSERT OR UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.manage_parent_code();

-- ─── Trigger: user_roles (TL codes only) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_tl_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = NEW.role_id;
    IF v_role_name = 'team_leader' AND NEW.tl_code IS NULL THEN
      NEW.tl_code := 'TL-' || LPAD(nextval('public.seq_tl_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tl_code IS NOT NULL AND NEW.tl_code IS DISTINCT FROM OLD.tl_code THEN
      RAISE EXCEPTION 'tl_code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_tl_code
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.manage_tl_code();

-- ─── Trigger: groups ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_group_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.code IS NULL THEN
      NEW.code := 'GRP-' || LPAD(nextval('public.seq_group_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.code IS NOT NULL AND NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'group code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_group_code
  BEFORE INSERT OR UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.manage_group_code();

-- ─── Trigger: courses ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_course_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.code IS NULL THEN
      NEW.code := 'CRS-' || LPAD(nextval('public.seq_course_code')::TEXT, 6, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.code IS NOT NULL AND NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'course code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_course_code
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.manage_course_code();

-- ─── Trigger: semesters ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manage_semester_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.semester_code IS NULL THEN
      NEW.semester_code := 'SEM-' || EXTRACT(YEAR FROM now())::TEXT
                           || '-' || LPAD(nextval('public.seq_semester_code')::TEXT, 3, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.semester_code IS NOT NULL AND NEW.semester_code IS DISTINCT FROM OLD.semester_code THEN
      RAISE EXCEPTION 'semester_code is immutable once assigned';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_semester_code
  BEFORE INSERT OR UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.manage_semester_code();

-- ─── Backfill existing rows ───────────────────────────────────────────────────
-- students
UPDATE public.students
SET student_code = 'STU-' || LPAD(nextval('public.seq_student_code')::TEXT, 6, '0')
WHERE student_code IS NULL;

-- instructors
UPDATE public.instructors
SET instructor_code = 'INS-' || LPAD(nextval('public.seq_instructor_code')::TEXT, 6, '0')
WHERE instructor_code IS NULL;

-- parents
UPDATE public.parents
SET parent_code = 'PAR-' || LPAD(nextval('public.seq_parent_code')::TEXT, 6, '0')
WHERE parent_code IS NULL;

-- user_roles: TL assignments without a code
UPDATE public.user_roles ur
SET tl_code = 'TL-' || LPAD(nextval('public.seq_tl_code')::TEXT, 6, '0')
FROM public.roles r
WHERE ur.role_id = r.id
  AND r.name = 'team_leader'
  AND ur.tl_code IS NULL;

-- groups
UPDATE public.groups
SET code = 'GRP-' || LPAD(nextval('public.seq_group_code')::TEXT, 6, '0')
WHERE code IS NULL;

-- courses
UPDATE public.courses
SET code = 'CRS-' || LPAD(nextval('public.seq_course_code')::TEXT, 6, '0')
WHERE code IS NULL;

-- semesters
UPDATE public.semesters
SET semester_code = 'SEM-' || EXTRACT(YEAR FROM COALESCE(created_at, now()))::TEXT
                    || '-' || LPAD(nextval('public.seq_semester_code')::TEXT, 3, '0')
WHERE semester_code IS NULL;
