-- Sprint 15.5 — Operations UX & Data Completion
-- Adds operational fields to groups, students, and instructors.
-- Team-leader and instructor phone uses the existing users.phone column.
-- Team-leader financial fields are stored in users.metadata JSONB.

-- ── Groups: schedule metadata ─────────────────────────────────────────────────

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS day_of_week TEXT
    CONSTRAINT groups_day_of_week_check
    CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  ADD COLUMN IF NOT EXISTS time        TEXT,   -- HH:MM (24-hour)
  ADD COLUMN IF NOT EXISTS notes       TEXT;

-- ── Students: academic + contact info ────────────────────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_grade TEXT,
  ADD COLUMN IF NOT EXISTS address      TEXT;

-- ── Instructors: financial / contact ────────────────────────────────────────

ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS payment_link        TEXT,
  ADD COLUMN IF NOT EXISTS wallet_number       TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
