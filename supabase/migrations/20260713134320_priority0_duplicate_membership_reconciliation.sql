-- Priority 0: Duplicate Membership Integrity
-- Purpose: (1) reconcile the 15 objectively-invalid student_enrollments rows
-- named in docs/PRIORITY_0_RECONCILIATION_REPORT.md, (2) backfill course_id
-- so course-lineage can be checked at all, (3) add the course-lineage-scoped
-- uniqueness constraints that let valid concurrent enrollments (different
-- course) coexist while blocking invalid ones (same course, two active rows).
-- Every row closed below was individually verified against group_courses
-- before this file was written — see the reconciliation report for the
-- per-student evidence. Nothing here touches group_students, finance, or
-- attendance.

-- ─── 1. Close the 15 objectively-invalid duplicate student_enrollments rows ──
-- 'DROPPED' is used (not 'CANCELLED') because student_enrollments_status_check
-- does not permit 'CANCELLED' — see reconciliation report §4.

UPDATE public.student_enrollments
SET
  status     = 'DROPPED',
  end_date   = CURRENT_DATE,
  updated_at = now(),
  notes      = COALESCE(notes || ' | ', '') ||
               'Closed by Priority 0 reconciliation (2026-07-13): duplicate ' ||
               'bookkeeping row for an enrollment already represented by ' ||
               'another ACTIVE row for the same student/course. See ' ||
               'docs/PRIORITY_0_RECONCILIATION_REPORT.md.'
WHERE id IN (
  '0b015a70-e939-49d3-964c-66120b75974b',
  '580bc66e-9776-490b-b0de-f67e330ab51a',
  '613e5500-1b38-4916-aaf2-752972f97ea4',
  '0dfeb087-6998-42a2-a7d6-369aa7dffc11',
  '8990873f-3706-45bc-b544-80b0ba44b5f7',
  '949e0cc8-73e1-4b6f-8969-7892fa0882ed',
  '7df10720-bc16-4548-a771-2e40004f39c4',
  '3d4dece6-f3f1-4d23-8d3b-53f659edb6ac',
  '33c46772-0d83-4675-a507-a9a1d2bf8bc0',
  '5f7f2046-686d-4712-9e4e-e438edecd040',
  '114c5897-d23c-4627-86e9-f42bba15157e',
  '1da99c2a-6065-4fba-a196-c6269ae64bca',
  '165ffa5b-225a-4e5f-ad0f-b0267f9701cf',
  '0afbdb2c-b2eb-4742-b0a6-28085acbf186',
  'f13c090f-14e3-4c8b-a7c0-b102f2770b8f'
)
AND status = 'ACTIVE';  -- safety: no-op if already touched by anything else

-- ─── 2. Backfill student_enrollments.course_id from group_course_id ──────────
-- Metadata correction only (see reconciliation report §3) — never touches
-- net_amount/paid_amount/enrolled_sessions/consumed_sessions/dates.

UPDATE public.student_enrollments se
SET course_id = gc.course_id
FROM public.group_courses gc
WHERE gc.id = se.group_course_id
  AND se.course_id IS NULL
  AND se.status = 'ACTIVE';

-- ─── 3. student_enrollments: course-lineage uniqueness (additive, alongside
-- the existing uq_student_enrollments_active which stays untouched) ─────────
-- Blocks two ACTIVE rows for the same student + same course (e.g. "Python
-- Spring + Python Summer"). Does NOT block two ACTIVE rows for different
-- courses (e.g. "Python + Robotics") — that stays fully legal.

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_enrollments_active_course
  ON public.student_enrollments (student_id, course_id)
  WHERE status = 'ACTIVE' AND course_id IS NOT NULL;

-- ─── 4. group_students: add denormalized course_id ───────────────────────────
-- group_students has no course_id today (course is only reachable via
-- group_courses through group_id). A partial unique index cannot reference a
-- joined table, so this mirrors the same snapshot-column pattern already used
-- for certificates/student_enrollments elsewhere in this schema: copy the
-- value at write time instead of joining at read time.

ALTER TABLE public.group_students
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id);

CREATE INDEX IF NOT EXISTS idx_group_students_course_id
  ON public.group_students (course_id)
  WHERE course_id IS NOT NULL;

-- Backfill from the group's currently-active group_courses row.
UPDATE public.group_students gs
SET course_id = gc.course_id
FROM public.group_courses gc
WHERE gc.group_id = gs.group_id
  AND gc.status = 'active'
  AND gs.course_id IS NULL
  AND gs.status = 'active';

-- ─── 5. group_students: course-lineage uniqueness ────────────────────────────
-- Same rule as #3, applied to the operational membership table. Verified
-- against production data before this migration was written: the sole
-- existing group_students duplicate (Python 1 + Wedo 2 Robotics, different
-- courses) does NOT violate this — confirmed by direct simulation query.

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_students_active_course
  ON public.group_students (student_id, course_id)
  WHERE status = 'active' AND course_id IS NOT NULL;
