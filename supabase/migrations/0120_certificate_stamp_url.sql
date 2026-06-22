-- Add stamp_url column to certificate_templates.
-- stamp_url holds the academy/accreditation stamp that is overlaid large
-- on the certificate body; stem_logo_url continues as the small footer icon.

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS stamp_url text;
