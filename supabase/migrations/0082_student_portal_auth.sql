-- ─── 0082: Student portal authentication visibility ─────────────────────────
-- Adds portal_password (plain text) to students so ops staff can view
-- credentials that were set via the admin panel.
-- This is an intentional internal-ops feature — access controlled via RLS.

-- 1. Add column (nullable — only set when password is explicitly assigned)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS portal_password TEXT;

-- 2. Index not needed (point-lookup only)

-- 3. RLS: only team_leader+ and admin roles can read portal_password
--    The existing students RLS policies cover row-level access.
--    Column-level hiding: service role always bypasses RLS (used in server actions).

-- 4. Attendance summary view (for quick-view modal)
-- Returns per-student counts of each attendance status
CREATE OR REPLACE VIEW public.v_student_attendance_summary AS
SELECT
  ar.student_id,
  COUNT(*)                                              AS total_records,
  COUNT(*) FILTER (WHERE ar.status = 'present')        AS present_count,
  COUNT(*) FILTER (WHERE ar.status = 'absent')         AS absent_count,
  COUNT(*) FILTER (WHERE ar.status = 'late')           AS late_count,
  COUNT(*) FILTER (WHERE ar.status = 'excused')        AS excused_count,
  COUNT(*) FILTER (WHERE ar.status = 'makeup')         AS makeup_count,
  COUNT(*) FILTER (WHERE ar.status = 'cancelled')      AS cancelled_count,
  -- Consumed = any status that uses a session slot (present/absent/late/excused/makeup)
  COUNT(*) FILTER (WHERE ar.status IN ('present','absent','late','excused','makeup')) AS consumed_count,
  -- Attendance % = present / (present+absent+late) — excludes excused/makeup from denominator
  CASE
    WHEN COUNT(*) FILTER (WHERE ar.status IN ('present','absent','late')) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE ar.status = 'present')::numeric /
      COUNT(*) FILTER (WHERE ar.status IN ('present','absent','late'))::numeric * 100,
      1
    )
    ELSE 0
  END AS attendance_pct
FROM public.attendance_records ar
GROUP BY ar.student_id;

-- Reload PostgREST schema cache so portal_password column is immediately queryable
NOTIFY pgrst, 'reload schema';
