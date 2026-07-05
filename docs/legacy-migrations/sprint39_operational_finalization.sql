-- Sprint 39: Team Leader Operational Architecture Finalization
-- Purpose: Close remaining schema gaps, add automation foundations, harden integrity
-- Run after: sprint38_integrity_audit.sql

-- ─── 1. leads.converted_at — ensure index ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_converted_at
  ON public.leads (converted_at)
  WHERE status = 'CONVERTED';

-- ─── 2. Assignments: branch-aware visibility via group_courses ───────────────
-- No schema change needed; query logic resolves via schedules→group_courses→groups

-- ─── 3. Operational automation foundation ────────────────────────────────────
-- notification_queue: lightweight table for pending automated messages
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('finance','attendance','assignments','leads','system')),
  channel      TEXT NOT NULL DEFAULT 'portal' CHECK (channel IN ('portal','whatsapp','email')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status
  ON public.notification_queue (status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_queue_branch
  ON public.notification_queue (branch_id, status);

-- ─── 4. operational_activity_log ─────────────────────────────────────────────
-- Records TL-initiated operational actions (reminders, escalations, assignments)
CREATE TABLE IF NOT EXISTS public.operational_activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  actor_id     UUID REFERENCES public.users(id)    ON DELETE SET NULL,
  entity_type  TEXT NOT NULL,  -- 'student' | 'lead' | 'finance' | 'instructor' | 'group'
  entity_id    UUID,
  action       TEXT NOT NULL,  -- 'reminder_sent' | 'escalated' | 'followed_up' | etc
  notes        TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_log_branch_created
  ON public.operational_activity_log (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_op_log_entity
  ON public.operational_activity_log (entity_type, entity_id);

-- ─── 5. RLS for new tables ────────────────────────────────────────────────────
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_activity_log ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "super_admin_notification_queue" ON public.notification_queue
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY "super_admin_op_log" ON public.operational_activity_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- Team leaders: own branches
CREATE POLICY "team_leader_notification_queue" ON public.notification_queue
  FOR SELECT TO authenticated
  USING (
    branch_id IN (
      SELECT ur.branch_id FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'team_leader'
        AND ur.branch_id IS NOT NULL
    )
  );

CREATE POLICY "team_leader_op_log" ON public.operational_activity_log
  FOR ALL TO authenticated
  USING (
    branch_id IN (
      SELECT ur.branch_id FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'team_leader'
        AND ur.branch_id IS NOT NULL
    )
  );

-- ─── 6. Additional diagnostic views ──────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_instructor_branch_coverage AS
-- Shows instructors and all branches they cover (home + pivot + group_courses)
SELECT DISTINCT
  i.id            AS instructor_id,
  i.branch_id     AS home_branch_id,
  COALESCE(ib.branch_id, gc_g.branch_id, i.branch_id) AS covered_branch_id,
  CASE
    WHEN ib.branch_id IS NOT NULL THEN ib.role
    WHEN gc_g.branch_id IS NOT NULL THEN 'teaching'
    ELSE 'home'
  END AS coverage_type
FROM public.instructors i
LEFT JOIN public.instructor_branches ib ON ib.instructor_id = i.id
LEFT JOIN public.group_courses gc ON gc.instructor_id = i.id AND gc.status = 'active'
LEFT JOIN public.groups gc_g ON gc_g.id = gc.group_id
WHERE i.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_finance_risk_accounts AS
-- Overdue accounts with no activity in the last 14 days
SELECT
  fa.id             AS account_id,
  fa.student_id,
  fa.branch_id,
  fa.remaining_amount,
  fa.next_due_date,
  fa.status,
  MAX(ca.created_at) AS last_activity_at,
  CURRENT_DATE - fa.next_due_date::date AS days_overdue
FROM public.student_financial_accounts fa
LEFT JOIN public.collection_activities ca ON ca.account_id = fa.id
WHERE fa.status = 'OVERDUE'
  AND fa.remaining_amount > 0
GROUP BY fa.id, fa.student_id, fa.branch_id, fa.remaining_amount, fa.next_due_date, fa.status
HAVING MAX(ca.created_at) IS NULL
    OR MAX(ca.created_at) < NOW() - INTERVAL '14 days';

CREATE OR REPLACE VIEW public.v_overdue_lead_followups AS
-- Leads past their follow-up date and not yet converted/lost
SELECT
  l.id,
  l.child_name,
  l.parent_name,
  l.phone,
  l.branch_id,
  l.assigned_to,
  l.status,
  l.next_follow_up_at,
  CURRENT_DATE - l.next_follow_up_at::date AS days_overdue
FROM public.leads l
WHERE l.status NOT IN ('CONVERTED', 'LOST')
  AND l.next_follow_up_at IS NOT NULL
  AND l.next_follow_up_at::date < CURRENT_DATE;

CREATE OR REPLACE VIEW public.v_sessions_missing_attendance AS
-- Completed sessions without any attendance records
SELECT
  s.id          AS schedule_id,
  s.branch_id,
  s.scheduled_at,
  s.status,
  gc.group_id,
  g.name        AS group_name,
  b.name        AS branch_name
FROM public.schedules s
JOIN public.group_courses gc ON gc.id = s.group_course_id
JOIN public.groups g         ON g.id  = gc.group_id
JOIN public.branches b       ON b.id  = s.branch_id
WHERE s.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance_records ar WHERE ar.schedule_id = s.id
  )
  AND s.scheduled_at >= NOW() - INTERVAL '30 days';

-- ─── 7. Safety: add instructor_code auto-generation trigger ──────────────────
-- Generate instructor codes like INS-2026-001 if not set on insert
CREATE OR REPLACE FUNCTION public.auto_generate_instructor_code()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_val  INT;
  new_code TEXT;
BEGIN
  IF NEW.instructor_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(CAST(SPLIT_PART(instructor_code, '-', 3) AS INT)), 0) + 1
    INTO seq_val
    FROM public.instructors
    WHERE instructor_code LIKE 'INS-' || year_str || '-%';

  new_code := 'INS-' || year_str || '-' || LPAD(seq_val::TEXT, 3, '0');
  NEW.instructor_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_instructor_code
  BEFORE INSERT ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_instructor_code();

-- ─── 8. Harden group_students unique constraint ───────────────────────────────
-- Prevent duplicate active enrollments per student per group
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_group_students_active'
  ) THEN
    -- Create partial unique index instead of constraint (allows inactive duplicates)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_group_students_active
      ON public.group_students (group_id, student_id)
      WHERE status = 'active';
  END IF;
END $$;
