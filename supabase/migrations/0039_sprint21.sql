-- Sprint 21: Group activation, course assignment workflow, and lifecycle audit
-- Adds:
--   v_group_readiness  — per-group readiness view (missing requirements + computed status)
--
-- No schema changes to core tables — readiness is computed, not stored.
-- groups.status is auto-synced by syncGroupStatus() in application code.

-- ── Group readiness audit view ────────────────────────────────────────────────
-- Shows every non-deleted group with:
--   has_course, has_semester, has_instructor   — boolean requirements
--   computed_status                             — 'active' when all three met, else 'forming'
--   stored_status                               — what groups.status currently holds
--   status_drift                                — true when stored ≠ computed (data inconsistency)
--
-- Useful for:
--   SELECT * FROM v_group_readiness WHERE status_drift;          -- find bad status values
--   SELECT * FROM v_group_readiness WHERE NOT has_course;        -- groups without a course
--   SELECT * FROM v_group_readiness WHERE computed_status='active' AND stored_status='forming';

CREATE OR REPLACE VIEW public.v_group_readiness AS
SELECT
  g.id                                                                       AS group_id,
  g.name                                                                     AS group_name,
  g.status                                                                   AS stored_status,
  b.name                                                                     AS branch_name,
  (gc.id         IS NOT NULL)                                                AS has_course,
  (g.semester_id IS NOT NULL)                                                AS has_semester,
  (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)             AS has_instructor,
  CASE
    WHEN gc.id IS NOT NULL
     AND g.semester_id IS NOT NULL
     AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
    THEN 'active'::text
    ELSE 'forming'::text
  END                                                                        AS computed_status,
  (g.status IN ('forming','active') AND g.status <> CASE
    WHEN gc.id IS NOT NULL
     AND g.semester_id IS NOT NULL
     AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
    THEN 'active'
    ELSE 'forming'
  END)                                                                       AS status_drift,
  gc.course_id,
  gc.instructor_id                                                           AS gc_instructor_id,
  gi.instructor_id                                                           AS gi_instructor_id,
  g.semester_id,
  g.created_at
FROM public.groups            g
LEFT JOIN public.branches     b  ON b.id  = g.branch_id
LEFT JOIN public.group_courses gc ON gc.group_id = g.id AND gc.status = 'active'
LEFT JOIN public.group_instructors gi ON gi.group_id = g.id
WHERE g.deleted_at IS NULL;

COMMENT ON VIEW public.v_group_readiness IS
  'Sprint 21 — Per-group lifecycle readiness. '
  'computed_status = active when course + semester + instructor all assigned. '
  'status_drift = true when stored status does not match computed status.';
