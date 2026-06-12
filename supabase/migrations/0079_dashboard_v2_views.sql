-- Phase 14: Dashboard V2 operational views
-- All views are safe CREATE OR REPLACE — no destructive changes.

-- ─────────────────────────────────────────────────────────────────────────────
-- v_group_health
-- One row per active/forming group. Shows operational health metrics.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_group_health AS
SELECT
  g.id                        AS group_id,
  g.branch_id,
  g.name                      AS group_name,
  g.status                    AS group_status,
  g.capacity,
  g.day_of_week,
  g."time"                    AS group_time,
  g.start_date,

  -- Active student headcount
  (
    SELECT COUNT(*)::int
    FROM group_students gs
    WHERE gs.group_id = g.id AND gs.status = 'active'
  ) AS active_students,

  -- Capacity utilisation %
  CASE
    WHEN g.capacity > 0 THEN
      ROUND(100.0 * (
        SELECT COUNT(*) FROM group_students gs
        WHERE gs.group_id = g.id AND gs.status = 'active'
      ) / g.capacity)::int
    ELSE NULL
  END AS capacity_pct,

  -- Lead instructor name (from active group_course)
  (
    SELECT (p.first_name || ' ' || COALESCE(p.last_name, ''))
    FROM group_courses   gc
    JOIN instructors      i  ON i.id  = gc.instructor_id
    JOIN users            u  ON u.id  = i.user_id
    JOIN profiles         p  ON p.user_id = u.id
    WHERE gc.group_id = g.id AND gc.status = 'active'
    LIMIT 1
  ) AS instructor_name,

  -- Instructor id
  (
    SELECT gc.instructor_id
    FROM group_courses gc
    WHERE gc.group_id = g.id AND gc.status = 'active'
    LIMIT 1
  ) AS instructor_id,

  -- Course name
  (
    SELECT c.title
    FROM group_courses gc
    JOIN courses c ON c.id = gc.course_id
    WHERE gc.group_id = g.id AND gc.status = 'active'
    LIMIT 1
  ) AS course_name,

  -- Course id
  (
    SELECT gc.course_id
    FROM group_courses gc
    WHERE gc.group_id = g.id AND gc.status = 'active'
    LIMIT 1
  ) AS course_id,

  -- Average attendance score from student_course_progress
  (
    SELECT ROUND(AVG(scp.attendance_score))::int
    FROM group_students          gs
    JOIN student_course_progress scp ON scp.student_id = gs.student_id
                                     AND scp.group_id   = g.id
                                     AND scp.status     = 'active'
    WHERE gs.group_id = g.id AND gs.status = 'active'
  ) AS avg_attendance_pct,

  -- Average assignment score
  (
    SELECT ROUND(AVG(scp.assignment_score))::int
    FROM group_students          gs
    JOIN student_course_progress scp ON scp.student_id = gs.student_id
                                     AND scp.group_id   = g.id
                                     AND scp.status     = 'active'
    WHERE gs.group_id = g.id AND gs.status = 'active'
  ) AS avg_assignment_pct,

  -- Students with overdue payments
  (
    SELECT COUNT(DISTINCT gs.student_id)::int
    FROM group_students          gs
    JOIN student_financial_accounts sfa ON sfa.student_id = gs.student_id
    WHERE gs.group_id = g.id AND gs.status = 'active' AND sfa.status = 'OVERDUE'
  ) AS unpaid_students,

  -- Students with 0-2 sessions remaining
  (
    SELECT COUNT(DISTINCT gs.student_id)::int
    FROM group_students     gs
    JOIN student_enrollments se ON se.student_id = gs.student_id AND se.status = 'ACTIVE'
    WHERE gs.group_id = g.id
      AND gs.status = 'active'
      AND (se.remaining_sessions IS NULL OR se.remaining_sessions <= 2)
  ) AS critical_sessions_count,

  -- Last completed session date
  (
    SELECT s.scheduled_at::date
    FROM schedules   s
    JOIN group_courses gc ON gc.id = s.group_course_id
    WHERE gc.group_id = g.id AND s.status = 'completed'
    ORDER BY s.scheduled_at DESC
    LIMIT 1
  ) AS last_session_date,

  -- Next scheduled session
  (
    SELECT s.scheduled_at
    FROM schedules   s
    JOIN group_courses gc ON gc.id = s.group_course_id
    WHERE gc.group_id = g.id
      AND s.status IN ('scheduled', 'active')
      AND s.scheduled_at >= NOW()
    ORDER BY s.scheduled_at ASC
    LIMIT 1
  ) AS next_session_at,

  -- Completed sessions missing attendance records
  (
    SELECT COUNT(DISTINCT s.id)::int
    FROM schedules   s
    JOIN group_courses gc ON gc.id = s.group_course_id
    WHERE gc.group_id = g.id
      AND s.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar WHERE ar.schedule_id = s.id
      )
  ) AS sessions_missing_attendance

FROM groups g
WHERE g.status IN ('active', 'forming')
  AND g.deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- v_student_risk
-- One row per at-risk active student. Used by the Student Risk Engine.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_student_risk AS
WITH latest_progress AS (
  -- Take the most recently updated active progress row per student
  SELECT DISTINCT ON (student_id)
    student_id,
    group_id,
    attendance_score,
    assignment_score,
    status
  FROM student_course_progress
  WHERE status = 'active'
  ORDER BY student_id, updated_at DESC NULLS LAST
),
latest_enrollment AS (
  SELECT DISTINCT ON (student_id)
    student_id,
    remaining_sessions,
    status
  FROM student_enrollments
  WHERE status = 'ACTIVE'
  ORDER BY student_id, start_date ASC NULLS LAST, created_at ASC
),
latest_finance AS (
  SELECT DISTINCT ON (student_id)
    student_id,
    status            AS finance_status,
    remaining_amount  AS remaining_balance
  FROM student_financial_accounts
  ORDER BY student_id, created_at DESC NULLS LAST
),
last_positive_att AS (
  SELECT
    student_id,
    MAX(recorded_at) AS last_positive_at
  FROM attendance_records
  WHERE status IN ('present', 'late', 'makeup')
  GROUP BY student_id
),
parent_contact AS (
  SELECT DISTINCT ON (student_id)
    student_id, phone1 AS parent_phone
  FROM student_parent_contacts
  WHERE phone1 IS NOT NULL
  ORDER BY student_id
)
SELECT
  s.id                           AS student_id,
  s.branch_id,
  s.student_code,
  (p.first_name || ' ' || COALESCE(p.last_name, '')) AS student_name,
  u.phone                        AS student_phone,
  pc.parent_phone,
  lp.group_id                    AS current_group_id,
  g.name                         AS current_group_name,
  COALESCE(lp.attendance_score, 0)::int  AS attendance_score,
  COALESCE(lp.assignment_score, 0)::int  AS assignment_score,
  le.remaining_sessions,
  lf.finance_status,
  COALESCE(lf.remaining_balance, 0)      AS remaining_balance,
  -- Days since last positive attendance
  CASE
    WHEN la.last_positive_at IS NOT NULL
    THEN EXTRACT(DAY FROM NOW() - la.last_positive_at)::int
    ELSE NULL
  END AS days_since_attendance,
  -- Composite risk score (0-100)
  LEAST(100,
    CASE WHEN COALESCE(lp.attendance_score, 0) < 60 THEN 30
         WHEN COALESCE(lp.attendance_score, 0) < 75 THEN 15
         ELSE 0 END
    + CASE WHEN COALESCE(lp.assignment_score, 0) < 50 THEN 20
           WHEN COALESCE(lp.assignment_score, 0) < 65 THEN 10
           ELSE 0 END
    + CASE WHEN le.remaining_sessions IS NULL OR le.remaining_sessions <= 0 THEN 30
           WHEN le.remaining_sessions <= 2 THEN 15
           ELSE 0 END
    + CASE WHEN la.last_positive_at IS NULL THEN 20
           WHEN EXTRACT(DAY FROM NOW() - la.last_positive_at) >= 30 THEN 20
           WHEN EXTRACT(DAY FROM NOW() - la.last_positive_at) >= 14 THEN 12
           ELSE 0 END
    + CASE WHEN lf.finance_status = 'OVERDUE' THEN 25
           WHEN lf.finance_status = 'DUE_SOON' THEN 10
           ELSE 0 END
  )::int AS risk_score
FROM students s
JOIN users    u  ON u.id       = s.user_id
JOIN profiles p  ON p.user_id  = u.id
LEFT JOIN latest_progress lp ON lp.student_id = s.id
LEFT JOIN latest_enrollment le ON le.student_id = s.id
LEFT JOIN latest_finance    lf ON lf.student_id = s.id
LEFT JOIN last_positive_att la ON la.student_id = s.id
LEFT JOIN parent_contact    pc ON pc.student_id = s.id
LEFT JOIN groups            g  ON g.id = lp.group_id
WHERE s.status = 'active'
  AND s.deleted_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- v_operations_alerts
-- Unified view of all operational warnings. Each row is one alert.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_operations_alerts AS

-- Groups without instructor
SELECT
  g.branch_id,
  'no_instructor'      AS alert_type,
  'warning'            AS severity,
  g.id                 AS entity_id,
  g.name               AS entity_name,
  'Group has no instructor assigned' AS description
FROM groups g
WHERE g.status IN ('active', 'forming')
  AND g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM group_courses gc
    WHERE gc.group_id = g.id AND gc.status = 'active' AND gc.instructor_id IS NOT NULL
  )

UNION ALL

-- Groups without course
SELECT
  g.branch_id,
  'no_course'          AS alert_type,
  'warning'            AS severity,
  g.id                 AS entity_id,
  g.name               AS entity_name,
  'Group has no course assigned' AS description
FROM groups g
WHERE g.status IN ('active', 'forming')
  AND g.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM group_courses gc
    WHERE gc.group_id = g.id AND gc.status = 'active' AND gc.course_id IS NOT NULL
  )

UNION ALL

-- Active students without any group
SELECT
  s.branch_id,
  'no_group'           AS alert_type,
  'info'               AS severity,
  s.id                 AS entity_id,
  (p.first_name || ' ' || COALESCE(p.last_name, '')) AS entity_name,
  'Student has active enrollment but no group' AS description
FROM students s
JOIN users u ON u.id = s.user_id
JOIN profiles p ON p.user_id = u.id
WHERE s.status = 'active'
  AND s.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM student_enrollments se
    WHERE se.student_id = s.id AND se.status = 'ACTIVE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM group_students gs
    WHERE gs.student_id = s.id AND gs.status = 'active'
  )

UNION ALL

-- Completed sessions with no attendance recorded
SELECT
  s.branch_id,
  'missing_attendance' AS alert_type,
  'critical'           AS severity,
  s.id                 AS entity_id,
  gc_g.name || ' — ' || to_char(s.scheduled_at, 'DD Mon') AS entity_name,
  'Session completed but attendance not recorded' AS description
FROM schedules s
JOIN group_courses gc ON gc.id = s.group_course_id
JOIN groups gc_g ON gc_g.id = gc.group_id
WHERE s.status = 'completed'
  AND s.scheduled_at >= NOW() - INTERVAL '14 days'
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar WHERE ar.schedule_id = s.id
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes supporting dashboard queries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_group_students_group_status
  ON group_students (group_id, status);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student_status
  ON student_enrollments (student_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_recorded
  ON attendance_records (student_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedules_branch_status_at
  ON schedules (branch_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_group_courses_group_status
  ON group_courses (group_id, status);

CREATE INDEX IF NOT EXISTS idx_student_financial_accounts_student_status
  ON student_financial_accounts (student_id, status);

NOTIFY pgrst, 'reload schema';
