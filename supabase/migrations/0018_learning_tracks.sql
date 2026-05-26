-- Migration: 0018_learning_tracks
-- Purpose: Learning tracks, student projects, and certificate system
-- Dependencies: 0003_organization, 0004_people, 0006_curriculum
--
-- New tables:
--   learning_tracks       — named curriculum programs (Programming, Robotics, etc.)
--   track_courses         — ordered course sequence within a track
--   student_projects      — student-built projects submitted for review/showcase
--   certificate_templates — reusable certificate layouts tied to completion events
--   student_certificates  — issued certificates with immutable content snapshot

-- ─── Learning Tracks ─────────────────────────────────────────────────────────
-- Tracks are org-level programs that group courses into a structured curriculum.
-- They are SEPARATE from courses — a track defines the progression path;
-- courses are the individual content units delivered per semester.

CREATE TABLE IF NOT EXISTS public.learning_tracks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  age_range        TEXT,             -- e.g. "7-10", "10-14", "14+"
  difficulty_level TEXT NOT NULL DEFAULT 'beginner'
                   CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  color            TEXT,             -- hex color for UI differentiation
  thumbnail_url    TEXT,
  is_published     BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

COMMENT ON TABLE public.learning_tracks IS
  'Curriculum programs (e.g. Robotics Track, Python Track). Separate from courses — '
  'a track defines the multi-semester learning path; courses are semester-level units.';

-- ─── Seed: default Robocode tracks ───────────────────────────────────────────
-- ON CONFLICT DO NOTHING makes this idempotent on re-runs.
INSERT INTO public.learning_tracks
  (org_id, name, slug, difficulty_level, color, is_published, sort_order)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Programming',       'programming',       'beginner',     '#4F46E5', true, 1),
  ('a0000000-0000-0000-0000-000000000001', 'Game Development',  'game-development',  'intermediate', '#7C3AED', true, 2),
  ('a0000000-0000-0000-0000-000000000001', 'Robotics',          'robotics',          'intermediate', '#DC2626', true, 3),
  ('a0000000-0000-0000-0000-000000000001', 'AI',                'ai',                'advanced',     '#0891B2', true, 4),
  ('a0000000-0000-0000-0000-000000000001', 'Web Development',   'web-development',   'intermediate', '#16A34A', true, 5)
ON CONFLICT (org_id, slug) DO NOTHING;

-- ─── Track → Course assignments ───────────────────────────────────────────────
-- Ordered list of courses that make up a track.
-- order_index defines the recommended progression sequence.

CREATE TABLE IF NOT EXISTS public.track_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id    UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id)         ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_id, course_id),
  UNIQUE (track_id, order_index)
);

-- ─── Student Projects ─────────────────────────────────────────────────────────
-- Projects built by students, optionally linked to a course.
-- Approved/featured projects can be surfaced on the marketing website.

CREATE TABLE IF NOT EXISTS public.student_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  video_url   TEXT,
  drive_url   TEXT,
  github_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill columns that may be missing when the table already existed
ALTER TABLE public.student_projects
  ADD COLUMN IF NOT EXISTS student_id  UUID,
  ADD COLUMN IF NOT EXISTS course_id   UUID,
  ADD COLUMN IF NOT EXISTS title       TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS video_url   TEXT,
  ADD COLUMN IF NOT EXISTS drive_url   TEXT,
  ADD COLUMN IF NOT EXISTS github_url  TEXT,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON TABLE public.student_projects IS
  'Student-built projects. status=featured surfaces them on the marketing homepage.';

-- ─── Certificate Templates ────────────────────────────────────────────────────
-- Reusable templates for different certificate types.
-- trigger_type controls when a certificate can be auto-issued.

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL DEFAULT 'manual'
                CHECK (trigger_type IN ('course_completion', 'track_completion', 'manual')),
  -- Optional: auto-issue when this specific course or track is completed
  course_id     UUID REFERENCES public.courses(id)         ON DELETE SET NULL,
  track_id      UUID REFERENCES public.learning_tracks(id) ON DELETE SET NULL,
  -- Visual template (HTML/Mustache rendered server-side to PDF)
  template_html TEXT,
  thumbnail_url TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Certificate Number Sequence ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.certificate_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_certificate_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'CERT-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('public.certificate_number_seq')::TEXT, 6, '0')
$$;

-- ─── Student Certificates ────────────────────────────────────────────────────
-- Issued certificates. Content is snapshotted at issue time so edits to the
-- template or course title do not retroactively change printed certificates.

CREATE TABLE IF NOT EXISTS public.student_certificates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES public.students(id)              ON DELETE CASCADE,
  template_id        UUID NOT NULL REFERENCES public.certificate_templates(id) ON DELETE RESTRICT,
  -- What the certificate is for (optional context pointers)
  course_id          UUID REFERENCES public.courses(id)         ON DELETE SET NULL,
  track_id           UUID REFERENCES public.learning_tracks(id) ON DELETE SET NULL,
  -- Unique public verification code
  certificate_number TEXT NOT NULL UNIQUE DEFAULT public.next_certificate_number(),
  -- Immutable content snapshot (printed values must not change after issue)
  student_name       TEXT NOT NULL,
  course_title       TEXT,
  track_name         TEXT,
  completion_date    DATE NOT NULL,
  -- Delivery
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by          UUID REFERENCES public.users(id),
  pdf_url            TEXT,
  -- Revocation
  is_revoked         BOOLEAN NOT NULL DEFAULT false,
  revoked_at         TIMESTAMPTZ,
  revoked_by         UUID REFERENCES public.users(id),
  revoke_reason      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.student_certificates IS
  'Issued certificates. Content (student_name, course_title, etc.) is snapshotted '
  'at issue time and must never be overwritten — use is_revoked to invalidate.';

-- ─── Triggers: updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER set_learning_tracks_updated_at
  BEFORE UPDATE ON public.learning_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_student_projects_updated_at
  BEFORE UPDATE ON public.student_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Backfill missing columns on pre-existing student_projects ───────────────
-- student_projects may exist from an earlier migration without deleted_at.
-- ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.
ALTER TABLE public.student_projects
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_learning_tracks_org_id
  ON public.learning_tracks(org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_tracks_slug
  ON public.learning_tracks(org_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_track_courses_track_id
  ON public.track_courses(track_id);

CREATE INDEX IF NOT EXISTS idx_track_courses_course_id
  ON public.track_courses(course_id);

CREATE INDEX IF NOT EXISTS idx_student_projects_student_id
  ON public.student_projects(student_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_projects_course_id
  ON public.student_projects(course_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_projects_status
  ON public.student_projects(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_certificate_templates_course
  ON public.certificate_templates(course_id);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_track
  ON public.certificate_templates(track_id);

CREATE INDEX IF NOT EXISTS idx_student_certificates_student
  ON public.student_certificates(student_id);

CREATE INDEX IF NOT EXISTS idx_student_certificates_number
  ON public.student_certificates(certificate_number);

CREATE INDEX IF NOT EXISTS idx_student_certificates_course
  ON public.student_certificates(course_id);

CREATE INDEX IF NOT EXISTS idx_student_certificates_track
  ON public.student_certificates(track_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.learning_tracks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_certificates  ENABLE ROW LEVEL SECURITY;

-- Learning tracks: published tracks readable by all authenticated users
CREATE POLICY "learning_tracks_read_published"
  ON public.learning_tracks FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_published = true
      OR public.user_has_permission(auth.uid(), 'manage_curriculum')
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "learning_tracks_manage"
  ON public.learning_tracks FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));

-- Track courses: readable wherever the track is readable
CREATE POLICY "track_courses_read"
  ON public.track_courses FOR SELECT
  USING (
    track_id IN (
      SELECT id FROM public.learning_tracks
      WHERE deleted_at IS NULL AND (
        is_published = true
        OR public.user_has_permission(auth.uid(), 'manage_system')
      )
    )
  );

CREATE POLICY "track_courses_manage"
  ON public.track_courses FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));

-- Student projects: student manages own; admins manage all; parents read child's;
--                   approved/featured projects readable by any authenticated user
CREATE POLICY "student_projects_self"
  ON public.student_projects FOR ALL
  USING (
    deleted_at IS NULL
    AND student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "student_projects_approved_read"
  ON public.student_projects FOR SELECT
  USING (
    deleted_at IS NULL
    AND status IN ('approved', 'featured')
  );

CREATE POLICY "student_projects_parent_read"
  ON public.student_projects FOR SELECT
  USING (
    deleted_at IS NULL
    AND student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "student_projects_admin"
  ON public.student_projects FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_curriculum'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_curriculum'));

-- Certificate templates: readable by all authenticated; managed by admin
CREATE POLICY "certificate_templates_read"
  ON public.certificate_templates FOR SELECT
  USING (is_active = true OR public.user_has_permission(auth.uid(), 'manage_system'));

CREATE POLICY "certificate_templates_manage"
  ON public.certificate_templates FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));

-- Student certificates: student reads own; parent reads child's; admin reads all
CREATE POLICY "student_certificates_self"
  ON public.student_certificates FOR SELECT
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "student_certificates_parent"
  ON public.student_certificates FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "student_certificates_admin"
  ON public.student_certificates FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system'));
