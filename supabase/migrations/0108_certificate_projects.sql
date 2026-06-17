-- Migration: 0108_certificate_projects
-- Purpose: Add projects support to certificates + branding fields to templates
--
-- Changes:
--   certificates           + projects JSONB (ordered list of project titles)
--   certificate_templates  + stem_logo_url TEXT
--   certificate_templates  + signature_url TEXT
--
-- Design:
--   projects = [{"title": "Scratch Animation", "sort_order": 0}, ...]
--   Team Leader manages projects in the issue form before issuing.
--   Projects are embedded in the certificate record (not a separate table) because
--   they are created at issuance time, have no independent lifecycle, and are
--   always displayed as part of their certificate.

-- ─── certificates: projects list ──────────────────────────────────────────────

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.certificates.projects IS
  'Ordered list of projects completed by the student. '
  'Format: [{"title": "Scratch Animation", "sort_order": 0}, ...]. '
  'Managed by Team Leader before issuance. Empty array = no projects listed.';

-- ─── certificate_templates: branding fields ───────────────────────────────────

ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS stem_logo_url TEXT;

ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN public.certificate_templates.stem_logo_url IS
  'URL for the STEM logo displayed on the certificate PDF alongside the main logo.';

COMMENT ON COLUMN public.certificate_templates.signature_url IS
  'URL for a signature image rendered above the signatory line in the PDF. '
  'Optional — if absent, only the line is shown.';
