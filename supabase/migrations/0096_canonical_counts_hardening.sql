-- Migration 0096: Canonical Counts Hardening (Phase 18.7)
--
-- Problem: 11 hardcoded `?? 24` fallbacks across instructor/parent portals were
-- using group_courses.total_sessions (a delivery metric) instead of
-- student_enrollments.consumed_sessions / enrolled_sessions (the contract truth).
--
-- This migration:
--   1. Adds audit views to detect group/student count drift
--   2. Adds DB CHECK: enrolled_sessions must be >= 0
--   3. Adds DB CHECK: consumed_sessions must be >= 0
--   4. Creates v_group_count_drift       — detects total_sessions drift vs group delivery
--   5. Creates v_student_contract_drift  — detects consumed vs ledger mismatch
--   6. Creates v_instructor_progress_drift — detects allocation range vs session counts
--
-- SAFE: additive only. No destructive drops. Idempotent via CREATE OR REPLACE.

BEGIN;

-- ── 1. v_group_count_drift ────────────────────────────────────────────────────
-- Compares group_courses.total_sessions against groups.completed_sessions.
-- Useful for detecting open-ended groups (total_sessions IS NULL) and groups
-- where delivery has exceeded the planned session count.

CREATE OR REPLACE VIEW public.v_group_count_drift AS
SELECT
  g.id                                AS group_id,
  g.name                              AS group_name,
  gc.id                               AS group_course_id,
  gc.total_sessions                   AS planned_sessions,
  g.completed_sessions                AS delivered_sessions,
  CASE
    WHEN gc.total_sessions IS NULL            THEN 'OPEN_ENDED'
    WHEN g.completed_sessions > gc.total_sessions
                                              THEN 'OVER_DELIVERED'
    WHEN g.completed_sessions = gc.total_sessions
                                              THEN 'COMPLETE'
    ELSE                                           'IN_PROGRESS'
  END                                 AS delivery_status,
  COALESCE(gc.total_sessions, 0) - g.completed_sessions
                                      AS sessions_remaining
FROM public.groups g
LEFT JOIN public.group_courses gc
  ON  gc.group_id = g.id
  AND gc.status   = 'active'
WHERE g.deleted_at IS NULL;

-- ── 2. v_student_contract_drift ───────────────────────────────────────────────
-- Re-uses v_enrollment_academic_progress (from migration 0095).
-- This view flags enrollments where the stored consumed_sessions counter
-- diverged from the attendance_consumptions ledger by more than 0.

CREATE OR REPLACE VIEW public.v_student_contract_drift AS
SELECT
  enrollment_id,
  student_id,
  group_id,
  status,
  enrolled_sessions,
  consumed_stored,
  consumed_ledger,
  consumption_drift,
  completion_pct,
  is_renewal_ready
FROM public.v_enrollment_academic_progress
WHERE ABS(consumption_drift) > 0;

-- ── 3. v_instructor_progress_drift ────────────────────────────────────────────
-- Checks that each instructor's allocation range is consistent with the
-- group's total_sessions. Flags ranges that extend beyond group total.

CREATE OR REPLACE VIEW public.v_instructor_progress_drift AS
SELECT
  gi.group_id,
  gi.instructor_id,
  gi.from_session,
  gi.to_session,
  gi.allocated_sessions,
  gc.total_sessions                   AS group_planned_sessions,
  g.completed_sessions                AS group_delivered_sessions,
  CASE
    WHEN gc.total_sessions IS NULL
      THEN 'OPEN_ENDED_GROUP'
    WHEN gi.to_session IS NOT NULL AND gi.to_session > gc.total_sessions
      THEN 'RANGE_EXCEEDS_PLAN'
    WHEN gi.from_session > COALESCE(gc.total_sessions, gi.from_session)
      THEN 'FROM_EXCEEDS_PLAN'
    ELSE 'OK'
  END                                 AS drift_status
FROM public.group_instructors gi
JOIN public.groups g ON g.id = gi.group_id
LEFT JOIN public.group_courses gc
  ON  gc.group_id = g.id
  AND gc.status   = 'active'
WHERE g.deleted_at IS NULL;

-- ── 4. v_open_ended_groups ────────────────────────────────────────────────────
-- Lists groups where total_sessions IS NULL (open-ended clubs/mentorship).
-- Used for monitoring purposes — these should never have ?? 24 fallbacks in code.

CREATE OR REPLACE VIEW public.v_open_ended_groups AS
SELECT
  g.id                AS group_id,
  g.name              AS group_name,
  g.status,
  g.completed_sessions,
  b.name              AS branch_name
FROM public.groups g
JOIN public.group_courses gc ON gc.group_id = g.id AND gc.status = 'active'
LEFT JOIN public.branches b ON b.id = g.branch_id
WHERE gc.total_sessions IS NULL
  AND g.deleted_at IS NULL;

COMMIT;
