-- PHASE 18: Session integrity audit views.
-- These views surface data quality issues: overlapping allocations, orphan sessions,
-- sessions without numbers, and full allocation summaries per group.

-- 1. Overlapping instructor allocations within a group (should be zero rows in a healthy system).
CREATE OR REPLACE VIEW public.v_instructor_overlap_audit AS
SELECT
  a.group_id,
  a.instructor_id AS instructor_a_id,
  b.instructor_id AS instructor_b_id,
  a.from_session  AS a_from,
  a.to_session    AS a_to,
  b.from_session  AS b_from,
  b.to_session    AS b_to
FROM public.group_instructors a
JOIN public.group_instructors b
  ON  a.group_id      = b.group_id
  AND a.instructor_id < b.instructor_id   -- avoid self-join duplicates
  AND a.to_session   IS NOT NULL
  AND b.to_session   IS NOT NULL
  AND a.from_session <= b.to_session
  AND b.from_session <= a.to_session;

-- 2. Sessions missing a session_number (data quality — should be zero after migration).
CREATE OR REPLACE VIEW public.v_sessions_without_number AS
SELECT
  id,
  group_course_id,
  scheduled_at,
  status,
  type,
  created_at
FROM public.schedules
WHERE session_number IS NULL;

-- 3. Sessions whose session_number falls outside every instructor's allocation range
--    (orphan sessions — no instructor owns them).
CREATE OR REPLACE VIEW public.v_orphan_sessions AS
SELECT
  s.id,
  s.group_course_id,
  s.session_number,
  s.status,
  s.type,
  s.scheduled_at,
  gc.group_id
FROM public.schedules   s
JOIN public.group_courses gc ON gc.id = s.group_course_id
WHERE s.session_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM   public.group_instructors gi
    WHERE  gi.group_id       = gc.group_id
      AND  s.session_number >= gi.from_session
      AND  (gi.to_session IS NULL OR s.session_number <= gi.to_session)
  );

-- 4. Full allocation summary per (group, instructor) — single source of truth for dashboards.
-- Note: instructor name must be resolved at query time via profiles join (not stored here).
CREATE OR REPLACE VIEW public.v_instructor_allocation_summary AS
SELECT
  gi.group_id,
  gi.instructor_id,
  gi.role,
  gi.from_session,
  gi.to_session,
  gi.allocated_sessions,
  gi.allocation_status,
  gi.assigned_at,
  gi.released_at,
  gi.handoff_notes,
  COALESCE((
    SELECT COUNT(*)::INT
    FROM   public.schedules  s
    JOIN   public.group_courses gc ON gc.id = s.group_course_id
    WHERE  gc.group_id        = gi.group_id
      AND  s.session_number  >= gi.from_session
      AND  (gi.to_session IS NULL OR s.session_number <= gi.to_session)
      AND  s.status           = 'completed'
  ), 0) AS sessions_completed_in_range
FROM public.group_instructors gi;

-- 5. Gap audit: session_number ranges not covered by any instructor allocation.
-- Useful for detecting holes in the teaching timeline.
CREATE OR REPLACE VIEW public.v_allocation_gaps AS
WITH allocations AS (
  SELECT
    group_id,
    from_session,
    to_session,
    ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY from_session) AS rn
  FROM public.group_instructors
  WHERE to_session IS NOT NULL
),
gaps AS (
  SELECT
    a.group_id,
    a.to_session + 1                       AS gap_from,
    LEAD(a.from_session) OVER (
      PARTITION BY a.group_id ORDER BY a.from_session
    ) - 1                                  AS gap_to
  FROM allocations a
)
SELECT *
FROM   gaps
WHERE  gap_from IS NOT NULL
  AND  gap_to   IS NOT NULL
  AND  gap_from <= gap_to;
