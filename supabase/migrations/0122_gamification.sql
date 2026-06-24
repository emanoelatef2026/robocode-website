-- Migration: 0122_gamification
-- Purpose: Student engagement — XP, level, streak columns on students table
--
-- Design decisions:
--   * XP + level stored directly on students (no separate table) — avoids JOINs
--   * NO event log — cost optimization (spec requirement)
--   * Streak: only current_streak, best_streak, last_activity_date stored
--     (no daily log — activiy = attendance present/late OR submission graded)
--   * level and streak are always derived/updated by the app layer (xp-service.ts)
--   * Student-of-the-week is calculated dynamically from attendance + submissions
--     within the current week — no snapshot table needed
--   * Group ranking is calculated dynamically from total_xp — no ranking table

-- ─── XP + level ───────────────────────────────────────────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS total_xp         INTEGER NOT NULL DEFAULT 0
    CONSTRAINT students_total_xp_positive CHECK (total_xp >= 0),
  ADD COLUMN IF NOT EXISTS current_level    INTEGER NOT NULL DEFAULT 1
    CONSTRAINT students_level_positive CHECK (current_level >= 1),
  ADD COLUMN IF NOT EXISTS current_streak   INTEGER NOT NULL DEFAULT 0
    CONSTRAINT students_streak_positive CHECK (current_streak >= 0),
  ADD COLUMN IF NOT EXISTS best_streak      INTEGER NOT NULL DEFAULT 0
    CONSTRAINT students_best_streak_positive CHECK (best_streak >= 0),
  ADD COLUMN IF NOT EXISTS last_activity_date DATE;

COMMENT ON COLUMN public.students.total_xp IS
  'Cumulative XP across all activities. Never decreases. Updated by xp-service.ts.';

COMMENT ON COLUMN public.students.current_level IS
  'Derived from total_xp by calculateLevel(). 1-based. Updated atomically with total_xp.';

COMMENT ON COLUMN public.students.current_streak IS
  'Days in a row the student had activity (attendance present/late OR graded submission). '
  'Reset to 0 if last_activity_date is more than 1 day ago when next activity occurs.';

COMMENT ON COLUMN public.students.best_streak IS
  'All-time highest current_streak achieved. Never decreases.';

COMMENT ON COLUMN public.students.last_activity_date IS
  'Date of the most recent qualifying activity (attendance present/late or submission graded). '
  'Used to detect streak breaks.';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Leaderboard / ranking queries — most common sort is total_xp DESC
CREATE INDEX IF NOT EXISTS idx_students_total_xp
  ON public.students(total_xp DESC) WHERE deleted_at IS NULL;

-- Student-of-the-week: branch-scoped XP lookups
CREATE INDEX IF NOT EXISTS idx_students_branch_xp
  ON public.students(branch_id, total_xp DESC) WHERE deleted_at IS NULL;
