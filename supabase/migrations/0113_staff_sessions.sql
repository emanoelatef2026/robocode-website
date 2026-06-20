-- 0113_staff_sessions.sql
-- Staff custom sessions for per-session and hybrid payroll types
-- Also adds department field to staff_payroll_profiles

-- ─── 1. Department field on staff profiles ─────────────────────────────────────
ALTER TABLE staff_payroll_profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

-- ─── 2. Staff sessions table ───────────────────────────────────────────────────
-- Tracks individual paid activities for per_session / mixed staff
-- (workshops, camps, training, open days, admin events, etc.)

CREATE TABLE IF NOT EXISTS staff_sessions (
  id               UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_profile_id UUID           NOT NULL REFERENCES staff_payroll_profiles(id) ON DELETE CASCADE,
  branch_id        UUID           NOT NULL REFERENCES branches(id),
  session_date     DATE           NOT NULL DEFAULT CURRENT_DATE,
  activity_type    TEXT           NOT NULL DEFAULT 'custom',
  -- activity_type values: workshop | camp | training | open_day | extra_session
  --                       admin_event | technical_support | custom
  description      TEXT,
  rate             NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  quantity         NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- amount = rate * quantity, computed in application
  notes            TEXT,
  created_by       UUID           REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ─── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_sessions_profile ON staff_sessions (staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_branch  ON staff_sessions (branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_date    ON staff_sessions (session_date);

-- ─── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_staff_sessions"
  ON staff_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 5. PostgREST schema cache refresh ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
