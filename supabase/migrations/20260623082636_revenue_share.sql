-- Phase XXXII: Revenue Share Engine
-- Adds robocode_share_percent to groups table.
-- Default 100 means Robocode keeps 100% of collected revenue (existing behaviour).
-- Partnership groups can be set to 30, 40, 50, etc.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS robocode_share_percent NUMERIC(5,2) NOT NULL DEFAULT 100.00;

-- Enforce 0–100 range
ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_share_percent_range;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_share_percent_range
  CHECK (robocode_share_percent >= 0 AND robocode_share_percent <= 100);

-- Backfill any existing rows that somehow landed NULL (safety net)
UPDATE public.groups
  SET robocode_share_percent = 100.00
  WHERE robocode_share_percent IS NULL;
