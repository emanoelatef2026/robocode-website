-- Migration 0104: Parents unified source — cleanup + data consolidation
--
-- ROOT CAUSE ANALYSIS:
-- Parent data was scattered across THREE separate systems that never synced:
--
--   1. parents / parent_students   — manual portal accounts (email+password)
--      Status: 2 records, both linked to soft-deleted students → stale/orphaned
--
--   2. student_parent_contacts     — structured contact table (migration 0055/0068)
--      Status: 0 entries for active students; 1 entry for an archived student
--
--   3. students.emergency_contact  — legacy JSONB column (migration 0004)
--      Status: 33 of 36 active students have contact data here → this is the real data
--
-- WHAT THIS MIGRATION DOES:
--   A. Promote emergency_contact JSONB → student_parent_contacts (the canonical table)
--      for every active student that has JSONB data but no spc entry yet.
--   B. Remove parent_students links whose student has been soft-deleted.
--   C. Remove parent portal accounts now fully orphaned.
--
-- AFTER THIS MIGRATION:
--   • student_parent_contacts is the single source of truth for parent data.
--   • The Parents page (listParentContactsOperational) reads from it and shows
--     the parents of all 33 active students that had contact info.
--   • The legacy emergency_contact JSONB is left in place (backward compat) but
--     new writes go to student_parent_contacts via the student form.

-- ─── A. Promote emergency_contact JSONB → student_parent_contacts ─────────────
-- Only for active (non-deleted) students that:
--   • have a non-empty emergency_contact with a name field
--   • do NOT already have an entry in student_parent_contacts

INSERT INTO public.student_parent_contacts (
  student_id,
  name,
  relation,
  phone1,
  is_primary,
  is_emergency
)
SELECT
  s.id                                                         AS student_id,
  TRIM(s.emergency_contact->>'name')                           AS name,
  COALESCE(
    NULLIF(TRIM(s.emergency_contact->>'relation'), ''),
    'guardian'
  )                                                            AS relation,
  NULLIF(TRIM(s.emergency_contact->>'phone1'), '')             AS phone1,
  true                                                         AS is_primary,
  true                                                         AS is_emergency
FROM public.students s
WHERE s.deleted_at IS NULL
  AND s.emergency_contact IS NOT NULL
  AND s.emergency_contact != '{}'::jsonb
  AND NULLIF(TRIM(s.emergency_contact->>'name'), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_parent_contacts spc
    WHERE spc.student_id = s.id
  );

-- ─── B. Remove parent_students links to soft-deleted students ─────────────────
DELETE FROM public.parent_students
WHERE student_id IN (
  SELECT id FROM public.students WHERE deleted_at IS NOT NULL
);

-- ─── C. Remove parent portal accounts now fully orphaned ──────────────────────
DELETE FROM public.parents
WHERE id NOT IN (
  SELECT DISTINCT parent_id FROM public.parent_students
);

-- ─── Refresh diagnostic view ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_archived_families AS
SELECT
  p.id           AS parent_id,
  u.email        AS parent_email,
  COUNT(ps.student_id) AS total_children,
  COUNT(s.deleted_at)  AS archived_children
FROM public.parents p
JOIN public.users u           ON u.id = p.user_id
LEFT JOIN public.parent_students ps ON ps.parent_id = p.id
LEFT JOIN public.students s   ON s.id = ps.student_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, u.email
HAVING COUNT(ps.student_id) > 0
   AND COUNT(ps.student_id) = COUNT(s.deleted_at);
