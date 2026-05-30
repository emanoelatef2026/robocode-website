-- Sprint 21.8: Update group readiness — now requires course_module_id (course semester)
--
-- v_group_readiness gains a fourth requirement: has_course_semester.
-- A group is ACTIVE only when: course + course_semester + academic_period + instructor.

CREATE OR REPLACE VIEW public.v_group_readiness AS
SELECT
  g.id                                                                              AS group_id,
  g.name                                                                            AS group_name,
  g.status                                                                          AS stored_status,
  b.name                                                                            AS branch_name,
  (gc.id IS NOT NULL)                                                               AS has_course,
  (gc.course_module_id IS NOT NULL)                                                 AS has_course_semester,
  (g.semester_id IS NOT NULL)                                                       AS has_academic_period,
  (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)                    AS has_instructor,
  CASE
    WHEN gc.id IS NOT NULL
     AND gc.course_module_id IS NOT NULL
     AND g.semester_id IS NOT NULL
     AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
    THEN 'active'::text
    ELSE 'forming'::text
  END                                                                               AS computed_status,
  (g.status IN ('forming','active') AND g.status <> CASE
    WHEN gc.id IS NOT NULL
     AND gc.course_module_id IS NOT NULL
     AND g.semester_id IS NOT NULL
     AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
    THEN 'active'
    ELSE 'forming'
  END)                                                                              AS status_drift,
  gc.course_id,
  gc.course_module_id,
  gc.instructor_id                                                                  AS gc_instructor_id,
  gi.instructor_id                                                                  AS gi_instructor_id,
  g.semester_id,
  g.created_at
FROM public.groups            g
LEFT JOIN public.branches     b  ON b.id  = g.branch_id
LEFT JOIN public.group_courses gc ON gc.group_id = g.id AND gc.status = 'active'
LEFT JOIN public.group_instructors gi ON gi.group_id = g.id
WHERE g.deleted_at IS NULL;

COMMENT ON VIEW public.v_group_readiness IS
  'Sprint 21.8 — Four-requirement lifecycle: course + course_semester + academic_period + instructor. '
  'has_course_semester = group_courses.course_module_id IS NOT NULL. '
  'status_drift = stored status disagrees with computed status.';
