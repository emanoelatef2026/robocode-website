-- ─────────────────────────────────────────────────────────────────────────────
-- 0090  TOPIC INTEGRITY — PHASE 18.3
-- ─────────────────────────────────────────────────────────────────────────────
-- Every academically consuming session (status = 'completed') must now carry a
-- valid topic.  This migration:
--   1. Adds a legacy_missing_topic flag to schedules so historical sessions with
--      no topic can be identified and audited without being deleted.
--   2. Backfills the flag for any completed session that has no valid topic.
--   3. Adds a DB-level trigger that prevents NEW completed sessions (i.e. when
--      a session transitions to 'completed') from being stored without a topic.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. legacy_missing_topic column ──────────────────────────────────────────

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS legacy_missing_topic BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN schedules.legacy_missing_topic IS
  'TRUE for sessions completed before topic integrity was enforced (Phase 18.3). '
  'These sessions existed before the "topic is required" rule and need admin review.';

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
-- Mark every already-completed session that lacks a valid topic.

UPDATE schedules
SET    legacy_missing_topic = TRUE
WHERE  status = 'completed'
  AND  (
         topic IS NULL
         OR TRIM(topic) = ''
         OR LOWER(TRIM(topic)) = 'no topic'
         OR LOWER(TRIM(topic)) = 'none'
         OR LOWER(TRIM(topic)) = 'n/a'
       )
  AND  legacy_missing_topic = FALSE;   -- idempotent

-- ── 3. Trigger: prevent future sessions from completing without a topic ───────
-- Fires on INSERT and UPDATE.  Only enforced when the new status is 'completed'.
-- Sessions with legacy_missing_topic = TRUE are exempt (historical data).

CREATE OR REPLACE FUNCTION prevent_completed_session_without_topic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce on rows transitioning to / being inserted as 'completed'.
  IF NEW.status = 'completed'
     AND NOT COALESCE(NEW.legacy_missing_topic, FALSE)
     AND (
           NEW.topic IS NULL
           OR TRIM(NEW.topic) = ''
           OR LOWER(TRIM(NEW.topic)) = 'no topic'
           OR LOWER(TRIM(NEW.topic)) = 'none'
           OR LOWER(TRIM(NEW.topic)) = 'n/a'
         )
  THEN
    RAISE EXCEPTION
      'TOPIC_REQUIRED: session % cannot be completed without a valid topic.',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_topic_on_complete ON schedules;

CREATE TRIGGER trg_require_topic_on_complete
  BEFORE INSERT OR UPDATE OF status, topic
  ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_session_without_topic();
