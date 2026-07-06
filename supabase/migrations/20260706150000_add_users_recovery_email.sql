-- Migration: 20260706150000_add_users_recovery_email
-- Purpose: Optional real-world contact address for password recovery.
--          Login emails are now always @robocodeschools.com (not real
--          mailboxes for students/parents, and not guaranteed reachable for
--          every staff account either), so an account can optionally point
--          password-reset delivery at a real inbox it controls instead.
-- Note: no personal data is set here — this migration only adds the column.
--       Per-account values are set individually via the app/ops, not baked
--       into migration history.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS recovery_email TEXT;

COMMENT ON COLUMN public.users.recovery_email IS
  'Optional real-world email for password-reset delivery. When set, the forgot-password flow generates a recovery link via the Supabase admin API and emails it here (via Resend) instead of relying on Supabase Auth to mail the login address directly, since the login address is not always a real inbox.';
