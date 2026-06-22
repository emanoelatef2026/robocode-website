-- Storage bucket for certificate template assets (logo, STEM logo, signature images).
-- Public bucket: URLs are embedded directly in generated PDFs so they must be publicly readable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificate-assets',
  'certificate-assets',
  true,
  2097152,                                             -- 2 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Service-role uploads are always allowed (bypasses RLS).
-- Authenticated admins can also upload via the API route which uses the service client.
-- Read access is public (bucket is public = true).
