-- Extend existing notifications table with recipient/routing columns
-- (notifications table already existed with: id, type, title, body, data, created_by, created_at)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS href         TEXT,
  ADD COLUMN IF NOT EXISTS dedup_key    TEXT;

-- Index for fast per-recipient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications (recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

-- Dedup index: prevents duplicate session-starting notifications per recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup
  ON notifications (recipient_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Track which notifications each user has read
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id UUID        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
