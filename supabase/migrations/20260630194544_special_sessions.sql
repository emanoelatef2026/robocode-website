-- Phase XL: Special Sessions System (Trial + Standalone Makeup Sessions)
-- 1. Add 'trial' to schedule type
-- 2. Make group_course_id nullable (standalone sessions have no group)
-- 3. trial_session_students table (leads or ad-hoc)
-- 4. makeup_session_students table (any student, EXTRA or REPLACE_MISSED mode)

-- ── 1. Extend type enum ──────────────────────────────────────────────────────

-- Drop the existing CHECK constraint and recreate with 'trial' added.
-- Multiple migrations may have altered this constraint so we use DO $$ to be safe.
DO $$
BEGIN
  ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_type_check
  CHECK (type IN ('regular', 'makeup', 'exam', 'event', 'trial'));

-- ── 2. Make group_course_id nullable ────────────────────────────────────────
-- Standalone sessions (trial / makeup without a group) do not belong to a group_course.
-- All existing rows have a non-null value so this is safe and backward-compatible.

ALTER TABLE public.schedules
  ALTER COLUMN group_course_id DROP NOT NULL;

-- Drop the ON DELETE CASCADE FK and re-add as nullable (allows NULL without cascade issue)
DO $$
BEGIN
  ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_group_course_id_fkey;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_group_course_id_fkey
    FOREIGN KEY (group_course_id) REFERENCES public.group_courses(id)
    ON DELETE CASCADE;

-- ── 3. trial_session_students ────────────────────────────────────────────────
-- Tracks who attended a trial session.
-- lead_id is nullable — supports both Option A (existing lead) and Option B (ad-hoc).

CREATE TABLE IF NOT EXISTS public.trial_session_students (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       UUID        NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  lead_id           UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  student_name      TEXT        NOT NULL,
  student_phone     TEXT,
  parent_phone      TEXT,
  notes             TEXT,
  attendance_status TEXT        CHECK (attendance_status IN ('present', 'absent')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_session_students_schedule
  ON public.trial_session_students (schedule_id);

CREATE INDEX IF NOT EXISTS idx_trial_session_students_lead
  ON public.trial_session_students (lead_id)
  WHERE lead_id IS NOT NULL;

-- ── 4. makeup_session_students ───────────────────────────────────────────────
-- Tracks which students attend a standalone makeup session and in what mode.
-- EXTRA: consumes 1 session from the student's enrollment.
-- REPLACE_MISSED: resolves an absence on the replaced_session_id; no consumption.

CREATE TABLE IF NOT EXISTS public.makeup_session_students (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id         UUID        NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id          UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mode                TEXT        NOT NULL CHECK (mode IN ('EXTRA', 'REPLACE_MISSED')),
  replaced_session_id UUID        REFERENCES public.schedules(id) ON DELETE SET NULL,
  attendance_status   TEXT        CHECK (attendance_status IN ('present', 'absent', 'late')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_makeup_session_students_schedule
  ON public.makeup_session_students (schedule_id);

CREATE INDEX IF NOT EXISTS idx_makeup_session_students_student
  ON public.makeup_session_students (student_id);
