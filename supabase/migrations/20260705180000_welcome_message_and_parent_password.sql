-- ─── Welcome WhatsApp message + parent portal password visibility ───────────
-- Parents never had a plaintext password column (unlike students.portal_password
-- from 0082), so the welcome message could not surface parent credentials.
-- Mirrors the students pattern: intentional internal-ops visibility, access
-- controlled via RLS / server-only service-role reads.

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS portal_password TEXT;

-- Log of welcome messages prepared for parents, for future analytics.
-- No FK cascades — logs must survive student/user deletion for audit purposes.
CREATE TABLE IF NOT EXISTS public.welcome_message_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL,
  parent_phone  TEXT NOT NULL,
  sent_by       UUID NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel       TEXT NOT NULL DEFAULT 'whatsapp',
  message_type  TEXT NOT NULL DEFAULT 'welcome',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welcome_message_logs_student_id ON public.welcome_message_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_welcome_message_logs_sent_by    ON public.welcome_message_logs (sent_by);
CREATE INDEX IF NOT EXISTS idx_welcome_message_logs_sent_at    ON public.welcome_message_logs (sent_at DESC);

NOTIFY pgrst, 'reload schema';
