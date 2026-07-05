-- ============================================================
-- Sprint 32 — Lead Management & Admissions System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name            TEXT         NOT NULL,
  parent_name           TEXT,
  phone                 TEXT,
  whatsapp              TEXT,
  email                 TEXT,
  age                   INTEGER,
  branch_id             UUID         REFERENCES public.branches(id)  ON DELETE SET NULL,
  interested_course     TEXT,
  source                TEXT         NOT NULL DEFAULT 'website',
  notes                 TEXT,
  status                TEXT         NOT NULL DEFAULT 'NEW',
  assigned_to           UUID         REFERENCES auth.users(id)        ON DELETE SET NULL,
  converted_student_id  UUID         REFERENCES public.students(id)   ON DELETE SET NULL,
  last_contact_at       TIMESTAMPTZ,
  next_follow_up_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT leads_status_check CHECK (
    status IN ('NEW','CONTACTED','INTERESTED','TRIAL_BOOKED','TRIAL_ATTENDED','FOLLOW_UP','CONVERTED','LOST')
  ),
  CONSTRAINT leads_source_check CHECK (
    source IN ('website','facebook_ad','instagram_ad','whatsapp','referral','walk_in','other')
  )
);

-- 2. LEAD TIMELINE (activity feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_timeline (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  note        TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_status         ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_branch_id      ON public.leads(branch_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to    ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at     ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_lead_timeline_lead   ON public.lead_timeline(lead_id);

-- 4. UPDATED_AT TRIGGER (reuse existing function if present)
-- ============================================================
CREATE OR REPLACE FUNCTION public.leads_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_set_updated_at();

-- 5. RLS
-- ============================================================
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_timeline ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS leads_super_admin   ON public.leads;
DROP POLICY IF EXISTS leads_team_leader   ON public.leads;
DROP POLICY IF EXISTS leads_service_role  ON public.leads;
DROP POLICY IF EXISTS lt_super_admin      ON public.lead_timeline;
DROP POLICY IF EXISTS lt_team_leader      ON public.lead_timeline;
DROP POLICY IF EXISTS lt_service_role     ON public.lead_timeline;

-- Service role: unrestricted (server-side code)
CREATE POLICY leads_service_role ON public.leads
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY lt_service_role ON public.lead_timeline
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Super Admin: full access
CREATE POLICY leads_super_admin ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles      r  ON r.id = ur.role_id
      WHERE  ur.user_id = auth.uid()
        AND  r.name     = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles      r  ON r.id = ur.role_id
      WHERE  ur.user_id = auth.uid()
        AND  r.name     = 'super_admin'
    )
  );

-- Team Leader: only their assigned branches (or unassigned leads)
CREATE POLICY leads_team_leader ON public.leads
  FOR ALL TO authenticated
  USING (
    branch_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles      r  ON r.id = ur.role_id
      WHERE  ur.user_id  = auth.uid()
        AND  r.name      = 'team_leader'
        AND  ur.branch_id = public.leads.branch_id
    )
  )
  WITH CHECK (
    branch_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles      r  ON r.id = ur.role_id
      WHERE  ur.user_id  = auth.uid()
        AND  r.name      = 'team_leader'
        AND  ur.branch_id = public.leads.branch_id
    )
  );

-- Timeline: super admin
CREATE POLICY lt_super_admin ON public.lead_timeline
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles      r ON r.id = ur.role_id
      WHERE  ur.user_id = auth.uid()
        AND  r.name     = 'super_admin'
    )
  );

-- Timeline: team leader via lead branch
CREATE POLICY lt_team_leader ON public.lead_timeline
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.leads     l
      JOIN   public.user_roles ur ON (ur.branch_id = l.branch_id OR l.branch_id IS NULL)
      JOIN   public.roles      r  ON r.id = ur.role_id
      WHERE  l.id         = public.lead_timeline.lead_id
        AND  ur.user_id   = auth.uid()
        AND  r.name       IN ('team_leader', 'super_admin')
    )
  );

-- ============================================================
-- END OF MIGRATION
-- ============================================================
