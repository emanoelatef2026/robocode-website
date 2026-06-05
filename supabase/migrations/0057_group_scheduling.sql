-- Sprint 56: add scheduling columns to groups table (idempotent)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 90;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS meeting_link    TEXT;
