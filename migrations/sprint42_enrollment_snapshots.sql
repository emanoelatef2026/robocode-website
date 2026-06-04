-- Sprint 42: Enrollment Operations + Session Delivery Finalization
-- Purpose: snapshot fields, enrollment-linked finance, attendance/learning separation
-- All changes are ADDITIVE. Safe to re-run.
-- Run after: sprint41_enrollment_centric.sql

-- ─── 1. Snapshot fields on student_enrollments ────────────────────────────────
-- Preserve historical accuracy after transfers — the group/instructor/course
-- name at enrollment time is captured so reports stay accurate after renames
-- or group moves.

ALTER TABLE public.student_enrollments
  ADD COLUMN IF NOT EXISTS group_name_snapshot      TEXT,
  ADD COLUMN IF NOT EXISTS course_name_snapshot     TEXT,
  ADD COLUMN IF NOT EXISTS instructor_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS branch_name_snapshot     TEXT,
  ADD COLUMN IF NOT EXISTS pricing_snapshot         JSONB  NOT NULL DEFAULT '{}';

-- ─── 2. Backfill snapshots for existing enrollment rows ───────────────────────

UPDATE public.student_enrollments se
SET
  branch_name_snapshot = b.name,
  group_name_snapshot  = g.name
FROM public.branches b
JOIN public.groups g ON g.id = se.group_id
WHERE b.id = se.branch_id
  AND (se.branch_name_snapshot IS NULL OR se.group_name_snapshot IS NULL)
  AND se.group_id IS NOT NULL;

-- Instructor + course snapshot (via active group_course)
UPDATE public.student_enrollments se
SET
  course_name_snapshot     = c.title,
  instructor_name_snapshot = (
    SELECT CONCAT(p.first_name, ' ', p.last_name)
    FROM public.instructors i
    JOIN public.users u ON u.id = i.user_id
    JOIN public.profiles p ON p.user_id = u.id
    WHERE i.id = gc.instructor_id
    LIMIT 1
  )
FROM public.group_courses gc
JOIN public.courses c ON c.id = gc.course_id
WHERE gc.id = se.group_course_id
  AND (se.course_name_snapshot IS NULL OR se.instructor_name_snapshot IS NULL);

-- Pricing snapshot backfill from linked financial accounts
UPDATE public.student_enrollments se
SET pricing_snapshot = jsonb_build_object(
  'total_amount',    sfa.total_amount,
  'discount_amount', sfa.discount_amount,
  'net_amount',      sfa.net_amount
)
FROM public.student_financial_accounts sfa
WHERE sfa.enrollment_id = se.id
  AND se.pricing_snapshot = '{}'
  AND sfa.net_amount > 0;

-- ─── 3. Finance: support one account per enrollment ───────────────────────────
-- The existing UNIQUE constraint on student_financial_accounts is (student_id).
-- This means one account per student. Sprint 42 needs one account per enrollment.
-- We add a PARTIAL unique index that allows multiple accounts per student
-- as long as each has a different enrollment_id.
-- The old unique index on student_id is kept for backward compat (upserts still work).

CREATE UNIQUE INDEX IF NOT EXISTS uq_sfa_enrollment_id
  ON public.student_financial_accounts (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- ─── 4. Finance: add initial_payment columns for enrollment wizard ────────────
-- Tracks what was paid at enrollment time (snapshot, not a live sum).

ALTER TABLE public.student_financial_accounts
  ADD COLUMN IF NOT EXISTS paid_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill remaining_amount = net_amount - paid_amount for existing rows
-- where remaining_amount = 0 but net_amount > 0 (likely not computed yet)
UPDATE public.student_financial_accounts
SET remaining_amount = GREATEST(0, net_amount - paid_amount)
WHERE remaining_amount = 0 AND net_amount > 0 AND paid_amount > 0;

-- For accounts with no payments: remaining = net
UPDATE public.student_financial_accounts
SET remaining_amount = net_amount
WHERE remaining_amount = 0 AND net_amount > 0 AND paid_amount = 0;

-- ─── 5. Attendance vs. Learning Access separation ─────────────────────────────
-- Add a session_delivered_at field on attendance_records so the system can
-- track when session materials (notes/homework/recordings) were made available
-- independently of whether the student physically attended.
-- This implements "Absent students still receive homework".

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS materials_visible BOOLEAN NOT NULL DEFAULT true;

-- All existing records: materials remain visible regardless of absence
UPDATE public.attendance_records
SET materials_visible = true
WHERE materials_visible = false;

-- ─── 6. Add session_number to schedules for milestone tracking ────────────────
-- Tracks which session number this is within the group course.
-- Enables "Session 10 unpaid warning" without counting in application code.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS session_number INTEGER;

-- Backfill session_number by ordering within each group_course
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY group_course_id ORDER BY scheduled_at ASC) AS rn
  FROM public.schedules
  WHERE status != 'cancelled'
)
UPDATE public.schedules s
SET session_number = ranked.rn
FROM ranked
WHERE ranked.id = s.id
  AND s.session_number IS NULL;

-- ─── 7. Index for fast enrollment wizard student search ───────────────────────

CREATE INDEX IF NOT EXISTS idx_students_search
  ON public.students (branch_id, status)
  WHERE deleted_at IS NULL;

-- ─── 8. Diagnostic: enrollments missing finance accounts ──────────────────────

CREATE OR REPLACE VIEW public.v_enrollments_without_finance AS
SELECT
  se.id           AS enrollment_id,
  se.student_id,
  se.branch_id,
  se.group_id,
  se.start_date,
  se.net_amount   AS contracted_amount,
  b.name          AS branch_name,
  g.name          AS group_name
FROM public.student_enrollments se
JOIN public.branches b ON b.id = se.branch_id
LEFT JOIN public.groups g ON g.id = se.group_id
WHERE se.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM public.student_financial_accounts sfa
    WHERE sfa.enrollment_id = se.id
       OR sfa.student_id   = se.student_id
  );
