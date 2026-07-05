-- ============================================================
-- Sprint 32.1 — Lead Ownership & Accountability System
-- Run AFTER sprint32_leads.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. ADD NEW COLUMNS TO leads
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill stage_entered_at = created_at for existing rows
UPDATE public.leads
SET stage_entered_at = created_at
WHERE stage_entered_at = updated_at OR stage_entered_at IS NULL;

-- Backfill assigned_at for rows that already have an assigned_to
UPDATE public.leads
SET assigned_at = created_at
WHERE assigned_to IS NOT NULL AND assigned_at IS NULL;

-- 2. LEAD ASSIGNMENT HISTORY (full audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason       TEXT,
  assigned_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at       ON public.leads(assigned_at);
CREATE INDEX IF NOT EXISTS idx_leads_stage_entered_at  ON public.leads(stage_entered_at);
CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_lead   ON public.lead_assignment_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assign_hist_to     ON public.lead_assignment_history(to_user_id);

-- 4. RLS for assignment history
-- ============================================================
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lah_service_role   ON public.lead_assignment_history;
DROP POLICY IF EXISTS lah_super_admin    ON public.lead_assignment_history;
DROP POLICY IF EXISTS lah_team_leader    ON public.lead_assignment_history;

CREATE POLICY lah_service_role ON public.lead_assignment_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY lah_super_admin ON public.lead_assignment_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

CREATE POLICY lah_team_leader ON public.lead_assignment_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.leads l
      JOIN   public.user_roles ur ON (ur.branch_id = l.branch_id OR l.branch_id IS NULL)
      JOIN   public.roles r ON r.id = ur.role_id
      WHERE  l.id = public.lead_assignment_history.lead_id
        AND  ur.user_id = auth.uid()
        AND  r.name IN ('team_leader', 'super_admin')
    )
  );

-- ============================================================
-- END OF MIGRATION
-- ============================================================
