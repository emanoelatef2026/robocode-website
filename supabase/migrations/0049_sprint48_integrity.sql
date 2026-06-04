-- Sprint 48: Data Integrity, Contract Codes, Indexes, and Overdraft Support
-- Phase 18 + Phase 14

-- ── 1. Contract code sequence ──────────────────────────────────────────────────
-- Auto-generate CNT-YYYY-NNNNNN codes on student_enrollments

CREATE SEQUENCE IF NOT EXISTS contract_code_seq START 1 INCREMENT 1;

ALTER TABLE student_enrollments
  ADD COLUMN IF NOT EXISTS contract_code text;

-- Function to generate contract codes
CREATE OR REPLACE FUNCTION generate_contract_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contract_code IS NULL THEN
    NEW.contract_code := 'CNT-' || to_char(NOW(), 'YYYY') || '-' ||
                         LPAD(nextval('contract_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign contract code
DROP TRIGGER IF EXISTS trg_enrollment_contract_code ON student_enrollments;
CREATE TRIGGER trg_enrollment_contract_code
  BEFORE INSERT ON student_enrollments
  FOR EACH ROW EXECUTE FUNCTION generate_contract_code();

-- Backfill existing enrollments
UPDATE student_enrollments
SET contract_code = 'CNT-' || to_char(created_at, 'YYYY') || '-' ||
                   LPAD((nextval('contract_code_seq'))::text, 6, '0')
WHERE contract_code IS NULL;

-- ── 2. Unique contract code index ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_contract_code
  ON student_enrollments(contract_code)
  WHERE contract_code IS NOT NULL;

-- ── 3. Prevent duplicate active enrollments (same student + course) ────────────
-- Allow duplicates only when renewal_of is set
-- We check at app level via 23505 handling; add a partial unique index for same-day
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_dup_active_enrollment
  ON student_enrollments(student_id, group_id, status)
  WHERE status = 'ACTIVE' AND group_id IS NOT NULL AND transferred_from IS NULL;

-- ── 4. student_timeline_events table ──────────────────────────────────────────
-- Supports overdraft events, WhatsApp, calls, etc.

CREATE TABLE IF NOT EXISTS student_timeline_events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES student_enrollments(id) ON DELETE SET NULL,
  schedule_id  uuid REFERENCES schedules(id) ON DELETE SET NULL,
  account_id   uuid REFERENCES student_financial_accounts(id) ON DELETE SET NULL,
  event_type   text NOT NULL,   -- OVERDRAFT_GRANTED, PAYMENT, REMINDER, NOTE, etc.
  notes        text,
  created_by   uuid REFERENCES users(id),
  branch_id    uuid REFERENCES branches(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_student ON student_timeline_events(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_enrollment ON student_timeline_events(enrollment_id, created_at DESC);

-- ── 5. Performance indexes for search ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_branch_status ON students(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON student_enrollments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_branch_status ON student_enrollments(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_group_status ON student_enrollments(group_id, status) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_accounts_enrollment ON student_financial_accounts(enrollment_id) WHERE enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_accounts_student ON student_financial_accounts(student_id);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_status ON student_financial_accounts(status, branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_account ON finance_payments(account_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_enrollment ON finance_payments(enrollment_id) WHERE enrollment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_installments_account ON finance_installments(account_id, due_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_schedule ON attendance_records(student_id, schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedules_gc ON schedules(group_course_id, scheduled_at DESC) WHERE status != 'cancelled';

-- ── 6. courses: add academic asset fields ─────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS syllabus_url           text,
  ADD COLUMN IF NOT EXISTS curriculum_url         text,
  ADD COLUMN IF NOT EXISTS homework_drive_url     text,
  ADD COLUMN IF NOT EXISTS resources_url          text,
  ADD COLUMN IF NOT EXISTS meeting_url            text,
  ADD COLUMN IF NOT EXISTS preparation_notes      text,
  ADD COLUMN IF NOT EXISTS ai_tools_used          text,
  ADD COLUMN IF NOT EXISTS recommended_age        text,
  ADD COLUMN IF NOT EXISTS prerequisite_course_id uuid REFERENCES courses(id);

-- ── 7. RLS for timeline events ────────────────────────────────────────────────
ALTER TABLE student_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_select" ON student_timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND (ur.branch_id = student_timeline_events.branch_id OR ur.role = 'super_admin')
    )
  );

CREATE POLICY "timeline_insert" ON student_timeline_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND (ur.branch_id = student_timeline_events.branch_id OR ur.role = 'super_admin')
    )
  );
