-- Sprint 41: Enrollment-Centric Architecture Refactor
-- Purpose: Introduce student_enrollments as the central operational unit.
--          All changes are ADDITIVE. No existing columns are dropped or altered.
--          Safe to re-run: uses IF NOT EXISTS and WHERE NOT EXISTS guards.
-- Run after: sprint39_5_integrity_audit.sql

-- ─── 1. student_enrollments — the enrollment unit ────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core relationships
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  group_course_id UUID REFERENCES public.group_courses(id) ON DELETE SET NULL,
  instructor_id   UUID REFERENCES public.instructors(id) ON DELETE SET NULL,

  -- Link back to the original group_students row (for dual-write tracking)
  group_student_id UUID REFERENCES public.group_students(id) ON DELETE SET NULL,

  -- Lifecycle
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date   DATE,
  status     TEXT NOT NULL DEFAULT 'ACTIVE'
             CHECK (status IN ('ACTIVE','PAUSED','TRANSFERRED','COMPLETED','DROPPED')),
  enrollment_type TEXT NOT NULL DEFAULT 'primary'
             CHECK (enrollment_type IN ('primary','secondary')),

  -- Contracted pricing (snapshot at enrollment time)
  pricing_plan    TEXT,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Aggregate stats (denormalized for fast reads; updated by triggers/jobs)
  expected_sessions     INTEGER NOT NULL DEFAULT 0,
  attendance_count      INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Transfer chain
  transferred_from UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  transferred_to   UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,

  notes      TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one ACTIVE enrollment per student per group
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_enrollments_active
  ON public.student_enrollments (student_id, group_id)
  WHERE status = 'ACTIVE' AND group_id IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_enrollment_branch_status
  ON public.student_enrollments (branch_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_student
  ON public.student_enrollments (student_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_group
  ON public.student_enrollments (group_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_gc
  ON public.student_enrollments (group_course_id, status);

-- ─── 2. Link financial accounts to enrollments (additive) ────────────────────

ALTER TABLE public.student_financial_accounts
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sfa_enrollment
  ON public.student_financial_accounts (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- ─── 3. Link attendance records to enrollments (additive) ────────────────────

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS enrollment_id UUID
  REFERENCES public.student_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ar_enrollment
  ON public.attendance_records (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- ─── 4. Backfill: student_enrollments from group_students ────────────────────
-- Creates one enrollment row per group_students row.
-- Idempotent: WHERE NOT EXISTS guard prevents duplicates on re-run.

INSERT INTO public.student_enrollments (
  id, student_id, branch_id, group_id, group_course_id, instructor_id,
  group_student_id, start_date, end_date, status, enrollment_type,
  total_amount, discount_amount, net_amount,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  gs.student_id,
  g.branch_id,
  gs.group_id,
  gc_active.id,
  gc_active.instructor_id,
  gs.id,
  -- start_date: prefer joined_at cast, then group start_date, then today
  COALESCE(gs.joined_at::date, g.start_date, CURRENT_DATE),
  gs.left_at::date,
  CASE gs.status
    WHEN 'active'     THEN 'ACTIVE'
    WHEN 'dropped'    THEN 'DROPPED'
    WHEN 'graduated'  THEN 'COMPLETED'
    WHEN 'paused'     THEN 'PAUSED'
    WHEN 'waitlisted' THEN 'PAUSED'
    ELSE 'ACTIVE'
  END,
  gs.enrollment_type,
  COALESCE(sfa_linked.total_amount, 0),
  COALESCE(sfa_linked.discount_amount, 0),
  COALESCE(sfa_linked.net_amount, 0),
  now(),
  now()
FROM public.group_students gs
JOIN public.groups g ON g.id = gs.group_id
-- Active group_course for this group (the one currently running)
LEFT JOIN LATERAL (
  SELECT id, instructor_id
  FROM public.group_courses
  WHERE group_id = gs.group_id AND status = 'active'
  LIMIT 1
) gc_active ON true
-- Prefer group-specific financial account; fall back to no-group account
LEFT JOIN LATERAL (
  SELECT total_amount, discount_amount, net_amount
  FROM public.student_financial_accounts
  WHERE student_id = gs.student_id
  ORDER BY (group_id = gs.group_id) DESC NULLS LAST
  LIMIT 1
) sfa_linked ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.student_enrollments se
  WHERE se.group_student_id = gs.id
);

-- ─── 5. Backfill: link financial accounts to their enrollments ────────────────

-- Case A: account has a group_id → link to the enrollment for that group
UPDATE public.student_financial_accounts sfa
SET enrollment_id = se.id
FROM public.student_enrollments se
WHERE se.student_id = sfa.student_id
  AND se.group_id   = sfa.group_id
  AND sfa.group_id IS NOT NULL
  AND sfa.enrollment_id IS NULL;

-- Case B: account has no group_id → link to the student's most-recent ACTIVE enrollment
UPDATE public.student_financial_accounts sfa
SET enrollment_id = (
  SELECT id FROM public.student_enrollments
  WHERE student_id = sfa.student_id
    AND status = 'ACTIVE'
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE sfa.group_id IS NULL
  AND sfa.enrollment_id IS NULL;

-- ─── 6. RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

-- Super admin: unrestricted
CREATE POLICY IF NOT EXISTS "super_admin_enrollments"
  ON public.student_enrollments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Team leaders: own branches only
CREATE POLICY IF NOT EXISTS "tl_enrollments_own_branches"
  ON public.student_enrollments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'team_leader'
        AND ur.branch_id = student_enrollments.branch_id
    )
  );

-- Students: own enrollments only
CREATE POLICY IF NOT EXISTS "student_own_enrollments"
  ON public.student_enrollments FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

-- ─── 7. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_updated_at ON public.student_enrollments;
CREATE TRIGGER trg_enrollment_updated_at
  BEFORE UPDATE ON public.student_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 8. Diagnostic view: enrollment health ────────────────────────────────────

CREATE OR REPLACE VIEW public.v_enrollment_health AS
SELECT
  se.id                           AS enrollment_id,
  se.status,
  se.branch_id,
  se.group_id,
  se.start_date,
  se.enrollment_type,
  s.student_code,
  u.email                         AS student_email,
  g.name                          AS group_name,
  b.name                          AS branch_name,
  sfa.status                      AS fin_status,
  sfa.remaining_amount,
  sfa.next_due_date,
  se.attendance_count,
  se.expected_sessions,
  CASE WHEN se.expected_sessions > 0
    THEN ROUND((se.attendance_count::numeric / se.expected_sessions) * 100, 1)
    ELSE NULL
  END                             AS attendance_pct,
  se.updated_at
FROM public.student_enrollments se
JOIN public.students s ON s.id = se.student_id
JOIN public.users    u ON u.id = s.user_id
JOIN public.branches b ON b.id = se.branch_id
LEFT JOIN public.groups g ON g.id = se.group_id
LEFT JOIN public.student_financial_accounts sfa ON sfa.enrollment_id = se.id
WHERE se.status = 'ACTIVE';

-- ─── 9. Diagnostic view: unlinked financial accounts ─────────────────────────
-- Surfaces accounts that still need manual enrollment linkage review.

CREATE OR REPLACE VIEW public.v_unlinked_finance_accounts AS
SELECT
  sfa.id          AS account_id,
  sfa.student_id,
  sfa.group_id,
  sfa.status,
  sfa.remaining_amount,
  u.email         AS student_email,
  b.name          AS branch_name
FROM public.student_financial_accounts sfa
JOIN public.students s ON s.id = sfa.student_id
JOIN public.users    u ON u.id = s.user_id
JOIN public.branches b ON b.id = sfa.branch_id
WHERE sfa.enrollment_id IS NULL;
