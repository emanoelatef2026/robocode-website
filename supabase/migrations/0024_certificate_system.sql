-- Migration: 0024_certificate_system
-- Purpose: Certificate templates, issuance, and public verification
-- Dependencies: 0004_people (students), 0006_curriculum (courses),
--               0020_semesters, 0023_portfolio_system (student_achievements)
--
-- Tables:
--   certificate_templates  — visual/content templates per type
--   certificates           — issued certificates per student
--
-- Design notes:
--   * certificate_code is human-readable (RBC-YYYY-XXXXXX) and publicly
--     verifiable at /verify/[code]
--   * template_id = null → certificate was issued without a template
--     (raw title/description still captured)
--   * achievement_id links to student_achievements for portfolio integration
--   * pdf_url stores a cached copy; null = generate on-demand
--   * status = 'active' | 'revoked' — revoked certs still exist for audit
--   * branch_id on both tables for branch isolation

-- ─── certificate_templates ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  certificate_type     TEXT NOT NULL DEFAULT 'custom',
  description          TEXT,
  background_color     TEXT NOT NULL DEFAULT '#FFFFFF',
  accent_color         TEXT NOT NULL DEFAULT '#FF8A1F',
  background_image_url TEXT,
  logo_url             TEXT,
  signatory_name       TEXT,
  signatory_title      TEXT,
  branch_id            UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_by           UUID REFERENCES public.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive: add missing columns if table pre-existed
ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS certificate_type     TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS description          TEXT,
  ADD COLUMN IF NOT EXISTS background_color     TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS accent_color         TEXT NOT NULL DEFAULT '#FF8A1F',
  ADD COLUMN IF NOT EXISTS background_image_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_url             TEXT,
  ADD COLUMN IF NOT EXISTS signatory_name       TEXT,
  ADD COLUMN IF NOT EXISTS signatory_title      TEXT,
  ADD COLUMN IF NOT EXISTS branch_id            UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by           UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add CHECK constraint if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificate_templates_certificate_type_check'
  ) THEN
    ALTER TABLE public.certificate_templates
      ADD CONSTRAINT certificate_templates_certificate_type_check
      CHECK (certificate_type IN ('semester_completion','course_completion','competition_award','achievement','custom'));
  END IF;
END $$;

COMMENT ON TABLE public.certificate_templates IS
  'Reusable certificate templates per type. branch_id = NULL means global template.';

-- ─── certificates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.certificates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code     TEXT NOT NULL UNIQUE,
  template_id          UUID REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  certificate_type     TEXT NOT NULL
                       CHECK (certificate_type IN (
                         'semester_completion', 'course_completion',
                         'competition_award', 'achievement', 'custom'
                       )),
  -- Content
  title                TEXT NOT NULL,
  description          TEXT,
  recipient_name       TEXT NOT NULL,
  -- Context links (all optional; populate based on type)
  semester_id          UUID REFERENCES public.semesters(id)           ON DELETE SET NULL,
  course_id            UUID REFERENCES public.courses(id)             ON DELETE SET NULL,
  achievement_id       UUID REFERENCES public.student_achievements(id) ON DELETE SET NULL,
  -- Validity
  issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until          TIMESTAMPTZ,
  -- PDF cache
  pdf_url              TEXT,
  -- Status
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'revoked')),
  revoked_at           TIMESTAMPTZ,
  revoked_by           UUID REFERENCES public.users(id),
  revoke_reason        TEXT,
  -- Scope
  branch_id            UUID REFERENCES public.branches(id)            ON DELETE SET NULL,
  -- Bookkeeping
  issued_by            UUID REFERENCES public.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.certificates IS
  'Issued certificates per student. certificate_code is publicly verifiable.';

-- ─── Triggers: updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_certificate_templates_type
  ON public.certificate_templates(certificate_type);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_branch
  ON public.certificate_templates(branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_student
  ON public.certificates(student_id);

CREATE INDEX IF NOT EXISTS idx_certificates_code
  ON public.certificates(certificate_code);

CREATE INDEX IF NOT EXISTS idx_certificates_student_type
  ON public.certificates(student_id, certificate_type);

CREATE INDEX IF NOT EXISTS idx_certificates_branch
  ON public.certificates(branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_semester
  ON public.certificates(semester_id) WHERE semester_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_course
  ON public.certificates(course_id) WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_achievement
  ON public.certificates(achievement_id) WHERE achievement_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates          ENABLE ROW LEVEL SECURITY;

-- certificate_templates ───────────────────────────────────────────────────────

-- Any authenticated user can read active templates (needed when issuing)
CREATE POLICY "cert_templates_auth_read"
  ON public.certificate_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admin full management
CREATE POLICY "cert_templates_admin_all"
  ON public.certificate_templates FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_certificates'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_certificates'));

-- certificates ────────────────────────────────────────────────────────────────

-- Student reads own
CREATE POLICY "certs_self_read"
  ON public.certificates FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

-- Parent reads linked child's
CREATE POLICY "certs_parent_read"
  ON public.certificates FOR SELECT
  USING (
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps
      JOIN public.parents p ON p.id = ps.parent_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Public verification (active certs only — via certificate_code, no auth needed)
CREATE POLICY "certs_public_verify"
  ON public.certificates FOR SELECT
  USING (status = 'active');

-- Admin full management
CREATE POLICY "certs_admin_all"
  ON public.certificates FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_system')
      OR public.user_has_permission(auth.uid(), 'manage_certificates'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_system')
           OR public.user_has_permission(auth.uid(), 'manage_certificates'));
