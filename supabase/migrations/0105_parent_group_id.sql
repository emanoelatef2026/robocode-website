-- Migration 0105: Add parent_group_id to student_parent_contacts
--
-- This gives every parent a stable UUID identity that:
--   • Groups multiple student-contact entries belonging to the same parent
--   • Replaces the fragile phone-based grouping used in operational.ts
--   • Enables full CRUD (create/edit/archive) on the Parents page
--
-- Backfill strategy: entries sharing the same phone1 get the same UUID.
-- Entries without phone1 each get their own UUID.

ALTER TABLE public.student_parent_contacts
  ADD COLUMN IF NOT EXISTS parent_group_id UUID;

-- Assign the same group_id to entries with the same phone1
WITH phone_groups AS (
  SELECT phone1, gen_random_uuid() AS grp_id
  FROM (
    SELECT DISTINCT phone1
    FROM   public.student_parent_contacts
    WHERE  phone1 IS NOT NULL AND phone1 != ''
  ) AS distinct_phones
)
UPDATE public.student_parent_contacts spc
SET    parent_group_id = pg.grp_id
FROM   phone_groups pg
WHERE  spc.phone1 IS NOT NULL
  AND  spc.phone1 != ''
  AND  spc.phone1 = pg.phone1
  AND  spc.parent_group_id IS NULL;

-- Entries without phone1 each get their own unique group
UPDATE public.student_parent_contacts
SET    parent_group_id = gen_random_uuid()
WHERE  parent_group_id IS NULL;

-- Make NOT NULL now that backfill is complete
ALTER TABLE public.student_parent_contacts
  ALTER COLUMN parent_group_id SET NOT NULL;

-- Fast lookup for Parents page CRUD
CREATE INDEX IF NOT EXISTS idx_spc_parent_group_id
  ON public.student_parent_contacts(parent_group_id);

-- Also add status column so we can archive parents without deleting them
ALTER TABLE public.student_parent_contacts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

-- Index for filtering active parents
CREATE INDEX IF NOT EXISTS idx_spc_status
  ON public.student_parent_contacts(status);
