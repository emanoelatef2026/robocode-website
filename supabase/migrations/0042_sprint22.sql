-- Sprint 22: LMS Simplification
-- Removes academic period & course semester from group activation requirements.
-- Group is now active when: course assigned + at least one instructor assigned.

-- Add total_sessions to group_courses (configured per group assignment, not derived from schedule count)
ALTER TABLE group_courses ADD COLUMN IF NOT EXISTS total_sessions INT NOT NULL DEFAULT 24;

-- Recreate v_group_readiness with simplified two-requirement logic
DROP VIEW IF EXISTS v_group_readiness;

CREATE OR REPLACE VIEW v_group_readiness AS
SELECT
  g.id                                                              AS group_id,
  g.name                                                            AS group_name,
  g.status                                                          AS stored_status,
  (gc.id IS NOT NULL)                                               AS has_course,
  (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)    AS has_instructor,
  (
    gc.id IS NOT NULL
    AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
  )                                                                  AS computed_active,
  CASE
    WHEN (
      gc.id IS NOT NULL
      AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
    ) THEN 'active'
    ELSE 'forming'
  END                                                                AS computed_status,
  (
    g.status IN ('forming', 'active')
    AND g.status <> CASE
      WHEN (
        gc.id IS NOT NULL
        AND (gc.instructor_id IS NOT NULL OR gi.instructor_id IS NOT NULL)
      ) THEN 'active'
      ELSE 'forming'
    END
  )                                                                  AS status_drift
FROM groups g
LEFT JOIN group_courses gc
  ON  gc.group_id   = g.id
  AND gc.status     = 'active'
  AND gc.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT instructor_id
  FROM   group_instructors gi2
  WHERE  gi2.group_id = g.id
  LIMIT 1
) gi ON TRUE
WHERE g.deleted_at IS NULL;
