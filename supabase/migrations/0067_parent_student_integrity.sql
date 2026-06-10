-- Migration 0067: Parent-student relationship integrity hardening
--
-- Canonical rule: parent_students is the SINGLE source of truth for
-- parent ↔ student relationships (portal access).
-- student_guardians is separate: contact info only, NOT portal accounts.
--
-- This migration:
-- 1. Removes orphaned parent_students rows where parent or student no longer exists
--    (should be zero due to CASCADE FKs, but guards against direct DB manipulation)
-- 2. Removes duplicate parent_students rows (violating the UNIQUE constraint)
--    in case the constraint was ever temporarily dropped
-- 3. Creates a diagnostic view for ongoing health monitoring

-- 1. Remove orphaned parent_students (parent deleted outside CASCADE)
DELETE FROM public.parent_students ps
WHERE NOT EXISTS (
  SELECT 1 FROM public.parents p WHERE p.id = ps.parent_id
);

-- 2. Remove orphaned parent_students (student deleted outside CASCADE)
DELETE FROM public.parent_students ps
WHERE NOT EXISTS (
  SELECT 1 FROM public.students s WHERE s.id = ps.student_id
);

-- 3. Remove duplicate parent_students rows (keep newest by created_at)
DELETE FROM public.parent_students ps
WHERE ps.id NOT IN (
  SELECT DISTINCT ON (parent_id, student_id) id
  FROM public.parent_students
  ORDER BY parent_id, student_id, created_at DESC
);

-- 4. Diagnostic view: families where ALL children are soft-deleted (ARCHIVED health)
CREATE OR REPLACE VIEW public.v_archived_families AS
SELECT
  p.id           AS parent_id,
  u.email        AS parent_email,
  COUNT(ps.student_id) AS total_children,
  COUNT(s.deleted_at)  AS archived_children
FROM public.parents p
JOIN public.users u      ON u.id = p.user_id
LEFT JOIN public.parent_students ps ON ps.parent_id = p.id
LEFT JOIN public.students s ON s.id = ps.student_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, u.email
HAVING COUNT(ps.student_id) > 0
   AND COUNT(ps.student_id) = COUNT(s.deleted_at);

COMMENT ON VIEW public.v_archived_families IS
  'Parents whose ALL linked children are soft-deleted. These show as ARCHIVED in the TL portal.';

-- 5. Diagnostic view: parent_students health summary
CREATE OR REPLACE VIEW public.v_parent_student_integrity AS
SELECT
  (SELECT COUNT(*) FROM public.parent_students)                                    AS total_links,
  (SELECT COUNT(*) FROM public.parents WHERE deleted_at IS NULL)                   AS active_parents,
  (SELECT COUNT(*) FROM public.parents WHERE deleted_at IS NOT NULL)               AS deleted_parents,
  (SELECT COUNT(*) FROM public.parent_students ps
   JOIN public.parents p ON p.id = ps.parent_id
   WHERE p.deleted_at IS NOT NULL)                                                 AS links_to_deleted_parents,
  (SELECT COUNT(*) FROM public.parent_students ps
   JOIN public.students s ON s.id = ps.student_id
   WHERE s.deleted_at IS NOT NULL)                                                 AS links_to_archived_students,
  (SELECT COUNT(*) FROM public.parent_students ps
   JOIN public.students s ON s.id = ps.student_id
   WHERE s.deleted_at IS NULL)                                                     AS links_to_active_students;

COMMENT ON VIEW public.v_parent_student_integrity IS
  'Summary counts for parent_students relationship health. links_to_deleted_parents should be 0.';
