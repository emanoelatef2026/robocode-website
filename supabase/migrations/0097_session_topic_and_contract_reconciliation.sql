-- ============================================================
-- 0097 · Session Topic Integrity + Contract Reconciliation
-- ============================================================
-- 1. UNIQUE constraint: attendance_records(schedule_id, student_id)
--    Required for upsert in recordAttendanceSession action.
-- 2. UNIQUE constraint: schedules(group_course_id, scheduled_at)
--    Prevents duplicate schedule rows for same group-course + datetime.
-- 3. Audit views for observability:
--    · v_sessions_missing_topics          — completed schedules without a valid topic
--    · v_contract_consumption_mismatch    — consumed_sessions vs ledger mismatch
--    · v_attendance_without_eligible_contract — records consumed before enrollment start_date

-- ── 1. Unique attendance record per student per schedule ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'attendance_records_schedule_student_unique'
      AND conrelid   = 'attendance_records'::regclass
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_schedule_student_unique
      UNIQUE (schedule_id, student_id);
  END IF;
END $$;

-- ── 2. Unique schedule per group_course + datetime ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'schedules_group_course_scheduled_at_unique'
      AND conrelid   = 'schedules'::regclass
  ) THEN
    ALTER TABLE schedules
      ADD CONSTRAINT schedules_group_course_scheduled_at_unique
      UNIQUE (group_course_id, scheduled_at);
  END IF;
END $$;

-- ── 3. Audit view: completed schedules missing a valid topic ──────────────────

DROP VIEW IF EXISTS v_sessions_missing_topics CASCADE;
CREATE VIEW v_sessions_missing_topics AS
SELECT
  s.id                   AS schedule_id,
  s.group_course_id,
  s.scheduled_at,
  s.status,
  s.topic,
  s.branch_id,
  s.created_at,
  g.name                 AS group_name,
  c.title                AS course_name
FROM schedules  s
JOIN group_courses gc ON gc.id = s.group_course_id
JOIN groups       g  ON g.id  = gc.group_id
JOIN courses      c  ON c.id  = gc.course_id
WHERE s.status = 'completed'
  AND (
    s.topic IS NULL
    OR trim(s.topic) = ''
    OR lower(trim(s.topic)) IN ('no topic', 'none', 'n/a', '-')
  );

-- ── 4. Audit view: consumed_sessions vs ledger mismatch ───────────────────────

DROP VIEW IF EXISTS v_contract_consumption_mismatch CASCADE;
CREATE VIEW v_contract_consumption_mismatch AS
SELECT
  se.id                         AS enrollment_id,
  se.student_id,
  se.consumed_sessions          AS stored_consumed,
  count(ac.id)                  AS ledger_consumed,
  se.consumed_sessions - count(ac.id)::int AS drift
FROM student_enrollments se
LEFT JOIN attendance_consumptions ac ON ac.enrollment_id = se.id
GROUP BY se.id, se.student_id, se.consumed_sessions
HAVING se.consumed_sessions <> count(ac.id)::int;

-- ── 5. Audit view: attendance records consumed before enrollment start_date ───

DROP VIEW IF EXISTS v_attendance_without_eligible_contract CASCADE;
CREATE VIEW v_attendance_without_eligible_contract AS
SELECT
  ar.id              AS attendance_record_id,
  ar.student_id,
  ar.status          AS attendance_status,
  s.scheduled_at     AS session_date,
  ac.enrollment_id,
  se.start_date      AS enrollment_start_date,
  s.group_course_id
FROM attendance_records     ar
JOIN attendance_consumptions ac ON ac.attendance_record_id = ar.id
JOIN student_enrollments     se ON se.id = ac.enrollment_id
JOIN schedules                s ON s.id  = ar.schedule_id
WHERE (s.scheduled_at AT TIME ZONE 'UTC')::date < se.start_date;

-- ── Notify PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
