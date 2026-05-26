-- Migration: 0013_audit
-- Purpose: Append-only, immutable audit log for all LMS mutations
-- Dependencies: 0003_organization
--
-- ARCHITECTURE NOTE: partitioning removed intentionally.
-- At current LMS scale (small team, low write volume) a plain table with indexes
-- is sufficient for tens of millions of rows. Partitioning requires either a
-- cron job or pg_partman to pre-create monthly partitions; without it, inserts
-- fail when no partition covers the current date. Add pg_partman-managed
-- partitioning when the table exceeds ~20M rows or when bulk expiry of old
-- audit data becomes a requirement.
--
-- IMMUTABILITY CONTRACT:
--   - No UPDATE policy. No DELETE policy. Ever.
--   - All writes go through write_audit_log() (SECURITY DEFINER).
--   - Service role bypasses RLS but the function signature is the only
--     sanctioned write path from application code.

-- ─── Audit log table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              BIGSERIAL    PRIMARY KEY,
  performed_by    UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  impersonated_by UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  action          TEXT         NOT NULL,
  entity_type     TEXT         NOT NULL,
  entity_id       UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  branch_id       UUID         REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS
  'Append-only audit trail. Rows are immutable — no UPDATE or DELETE permitted. '
  'All writes go through write_audit_log(). '
  'Add pg_partman partitioning when table exceeds ~20M rows.';

-- ─── Write function (sole sanctioned insert path) ────────────────────────────
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_performed_by  UUID,
  p_action        TEXT,
  p_entity_type   TEXT,
  p_entity_id     UUID  DEFAULT NULL,
  p_old_values    JSONB DEFAULT NULL,
  p_new_values    JSONB DEFAULT NULL,
  p_branch_id     UUID  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    performed_by,   action,        entity_type,  entity_id,
    old_values,     new_values,    branch_id
  ) VALUES (
    p_performed_by, p_action,      p_entity_type, p_entity_id,
    p_old_values,   p_new_values,  p_branch_id
  );
END;
$$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity       ON public.audit_logs(entity_type,   entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch       ON public.audit_logs(branch_id,     created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON public.audit_logs(action,        created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_logs'
      AND policyname = 'audit_logs_read_by_authorized'
  ) THEN
    DROP POLICY "audit_logs_read_by_authorized" ON public.audit_logs;
  END IF;
END $$;

CREATE POLICY "audit_logs_read_by_authorized"
  ON public.audit_logs FOR SELECT
  USING (
    public.user_has_permission(auth.uid(), 'read_audit_logs')
    AND (
      (
        branch_id IS NULL
        AND public.user_has_permission(auth.uid(), 'manage_system')
      )
      OR branch_id IN (
        SELECT DISTINCT branch_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND branch_id IS NOT NULL
      )
    )
  );

-- No INSERT policy — write_audit_log() is SECURITY DEFINER; service role bypasses RLS.
-- No UPDATE policy — intentionally omitted (immutability contract).
-- No DELETE policy — intentionally omitted (immutability contract).
