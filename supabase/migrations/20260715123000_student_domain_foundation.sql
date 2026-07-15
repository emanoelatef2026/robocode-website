-- Migration: student_domain_foundation
-- Purpose: Sprint 2 — Student Domain foundation for Student Portal + Parent Portal.
--   1. student_notes: replace is_private boolean with a 6-tier visibility model,
--      add soft delete + attachments-ready column.
--   2. student_evaluations: new structured, criterion-based evaluation table.
--   3. student_competitions: new structured competition history table, linked to
--      the existing achievement system (not a parallel one).
--   4. student_achievements: add competition_id link + 'milestone' type.
--   5. RBAC: seed manage_evaluations / manage_competitions permissions.
--
-- Dependencies: 0002_rbac, 0004_people, 0013_audit, 0023_portfolio_system,
--               0024_certificate_system, 0030_student_notes, 20260629103945 (note category/severity)

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — student_notes: visibility model (replaces is_private boolean)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.student_notes
  ADD COLUMN IF NOT EXISTS visibility  TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- Backfill visibility from is_private + author's role.
-- is_private=false was readable by any manager -> closest new tier is INTERNAL_STAFF.
-- is_private=true was author-only -> PRIVATE_TEAM_LEADER if the author's only role is
-- team_leader, otherwise PRIVATE_INSTRUCTOR (covers instructor and super_admin authors).
UPDATE public.student_notes sn
SET visibility = CASE
  WHEN sn.is_private = false THEN 'INTERNAL_STAFF'
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = sn.author_id AND r.name = 'team_leader'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = sn.author_id AND r.name = 'instructor'
  ) THEN 'PRIVATE_TEAM_LEADER'
  ELSE 'PRIVATE_INSTRUCTOR'
END
WHERE visibility IS NULL;

ALTER TABLE public.student_notes
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'PRIVATE_INSTRUCTOR';

ALTER TABLE public.student_notes
  ADD CONSTRAINT student_notes_visibility_check CHECK (
    visibility = ANY (ARRAY[
      'PRIVATE_INSTRUCTOR', 'PRIVATE_TEAM_LEADER', 'INTERNAL_STAFF',
      'SHARED', 'STUDENT_INSTRUCTION', 'PARENT_EVALUATION'
    ])
  );

ALTER TABLE public.student_notes DROP COLUMN is_private;

COMMENT ON COLUMN public.student_notes.visibility IS
  'Audience tier. PRIVATE_INSTRUCTOR/PRIVATE_TEAM_LEADER = author-only (kept as two values so instructor and TL private notes are labeled distinctly in the UI, though both are enforced identically as author-only). INTERNAL_STAFF = any staff with manage_students on the branch. SHARED = staff + student + parent. STUDENT_INSTRUCTION = staff + student only. PARENT_EVALUATION = staff + parent only.';
COMMENT ON COLUMN public.student_notes.attachments IS
  'Attachments-ready. Array of {url, name, type} objects. Not yet populated by any UI.';
COMMENT ON COLUMN public.student_notes.deleted_at IS
  'Soft delete. NULL = active. Deleted notes are excluded from student/parent read policies.';

-- Replace the old blanket "any manager reads any note" policy with a visibility-aware set.
DROP POLICY IF EXISTS "student_notes_manager_read" ON public.student_notes;

CREATE POLICY "student_notes_admin_all"
  ON public.student_notes FOR ALL
  USING       (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK  (public.user_has_permission(auth.uid(), 'manage_system'));

CREATE POLICY "student_notes_staff_read"
  ON public.student_notes FOR SELECT
  USING (
    visibility IN ('INTERNAL_STAFF', 'SHARED', 'STUDENT_INSTRUCTION', 'PARENT_EVALUATION')
    AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE public.user_has_permission(auth.uid(), 'manage_students', s.branch_id)
    )
  );

CREATE POLICY "student_notes_student_read"
  ON public.student_notes FOR SELECT
  USING (
    deleted_at IS NULL
    AND visibility IN ('SHARED', 'STUDENT_INSTRUCTION')
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "student_notes_parent_read"
  ON public.student_notes FOR SELECT
  USING (
    deleted_at IS NULL
    AND visibility IN ('SHARED', 'PARENT_EVALUATION')
    AND student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Update the audit trigger to log visibility instead of is_private.
CREATE OR REPLACE FUNCTION public.audit_student_note_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = NEW.student_id;
    PERFORM public.write_audit_log(
      NEW.author_id, 'student_note.create', 'student_note', NEW.id, NULL,
      jsonb_build_object('student_id', NEW.student_id, 'schedule_id', NEW.schedule_id, 'visibility', NEW.visibility),
      v_branch_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = NEW.student_id;
    PERFORM public.write_audit_log(
      NEW.author_id, 'student_note.update', 'student_note', NEW.id,
      jsonb_build_object('content', OLD.content, 'visibility', OLD.visibility, 'deleted_at', OLD.deleted_at),
      jsonb_build_object('content', NEW.content, 'visibility', NEW.visibility, 'deleted_at', NEW.deleted_at),
      v_branch_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    SELECT branch_id INTO v_branch_id FROM public.students WHERE id = OLD.student_id;
    PERFORM public.write_audit_log(
      OLD.author_id, 'student_note.delete', 'student_note', OLD.id,
      jsonb_build_object('student_id', OLD.student_id, 'schedule_id', OLD.schedule_id, 'visibility', OLD.visibility),
      NULL, v_branch_id
    );
  END IF;

  RETURN NULL;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — student_evaluations (new)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.student_evaluations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id      UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  course_id          UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  branch_id          UUID NOT NULL REFERENCES public.branches(id),
  criterion          TEXT NOT NULL,
  custom_label       TEXT,
  score              NUMERIC(5,2),
  rating             SMALLINT,
  feedback           TEXT,
  author_id          UUID NOT NULL REFERENCES public.users(id),
  visible_to_student BOOLEAN NOT NULL DEFAULT true,
  visible_to_parent  BOOLEAN NOT NULL DEFAULT true,
  evaluated_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_evaluations_criterion_check CHECK (criterion = ANY (ARRAY[
    'ACADEMIC_SKILLS', 'PROGRAMMING', 'ROBOTICS', 'PROBLEM_SOLVING', 'LOGIC', 'CREATIVITY',
    'CLASSROOM_BEHAVIOR', 'PARTICIPATION', 'HOMEWORK', 'ATTENDANCE_QUALITY', 'COMMUNICATION',
    'LEADERSHIP', 'TEAMWORK', 'CUSTOM'
  ])),
  CONSTRAINT student_evaluations_custom_label_check CHECK (
    (criterion <> 'CUSTOM') OR (custom_label IS NOT NULL)
  ),
  CONSTRAINT student_evaluations_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  CONSTRAINT student_evaluations_score_check CHECK (score IS NULL OR (score BETWEEN 0 AND 100)),
  CONSTRAINT student_evaluations_score_or_rating_check CHECK (score IS NOT NULL OR rating IS NOT NULL)
);

COMMENT ON TABLE public.student_evaluations IS
  'Structured, criterion-based staff evaluations of a student, independent of any single assignment. Each row is an immutable historical record — history is the full ordered row set per (student_id, criterion); there is no separate snapshot table.';
COMMENT ON COLUMN public.student_evaluations.criterion IS
  'Fixed evaluation category, or CUSTOM (requires custom_label) for academy-specific criteria.';

CREATE INDEX IF NOT EXISTS idx_student_evaluations_student   ON public.student_evaluations(student_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_criterion ON public.student_evaluations(student_id, criterion, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_branch    ON public.student_evaluations(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_author    ON public.student_evaluations(author_id);

CREATE TRIGGER set_student_evaluations_updated_at
  BEFORE UPDATE ON public.student_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_student_evaluation_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log(
      NEW.author_id, 'student_evaluation.create', 'student_evaluation', NEW.id, NULL,
      jsonb_build_object('student_id', NEW.student_id, 'criterion', NEW.criterion, 'score', NEW.score, 'rating', NEW.rating),
      NEW.branch_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.write_audit_log(
      NEW.author_id, 'student_evaluation.update', 'student_evaluation', NEW.id,
      jsonb_build_object('score', OLD.score, 'rating', OLD.rating, 'feedback', OLD.feedback, 'deleted_at', OLD.deleted_at),
      jsonb_build_object('score', NEW.score, 'rating', NEW.rating, 'feedback', NEW.feedback, 'deleted_at', NEW.deleted_at),
      NEW.branch_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log(
      OLD.author_id, 'student_evaluation.delete', 'student_evaluation', OLD.id,
      jsonb_build_object('student_id', OLD.student_id, 'criterion', OLD.criterion), NULL, OLD.branch_id
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_student_evaluations
  AFTER INSERT OR UPDATE OR DELETE ON public.student_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.audit_student_evaluation_change();

ALTER TABLE public.student_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_evaluations_admin_all"
  ON public.student_evaluations FOR ALL
  USING       (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK  (public.user_has_permission(auth.uid(), 'manage_system'));

CREATE POLICY "student_evaluations_staff_manage"
  ON public.student_evaluations FOR ALL
  USING       (public.user_has_permission(auth.uid(), 'manage_evaluations', branch_id))
  WITH CHECK  (public.user_has_permission(auth.uid(), 'manage_evaluations', branch_id));

CREATE POLICY "student_evaluations_self_read"
  ON public.student_evaluations FOR SELECT
  USING (
    deleted_at IS NULL AND visible_to_student = true
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "student_evaluations_parent_read"
  ON public.student_evaluations FOR SELECT
  USING (
    deleted_at IS NULL AND visible_to_parent = true
    AND student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — student_competitions (new)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.student_competitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  competition_name    TEXT NOT NULL,
  season              TEXT,
  year                INTEGER NOT NULL,
  role                TEXT,
  team_name           TEXT,
  coach_instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL,
  branch_id           UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  project_id          UUID REFERENCES public.portfolio_projects(id) ON DELETE SET NULL,
  rank                TEXT,
  award               TEXT,
  certificate_id      UUID REFERENCES public.certificates(id) ON DELETE SET NULL,
  notes               TEXT,
  media               JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievement_id      UUID REFERENCES public.student_achievements(id) ON DELETE SET NULL,
  created_by          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_competitions_year_check CHECK (year BETWEEN 2000 AND 2100)
);

COMMENT ON TABLE public.student_competitions IS
  'Structured competition history per student. When rank/award is set, a matching student_achievements row (achievement_type=competition) is auto-created and linked back via achievement_id — competitions are folded into the existing achievement/history system, not a parallel one.';
COMMENT ON COLUMN public.student_competitions.media IS
  'Media-ready. Array of {url, type, caption} objects. Not yet populated by any UI.';

CREATE INDEX IF NOT EXISTS idx_student_competitions_student ON public.student_competitions(student_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_student_competitions_branch  ON public.student_competitions(branch_id);

CREATE TRIGGER set_student_competitions_updated_at
  BEFORE UPDATE ON public.student_competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_student_competition_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log(
      NEW.created_by, 'student_competition.create', 'student_competition', NEW.id, NULL,
      jsonb_build_object('student_id', NEW.student_id, 'competition_name', NEW.competition_name, 'rank', NEW.rank, 'award', NEW.award),
      NEW.branch_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.write_audit_log(
      NEW.created_by, 'student_competition.update', 'student_competition', NEW.id,
      jsonb_build_object('rank', OLD.rank, 'award', OLD.award, 'notes', OLD.notes),
      jsonb_build_object('rank', NEW.rank, 'award', NEW.award, 'notes', NEW.notes),
      NEW.branch_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log(
      OLD.created_by, 'student_competition.delete', 'student_competition', OLD.id,
      jsonb_build_object('student_id', OLD.student_id, 'competition_name', OLD.competition_name), NULL, OLD.branch_id
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_student_competitions
  AFTER INSERT OR UPDATE OR DELETE ON public.student_competitions
  FOR EACH ROW EXECUTE FUNCTION public.audit_student_competition_change();

ALTER TABLE public.student_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_competitions_admin_all"
  ON public.student_competitions FOR ALL
  USING       (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK  (public.user_has_permission(auth.uid(), 'manage_system'));

CREATE POLICY "student_competitions_staff_manage"
  ON public.student_competitions FOR ALL
  USING       (public.user_has_permission(auth.uid(), 'manage_competitions', branch_id))
  WITH CHECK  (public.user_has_permission(auth.uid(), 'manage_competitions', branch_id));

CREATE POLICY "student_competitions_self_read"
  ON public.student_competitions FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "student_competitions_parent_read"
  ON public.student_competitions FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — student_achievements: link to competitions + generic milestone type
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.student_achievements
  ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES public.student_competitions(id) ON DELETE SET NULL;

ALTER TABLE public.student_achievements
  DROP CONSTRAINT IF EXISTS student_achievements_achievement_type_check;

ALTER TABLE public.student_achievements
  ADD CONSTRAINT student_achievements_achievement_type_check CHECK (
    achievement_type = ANY (ARRAY[
      'project', 'competition', 'certificate', 'leadership', 'attendance',
      'innovation', 'milestone', 'custom'
    ])
  );

COMMENT ON COLUMN public.student_achievements.competition_id IS
  'Set when this achievement was auto-created from a student_competitions row (rank/award present).';

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — RBAC: seed manage_evaluations / manage_competitions
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.permissions (name, description, category) VALUES
  ('manage_evaluations',  'Create/edit structured student evaluations',            'content'),
  ('manage_competitions', 'Create/edit student competition history',              'content')
ON CONFLICT (name) DO NOTHING;

-- super_admin (always unrestricted)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin' AND p.name IN ('manage_evaluations', 'manage_competitions')
ON CONFLICT DO NOTHING;

-- team_leader: both
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'team_leader' AND p.name IN ('manage_evaluations', 'manage_competitions')
ON CONFLICT DO NOTHING;

-- instructor: evaluations only (day-to-day grading tier, same as manage_feedback/grade_assignments).
-- Competitions stay TL+admin-only, matching the existing manage_portfolio/manage_certificates grant pattern.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'instructor' AND p.name = 'manage_evaluations'
ON CONFLICT DO NOTHING;
