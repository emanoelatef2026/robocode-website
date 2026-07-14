-- Migration: 20260714120000_cohort_lifecycle_archive_enforcement
-- Purpose: Phase 1 of the Group/Cohort Academic Lifecycle feature — enforce the
--          rules Phase 0 (20260713124359_cohort_lifecycle_foundation.sql) only
--          documented. See docs/DOMAIN_RULES.md Rules 1, 3, 11, 12.
--
-- Scope:
--   1. is_group_archived() — single reusable helper.
--   2. Read-only enforcement triggers on the 5 "locked table set" tables
--      (group_courses, group_instructors, group_students, schedules,
--      attendance_records) — blocks INSERT/UPDATE/DELETE once the owning
--      group's status = 'archived'. Mirrors the proven conditional-trigger
--      pattern from prevent_attendance_on_cancelled_session() (migration
--      0092), not the unconditional block from prevent_snapshot_mutation()
--      (migration 0027). certificates is deliberately NOT included (Rule 6).
--   3. sync_group_archived_at() — keeps groups.status='archived' and
--      groups.archived_at in lockstep automatically (Rule 3), on both the
--      archive transition and the (new, in-app) recover transition.
--   4. Three new permissions: archive_cohort, view_archived_cohorts
--      (team_leader + super_admin), recover_archived_cohort (super_admin only).
--
-- Explicitly NOT in this migration: no RLS changes (all group mutations go
-- through service-role Server Actions gated by requirePermission(), same
-- model manage_groups already uses — see docs/DOMAIN_RULES.md and the Phase 1
-- plan); no changes to groups_status_check (no new enum values needed).

-- ─── 1. Reusable helper ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_group_archived(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups WHERE id = p_group_id AND status = 'archived'
  );
$$;

COMMENT ON FUNCTION public.is_group_archived(UUID) IS
  'True when the given group has reached the terminal Archived lifecycle stage. Shared by every read-only enforcement trigger below — see docs/DOMAIN_RULES.md Rule 1.';

-- ─── 2a. Direct group_id tables: group_courses, group_instructors, group_students ─

CREATE OR REPLACE FUNCTION public.prevent_mutation_on_archived_group()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_group_id := OLD.group_id;
  ELSE
    v_group_id := NEW.group_id;
  END IF;

  IF public.is_group_archived(v_group_id) THEN
    RAISE EXCEPTION
      'Cannot % %: cohort % is Archived and permanently read-only.',
      TG_OP, TG_TABLE_NAME, v_group_id
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_group_courses ON public.group_courses;
CREATE TRIGGER trg_prevent_mutation_group_courses
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_on_archived_group();

DROP TRIGGER IF EXISTS trg_prevent_mutation_group_instructors ON public.group_instructors;
CREATE TRIGGER trg_prevent_mutation_group_instructors
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_instructors
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_on_archived_group();

DROP TRIGGER IF EXISTS trg_prevent_mutation_group_students ON public.group_students;
CREATE TRIGGER trg_prevent_mutation_group_students
  BEFORE INSERT OR UPDATE OR DELETE ON public.group_students
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation_on_archived_group();

-- ─── 2b. schedules: one hop via group_course_id ──────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_schedule_mutation_on_archived_group()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_group_course_id UUID;
  v_group_id        UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_group_course_id := OLD.group_course_id;
  ELSE
    v_group_course_id := NEW.group_course_id;
  END IF;

  SELECT group_id INTO v_group_id
  FROM   public.group_courses
  WHERE  id = v_group_course_id;

  IF v_group_id IS NOT NULL AND public.is_group_archived(v_group_id) THEN
    RAISE EXCEPTION
      'Cannot % schedules: cohort % is Archived and permanently read-only.',
      TG_OP, v_group_id
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_schedules ON public.schedules;
CREATE TRIGGER trg_prevent_mutation_schedules
  BEFORE INSERT OR UPDATE OR DELETE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.prevent_schedule_mutation_on_archived_group();

-- ─── 2c. attendance_records: two hops via schedule_id -> group_course_id ─────
-- Coexists with prevent_attendance_on_cancelled_session() (migration 0092,
-- BEFORE INSERT only) — independent condition, no overlap.

CREATE OR REPLACE FUNCTION public.prevent_attendance_mutation_on_archived_group()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_schedule_id UUID;
  v_group_id    UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  SELECT gc.group_id INTO v_group_id
  FROM   public.schedules     s
  JOIN   public.group_courses gc ON gc.id = s.group_course_id
  WHERE  s.id = v_schedule_id;

  IF v_group_id IS NOT NULL AND public.is_group_archived(v_group_id) THEN
    RAISE EXCEPTION
      'Cannot % attendance_records: cohort % is Archived and permanently read-only.',
      TG_OP, v_group_id
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_attendance_records ON public.attendance_records;
CREATE TRIGGER trg_prevent_mutation_attendance_records
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.prevent_attendance_mutation_on_archived_group();

-- ─── 3. groups.archived_at / status consistency (Rule 3) ─────────────────────
-- Auto-sets archived_at on the Completed -> Archived transition and clears it
-- on the Archived -> Completed (recover) transition, so app code never has to
-- manage both fields and the two can never drift apart.

CREATE OR REPLACE FUNCTION public.sync_group_archived_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived' THEN
    NEW.archived_at := COALESCE(NEW.archived_at, now());
  ELSIF OLD.status = 'archived' AND NEW.status IS DISTINCT FROM 'archived' THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_group_archived_at ON public.groups;
CREATE TRIGGER trg_sync_group_archived_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.sync_group_archived_at();

-- ─── 4. RBAC: archive_cohort, view_archived_cohorts, recover_archived_cohort ─
-- Follows the 0107_payroll_permissions.sql template exactly.

INSERT INTO public.permissions (name, description, category) VALUES
  ('archive_cohort',          'Archive a Completed cohort into the terminal, read-only Archived stage', 'academic'),
  ('view_archived_cohorts',   'View the Archived cohorts list/filter in the Groups workspace', 'academic'),
  ('recover_archived_cohort', 'Reverse an Archived cohort back to Completed (super_admin only)', 'academic')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category;

-- archive_cohort + view_archived_cohorts: team_leader and super_admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name IN ('team_leader', 'super_admin')
  AND p.name IN ('archive_cohort', 'view_archived_cohorts')
ON CONFLICT DO NOTHING;

-- recover_archived_cohort: super_admin only (no team_leader insert)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin' AND p.name = 'recover_archived_cohort'
ON CONFLICT DO NOTHING;

-- ─── 5. Notify PostgREST to reload schema ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
