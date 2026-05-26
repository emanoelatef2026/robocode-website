-- Migration: 0022_fix_fk_constraints
-- Purpose: Add FK constraints that were skipped because semesters / academic_years
-- already existed in the remote DB when migration 0020 ran.  Each ALTER is
-- wrapped in a DO block so re-running is a no-op.

-- semesters.academic_year_id → academic_years.id
-- Required by the PostgREST hint: academic_years!semesters_academic_year_id_fkey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semesters_academic_year_id_fkey'
  ) THEN
    ALTER TABLE public.semesters
      ADD CONSTRAINT semesters_academic_year_id_fkey
      FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE CASCADE;
  END IF;
END $$;

-- semesters.org_id → organizations.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'semesters_org_id_fkey'
  ) THEN
    ALTER TABLE public.semesters
      ADD CONSTRAINT semesters_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academic_years.org_id → organizations.id (if also missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academic_years_org_id_fkey'
  ) THEN
    ALTER TABLE public.academic_years
      ADD CONSTRAINT academic_years_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
