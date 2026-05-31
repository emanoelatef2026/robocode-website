-- ============================================================
-- Sprint 32.2 — Lost Reason + Reopen Lead
-- Run AFTER sprint32-1_lead_ownership.sql
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
