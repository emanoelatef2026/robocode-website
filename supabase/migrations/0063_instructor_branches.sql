-- Migration 0063: instructor_branches junction table for multi-branch instructor support

CREATE TABLE IF NOT EXISTS public.instructor_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, branch_id)
);

-- Seed from existing instructor.branch_id (idempotent)
INSERT INTO public.instructor_branches (instructor_id, branch_id, is_primary)
SELECT id, branch_id, true
FROM   public.instructors
WHERE  branch_id IS NOT NULL
  AND  deleted_at IS NULL
ON CONFLICT (instructor_id, branch_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_instructor_branches_instr  ON public.instructor_branches(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_branches_branch ON public.instructor_branches(branch_id);
