-- Phase 19.5 — Rebuild course history view using attendance-first path
--
-- Root cause: v_student_course_timeline joined student_enrollments → groups via
-- student_enrollments.group_id, which is NULL for most enrollments (created via
-- group-independent enrollment flow in migration 0075). Result: zero rows returned
-- for real students.
--
-- Fix: derive course history from attendance_records → schedules → group_courses → groups/courses.
-- This is the canonical path — it never depends on student_enrollments.group_id.

DROP VIEW IF EXISTS public.v_student_course_timeline;

CREATE OR REPLACE VIEW public.v_student_course_history AS
WITH
-- All non-invalidated attendance records with their group+course context and linked enrollment
att_ctx AS (
  SELECT
    ar.student_id,
    ar.id                AS attendance_record_id,
    ar.status            AS attendance_status,
    sch.scheduled_at     AS session_date,
    g.id                 AS group_id,
    g.name               AS group_name,
    gc.course_id,
    enrc.enrollment_id
  FROM public.attendance_records ar
  JOIN public.schedules                sch  ON sch.id  = ar.schedule_id
  JOIN public.group_courses            gc   ON gc.id   = sch.group_course_id
  JOIN public.groups                   g    ON g.id    = gc.group_id
  LEFT JOIN public.attendance_consumptions enrc
    ON enrc.attendance_record_id = ar.id
  WHERE ar.invalidated_at IS NULL
),
-- One primary enrollment per (student, group, course) — via consumption ledger
primary_enr AS (
  SELECT DISTINCT ON (student_id, group_id, course_id)
    student_id,
    group_id,
    course_id,
    enrollment_id AS primary_enrollment_id
  FROM att_ctx
  WHERE enrollment_id IS NOT NULL
  ORDER BY student_id, group_id, course_id, enrollment_id
),
-- Aggregate attendance stats per (student, group, course)
agg AS (
  SELECT
    student_id,
    group_id,
    group_name,
    course_id,
    MIN(session_date)  AS first_session_date,
    MAX(session_date)  AS last_session_date,
    COUNT(*) FILTER (WHERE attendance_status = 'present') AS total_present,
    COUNT(*) FILTER (WHERE attendance_status = 'absent')  AS total_absent,
    COUNT(*) FILTER (WHERE attendance_status = 'late')    AS total_late,
    COUNT(*) FILTER (WHERE attendance_status = 'excused') AS total_excused,
    COUNT(*) FILTER (WHERE attendance_status = 'makeup')  AS total_makeup,
    ROUND(
      COUNT(*) FILTER (WHERE attendance_status = 'present')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE attendance_status IN ('present','absent','late')), 0) * 100, 1
    ) AS attendance_rate
  FROM att_ctx
  GROUP BY student_id, group_id, group_name, course_id
)
SELECT
  agg.student_id,
  agg.group_id,
  agg.group_name,
  agg.course_id,
  c.title                    AS course_name,
  agg.first_session_date,
  agg.last_session_date,
  agg.total_present,
  agg.total_absent,
  agg.total_late,
  agg.total_excused,
  agg.total_makeup,
  agg.attendance_rate,
  pe.primary_enrollment_id   AS enrollment_id,
  se.enrolled_sessions,
  se.consumed_sessions,
  se.remaining_sessions,
  se.status                  AS enrollment_status,
  se.start_date              AS enrollment_start,
  gc_instr.instructor_name
FROM agg
LEFT JOIN public.courses c ON c.id = agg.course_id
LEFT JOIN primary_enr pe
  ON pe.student_id = agg.student_id
  AND pe.group_id  = agg.group_id
  AND (
    pe.course_id = agg.course_id
    OR (pe.course_id IS NULL AND agg.course_id IS NULL)
  )
LEFT JOIN public.student_enrollments se ON se.id = pe.primary_enrollment_id
-- Most recent instructor for this (group, course) combination
LEFT JOIN LATERAL (
  SELECT
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      p.first_name,
      p.last_name
    ) AS instructor_name
  FROM public.group_courses gc2
  LEFT JOIN public.instructors i ON i.id      = gc2.instructor_id
  LEFT JOIN public.profiles    p ON p.user_id = i.user_id
  WHERE gc2.group_id = agg.group_id
    AND (
      gc2.course_id = agg.course_id
      OR (gc2.course_id IS NULL AND agg.course_id IS NULL)
    )
  ORDER BY gc2.created_at DESC
  LIMIT 1
) gc_instr ON true;
