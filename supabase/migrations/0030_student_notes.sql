-- Migration: 0030_student_notes
-- Purpose: Instructor observations and notes per student
-- Dependencies: 0004_people (students, users), 0007_schedule_attendance (schedules), 0013_audit
--
-- Design notes:
--   * is_private = true  → visible to author only
--   * is_private = false → visible to author + team leaders / admins for the branch
--   * Students and parents are NEVER shown instructor notes (no RLS policy grants them access)
--   * schedule_id is optional — notes can be general (NULL) or tied to a specific session
--   * Audit-logged on INSERT, UPDATE, and DELETE via a SECURITY DEFINER trigger function

-- ─── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id)        ON DELETE SET NULL,
  content     TEXT NOT NULL,
  is_private  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_notes IS
  'Instructor observations and notes per student. '
  'is_private=true restricts visibility to the author only. '
  'Students and parents cannot read these records.';

COMMENT ON COLUMN public.student_notes.is_private IS
  'true = author-only. false = visible to team leaders and admins for the branch.';

COMMENT ON COLUMN public.student_notes.schedule_id IS
  'Optional session context. NULL = general observation, not tied to a specific class.';

-- ─── updated_at trigger ────────────────────────────────────────────────────────

CREATE TRIGGER set_student_notes_updated_at
  BEFORE UPDATE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Audit trigger ────────────────────────────────────────────────────────────
-- Calls write_audit_log() on every mutation.
-- SECURITY DEFINER so the trigger can insert into audit_logs regardless of caller.
-- p_performed_by is taken from the row (author_id) — not auth.uid() — to remain
-- accurate when called by service-role or background jobs.

CREATE OR REPLACE FUNCTION public.audit_student_note_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = NEW.student_id;
    PERFORM public.write_audit_log(
      NEW.author_id,
      'student_note.create',
      'student_note',
      NEW.id,
      NULL,
      jsonb_build_object(
        'student_id', NEW.student_id,
        'schedule_id', NEW.schedule_id,
        'is_private',  NEW.is_private
      ),
      v_branch_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = NEW.student_id;
    PERFORM public.write_audit_log(
      NEW.author_id,
      'student_note.update',
      'student_note',
      NEW.id,
      jsonb_build_object('content', OLD.content, 'is_private', OLD.is_private),
      jsonb_build_object('content', NEW.content, 'is_private', NEW.is_private),
      v_branch_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = OLD.student_id;
    PERFORM public.write_audit_log(
      OLD.author_id,
      'student_note.delete',
      'student_note',
      OLD.id,
      jsonb_build_object(
        'student_id', OLD.student_id,
        'schedule_id', OLD.schedule_id,
        'is_private',  OLD.is_private
      ),
      NULL,
      v_branch_id
    );
  END IF;

  RETURN NULL; -- AFTER trigger: return value is ignored
END;
$$;

CREATE TRIGGER audit_student_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_student_note_change();

-- ─── Indexes ───────────────────────────────────────────────────────────────────

-- Most common access pattern: all notes for a student, newest first
CREATE INDEX IF NOT EXISTS idx_student_notes_student_created
  ON public.student_notes(student_id, created_at DESC);

-- All notes written by an instructor
CREATE INDEX IF NOT EXISTS idx_student_notes_author
  ON public.student_notes(author_id, created_at DESC);

-- Notes for a specific session
CREATE INDEX IF NOT EXISTS idx_student_notes_schedule
  ON public.student_notes(schedule_id)
  WHERE schedule_id IS NOT NULL;

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Authors manage all of their own notes (read / insert / update / delete)
CREATE POLICY "student_notes_author_all"
  ON public.student_notes FOR ALL
  USING  (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Team leaders and admins read all notes for students in branches they manage.
-- manage_students is assigned to team_leader and super_admin — not to instructors,
-- students, or parents — so this policy does not leak private notes to other roles.
CREATE POLICY "student_notes_manager_read"
  ON public.student_notes FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
    )
  );
