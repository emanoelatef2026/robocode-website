-- Migration: 0019_grade_triggers
-- Purpose: Auto-maintained grade summaries, lesson progress, and soft-delete for modules
-- Dependencies: 0006_curriculum, 0008_assessments
--
-- Changes:
--   1. ADD deleted_at to course_modules (was missing — would cascade-delete on hard DELETE)
--   2. refresh_student_progress()  — trigger function: fires on lesson_completions INSERT
--   3. refresh_grade_summary()     — trigger function: fires on submissions INSERT/UPDATE
--
-- Both triggers are SECURITY DEFINER so they write to aggregation tables regardless
-- of the caller's RLS context. The writes are safe — they only update rows owned by
-- the triggering row's student_id.

-- ─── 1. Add deleted_at to course_modules ─────────────────────────────────────
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active modules (replaces the full-scan idx_course_modules_course_id)
CREATE INDEX IF NOT EXISTS idx_course_modules_active
  ON public.course_modules(course_id, order_index) WHERE deleted_at IS NULL;

-- ─── 2. Trigger: refresh student_progress on lesson completion ────────────────
--
-- When a student marks a lesson complete, recalculate their progress percentage
-- for the group_course that contains that lesson.
--
-- Path: lesson → module → course → group_course (active) + group_students (active)

CREATE OR REPLACE FUNCTION public.refresh_student_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gc_id   UUID;
  v_total   INTEGER := 0;
  v_done    INTEGER := 0;
  v_pct     NUMERIC(5, 2);
BEGIN
  -- Resolve the active group_course for this student + lesson
  SELECT gc.id INTO v_gc_id
  FROM public.lessons         l
  JOIN public.course_modules  cm ON cm.id        = l.module_id   AND cm.deleted_at IS NULL
  JOIN public.group_courses   gc ON gc.course_id  = cm.course_id  AND gc.status = 'active'
  JOIN public.group_students  gs ON gs.group_id   = gc.group_id
                                 AND gs.student_id = NEW.student_id
                                 AND gs.status = 'active'
  WHERE l.id = NEW.lesson_id
  LIMIT 1;

  -- No active enrollment found → nothing to update
  IF v_gc_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Total published, non-deleted lessons in this group_course's course
  SELECT COUNT(*) INTO v_total
  FROM public.lessons        l
  JOIN public.course_modules cm ON cm.id       = l.module_id  AND cm.deleted_at IS NULL
                                                               AND cm.is_published = true
  JOIN public.group_courses  gc ON gc.course_id = cm.course_id
  WHERE gc.id          = v_gc_id
    AND l.is_published = true
    AND l.deleted_at   IS NULL;

  -- Completed lessons for this student within the same group_course
  SELECT COUNT(*) INTO v_done
  FROM public.lesson_completions lc
  JOIN public.lessons            l  ON l.id        = lc.lesson_id
                                    AND l.is_published = true
                                    AND l.deleted_at   IS NULL
  JOIN public.course_modules     cm ON cm.id       = l.module_id
                                    AND cm.deleted_at IS NULL
                                    AND cm.is_published = true
  JOIN public.group_courses      gc ON gc.course_id = cm.course_id
  WHERE gc.id            = v_gc_id
    AND lc.student_id    = NEW.student_id;

  v_pct := CASE WHEN v_total > 0
                THEN ROUND((v_done::NUMERIC / v_total * 100), 2)
                ELSE 0 END;

  INSERT INTO public.student_progress (
    student_id, group_course_id,
    completed_lessons, total_lessons, completion_percentage,
    last_activity_at, started_at
  ) VALUES (
    NEW.student_id, v_gc_id,
    v_done, v_total, v_pct,
    now(), now()
  )
  ON CONFLICT (student_id, group_course_id) DO UPDATE SET
    completed_lessons     = EXCLUDED.completed_lessons,
    total_lessons         = EXCLUDED.total_lessons,
    completion_percentage = EXCLUDED.completion_percentage,
    last_activity_at      = now(),
    -- Set completed_at once when 100% is first reached; never overwrite thereafter
    completed_at = CASE
      WHEN EXCLUDED.completion_percentage = 100
       AND student_progress.completed_at IS NULL
      THEN now()
      ELSE student_progress.completed_at
    END;
    -- started_at intentionally excluded from UPDATE — preserves original start time

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_progress ON public.lesson_completions;
CREATE TRIGGER trg_refresh_progress
  AFTER INSERT ON public.lesson_completions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_student_progress();

-- ─── 3. Trigger: refresh student_grade_summaries on submission change ─────────
--
-- When a submission is created or graded, recalculate the grade summary for
-- that student in the group_course that contains the assignment's course.
--
-- Path: assignment.lesson_id → lesson → module → course → group_course
--    OR assignment.module_id → module  → course → group_course
-- Then: group_course + student → group_students (must be active)

CREATE OR REPLACE FUNCTION public.refresh_grade_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gc_id UUID;
  r       RECORD;
BEGIN
  -- Resolve the group_course for this student + assignment
  -- Uses COALESCE to handle both lesson-linked and module-linked assignments
  SELECT gc.id INTO v_gc_id
  FROM public.assignments      a
  LEFT JOIN public.lessons        l    ON l.id    = a.lesson_id
  LEFT JOIN public.course_modules cm_l ON cm_l.id = l.module_id
  LEFT JOIN public.course_modules cm_m ON cm_m.id = a.module_id
  JOIN public.group_courses gc
    ON gc.course_id = COALESCE(cm_l.course_id, cm_m.course_id)
   AND gc.status = 'active'
  JOIN public.group_students gs
    ON gs.group_id   = gc.group_id
   AND gs.student_id = NEW.student_id
   AND gs.status = 'active'
  WHERE a.id = NEW.assignment_id
  LIMIT 1;

  IF v_gc_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Recalculate all four metrics for (student, group_course) in one pass.
  -- The inner subquery deduplicates assignments to prevent double-counting
  -- when a lesson and its module both appear in the join.
  SELECT
    COUNT(a.id)          AS total_asgn,
    COUNT(s.id)          AS submitted,
    COUNT(s.score)       AS graded,
    COALESCE(SUM(a.max_score), 0) AS total_possible,
    COALESCE(SUM(s.score),    0) AS earned
  INTO r
  FROM (
    -- All published assignments reachable from this group_course
    SELECT DISTINCT a.id, a.max_score
    FROM public.group_courses  gc2
    JOIN public.course_modules cm  ON cm.course_id  = gc2.course_id AND cm.deleted_at IS NULL
    LEFT JOIN public.lessons   l   ON l.module_id   = cm.id         AND l.deleted_at  IS NULL
    JOIN public.assignments    a   ON (
      (a.lesson_id = l.id   AND a.lesson_id IS NOT NULL)
      OR
      (a.module_id = cm.id  AND a.module_id IS NOT NULL)
    )
    WHERE gc2.id       = v_gc_id
      AND a.deleted_at IS NULL
      AND a.status     = 'published'
  ) a
  LEFT JOIN public.submissions s
    ON s.assignment_id = a.id
   AND s.student_id   = NEW.student_id;

  INSERT INTO public.student_grade_summaries (
    student_id,       group_course_id,
    total_assignments, submitted_count, graded_count,
    total_possible_score, earned_score, grade_percentage,
    last_updated_at
  ) VALUES (
    NEW.student_id,   v_gc_id,
    r.total_asgn,     r.submitted,     r.graded,
    r.total_possible, r.earned,
    CASE WHEN r.total_possible > 0
         THEN ROUND((r.earned / r.total_possible * 100)::NUMERIC, 2)
         ELSE NULL END,
    now()
  )
  ON CONFLICT (student_id, group_course_id) DO UPDATE SET
    total_assignments    = EXCLUDED.total_assignments,
    submitted_count      = EXCLUDED.submitted_count,
    graded_count         = EXCLUDED.graded_count,
    total_possible_score = EXCLUDED.total_possible_score,
    earned_score         = EXCLUDED.earned_score,
    grade_percentage     = EXCLUDED.grade_percentage,
    last_updated_at      = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_grade_summary ON public.submissions;
CREATE TRIGGER trg_refresh_grade_summary
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_grade_summary();
