-- Migration 0066: Parent visibility architecture hardening
--
-- 1. Add soft-delete support to parents (deleted_at column)
-- 2. Non-partial index on students(branch_id) for historical queries
--    that include soft-deleted students (parent visibility)
-- 3. Active-only index on parents for fast default queries

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- The existing idx_students_branch_id is partial (WHERE deleted_at IS NULL).
-- Parent visibility queries intentionally include archived students so parents
-- don't disappear when their child is soft-deleted. This full index covers those queries.
CREATE INDEX IF NOT EXISTS idx_students_branch_id_all
  ON public.students(branch_id);

CREATE INDEX IF NOT EXISTS idx_parents_not_deleted
  ON public.parents(id) WHERE deleted_at IS NULL;

-- Also update the RLS read policy on parents to respect soft-delete
-- (service role bypasses this, but anon/authed clients benefit)
DROP POLICY IF EXISTS "parents_self_read" ON public.parents;
CREATE POLICY "parents_self_read"
  ON public.parents FOR SELECT
  USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
  );
