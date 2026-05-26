-- Migration: 0010_media_videos
-- Purpose: Media assets metadata, external video references
-- Key decision: videos are NOT stored in Supabase Storage.
--               Only metadata + external provider links are stored.
-- Dependencies: 0003_organization

-- ─── Media Assets (Supabase Storage files) ───────────────────────────────────
-- Only for NON-VIDEO files: PDFs, images, documents, thumbnails, avatars
CREATE TABLE IF NOT EXISTS public.media_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id       UUID NOT NULL REFERENCES public.users(id),
  branch_id         UUID REFERENCES public.branches(id),
  -- Supabase Storage reference
  bucket            TEXT NOT NULL CHECK (bucket IN (
    'avatars', 'course-resources', 'submissions', 'thumbnails', 'branch-assets'
  )),
  storage_key       TEXT NOT NULL UNIQUE,  -- full path within bucket
  original_filename TEXT,
  mime_type         TEXT,
  size_bytes        BIGINT,
  -- Image dimensions (when applicable)
  width             INTEGER,
  height            INTEGER,
  metadata          JSONB NOT NULL DEFAULT '{}',
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── External Videos ─────────────────────────────────────────────────────────
-- Educational videos and session recordings use external providers.
-- This table stores structured metadata about external videos.
CREATE TABLE IF NOT EXISTS public.external_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID REFERENCES public.branches(id),
  uploader_id      UUID REFERENCES public.users(id),
  title            TEXT NOT NULL,
  description      TEXT,
  provider         TEXT NOT NULL CHECK (provider IN (
    'google_drive', 'youtube', 'vimeo', 'zoom_cloud', 'other'
  )),
  -- External identifiers
  external_url     TEXT NOT NULL,    -- Full shareable URL
  external_id      TEXT,             -- Provider video ID (for embed)
  embed_url        TEXT,             -- Computed embed URL
  thumbnail_url    TEXT,
  -- Metadata
  duration_seconds INTEGER,
  file_size_bytes  BIGINT,
  quality          TEXT,             -- '1080p', '720p', etc.
  -- Usage tracking
  entity_type      TEXT CHECK (entity_type IN ('lesson', 'schedule_recording', 'resource')),
  entity_id        UUID,
  -- Access control
  is_public        BOOLEAN NOT NULL DEFAULT false,
  requires_auth    BOOLEAN NOT NULL DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.external_videos IS
  'Metadata only. Videos are stored on external providers (Google Drive, YouTube, etc.). Never upload video binaries to Supabase Storage.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_media_assets_branch_id   ON public.media_assets(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader    ON public.media_assets(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_bucket      ON public.media_assets(bucket);
CREATE INDEX IF NOT EXISTS idx_external_videos_entity   ON public.external_videos(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_videos_branch   ON public.external_videos(branch_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_read"
  ON public.media_assets FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      uploader_id = auth.uid()
      OR branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = auth.uid() AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "media_assets_manage"
  ON public.media_assets FOR ALL
  USING (
    uploader_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_media', branch_id)
  );

CREATE POLICY "external_videos_read"
  ON public.external_videos FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      is_public = true
      OR branch_id IN (
        SELECT DISTINCT branch_id FROM public.user_roles
        WHERE user_id = auth.uid() AND branch_id IS NOT NULL
      )
      OR public.user_has_permission(auth.uid(), 'manage_system')
    )
  );

CREATE POLICY "external_videos_manage"
  ON public.external_videos FOR ALL
  USING (public.user_has_permission(auth.uid(), 'manage_media', branch_id));
