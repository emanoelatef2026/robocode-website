-- Sprint 38: Multi-Branch Integrity Audit
-- Purpose: Add instructor_branches pivot, add missing codes, harden FK indexes
-- Run after: sprint34b_finalization.sql

-- ─── 1. instructor_branches pivot table ──────────────────────────────────────
-- Allows an instructor to be associated with multiple branches beyond their
-- home (instructors.branch_id). This enables team leaders of branch B to see
-- and assign instructors whose home branch is A.

CREATE TABLE IF NOT EXISTS public.instructor_branches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
  branch_id     UUID NOT NULL REFERENCES public.branches(id)    ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'visiting'
                CHECK (role IN ('primary', 'visiting', 'contract')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, branch_id)
);

-- Index for branch lookups
CREATE INDEX IF NOT EXISTS idx_instructor_branches_branch_id
  ON public.instructor_branches (branch_id);

CREATE INDEX IF NOT EXISTS idx_instructor_branches_instructor_id
  ON public.instructor_branches (instructor_id);

-- Back-fill: every instructor's home branch_id becomes a 'primary' row
INSERT INTO public.instructor_branches (instructor_id, branch_id, role)
SELECT id, branch_id, 'primary'
FROM public.instructors
WHERE deleted_at IS NULL
ON CONFLICT (instructor_id, branch_id) DO NOTHING;

-- ─── 2. instructor_code column ───────────────────────────────────────────────
-- Mirrors student_code for consistent human-readable IDs
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS instructor_code TEXT;

-- ─── 3. leads table: converted_at column ────────────────────────────────────
-- Required by TL analytics conversion-date calculations
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Back-fill converted_at from timeline for already-converted leads
UPDATE public.leads l
SET converted_at = lt.created_at
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, created_at
  FROM public.lead_timeline
  WHERE event_type = 'status_changed'
    AND note ILIKE '%converted%'
  ORDER BY lead_id, created_at ASC
) lt
WHERE l.id = lt.lead_id
  AND l.status = 'CONVERTED'
  AND l.converted_at IS NULL;

-- ─── 4. Performance indexes ───────────────────────────────────────────────────

-- Finance: branch + status lookups (common in TL portal)
CREATE INDEX IF NOT EXISTS idx_student_financial_accounts_branch_status
  ON public.student_financial_accounts (branch_id, status);

-- Students: branch + status (extremely common)
CREATE INDEX IF NOT EXISTS idx_students_branch_status
  ON public.students (branch_id, status)
  WHERE deleted_at IS NULL;

-- Leads: branch + status + follow-up date
CREATE INDEX IF NOT EXISTS idx_leads_branch_status
  ON public.leads (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_leads_next_followup
  ON public.leads (next_follow_up_at)
  WHERE status NOT IN ('CONVERTED', 'LOST');

-- Attendance: recorded_at for date-range queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_recorded_at
  ON public.attendance_records (recorded_at);

-- Groups: branch + status
CREATE INDEX IF NOT EXISTS idx_groups_branch_status
  ON public.groups (branch_id, status)
  WHERE deleted_at IS NULL;

-- ─── 5. RLS policies for instructor_branches ──────────────────────────────────
ALTER TABLE public.instructor_branches ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "super_admin_instructor_branches" ON public.instructor_branches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Team leaders: read instructors in their branches
CREATE POLICY "team_leader_read_instructor_branches" ON public.instructor_branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'team_leader'
        AND ur.branch_id = instructor_branches.branch_id
    )
  );

-- ─── 6. Orphan record cleanup helpers ────────────────────────────────────────
-- These are safe VIEWS for identifying data issues (not deleting anything)

CREATE OR REPLACE VIEW public.v_orphan_students AS
SELECT s.id, s.student_code, s.user_id, s.branch_id, s.created_at
FROM public.students s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.user_id);

CREATE OR REPLACE VIEW public.v_groups_without_instructor AS
SELECT g.id, g.name, g.branch_id, b.name AS branch_name, g.status, g.created_at
FROM public.groups g
JOIN public.branches b ON b.id = g.branch_id
WHERE g.deleted_at IS NULL
  AND g.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.group_instructors gi WHERE gi.group_id = g.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.group_courses gc WHERE gc.group_id = g.id AND gc.instructor_id IS NOT NULL AND gc.status = 'active'
  );

CREATE OR REPLACE VIEW public.v_groups_without_active_course AS
SELECT g.id, g.name, g.branch_id, b.name AS branch_name, g.status, g.created_at
FROM public.groups g
JOIN public.branches b ON b.id = g.branch_id
WHERE g.deleted_at IS NULL
  AND g.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.group_courses gc WHERE gc.group_id = g.id AND gc.status = 'active'
  );

CREATE OR REPLACE VIEW public.v_students_without_finance_account AS
SELECT s.id, s.student_code, s.branch_id, s.created_at
FROM public.students s
WHERE s.deleted_at IS NULL
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.student_financial_accounts fa WHERE fa.student_id = s.id
  );
