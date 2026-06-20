-- ============================================================
-- 0112 — Session Rate Override + Group Instructor Rate
-- ============================================================
-- Implements the 3-level rate hierarchy:
--   1. Session Override Rate   (highest priority)
--   2. Group Instructor Rate   (per group_instructors row)
--   3. Instructor Default Rate (instructors.salary_per_session)
-- ============================================================

-- ── 1. Group-specific rate per instructor ─────────────────────────────────────
ALTER TABLE group_instructors
  ADD COLUMN IF NOT EXISTS session_rate NUMERIC(10,2) NULL
    CHECK (session_rate IS NULL OR session_rate >= 0);

COMMENT ON COLUMN group_instructors.session_rate IS
  'Optional per-group rate override for this instructor. NULL = use instructor default.';

-- ── 2. Session override table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_session_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID NOT NULL REFERENCES schedules(id)    ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id)  ON DELETE CASCADE,
  override_rate NUMERIC(10,2) NOT NULL CHECK (override_rate >= 0),
  reason        TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_pso_schedule    ON payroll_session_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_pso_instructor  ON payroll_session_overrides(instructor_id);

-- ── 3. RLS — all writes go through service_role (server actions) ──────────────
ALTER TABLE payroll_session_overrides ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (TL dashboard, analytics)
CREATE POLICY "pso_select"
  ON payroll_session_overrides FOR SELECT
  TO authenticated USING (true);

-- All mutations go through server actions that use service_role — no auth policy needed
CREATE POLICY "pso_service_all"
  ON payroll_session_overrides FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_pso_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pso_updated_at ON payroll_session_overrides;
CREATE TRIGGER trg_pso_updated_at
  BEFORE UPDATE ON payroll_session_overrides
  FOR EACH ROW EXECUTE FUNCTION set_pso_updated_at();

-- ── 5. Notify PostgREST ───────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
