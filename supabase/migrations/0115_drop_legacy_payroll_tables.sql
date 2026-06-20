-- 0115_drop_legacy_payroll_tables.sql
-- Phase XXII — Payroll Simplification Rebuild
--
-- The original payroll system used a batch-run model:
--   payroll_runs → payroll_items → payroll_adjustments
--                               ↘ payroll_session_snapshots
--
-- This system has been fully replaced by the live calculation model
-- (staff-finance module: staff_payroll_profiles, staff_sessions,
-- finance_adjustments, staff_payment_records).
--
-- None of the 4 tables below have any active code references.
-- They contain only test/seed data from the pre-live-system era.
--
-- KEEP: payroll_session_overrides  (used by instructor rate hierarchy)
-- KEEP: staff_payroll_profiles     (main staff table, actively used)
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop in dependency order: children before parents
DROP TABLE IF EXISTS public.payroll_session_snapshots CASCADE;
DROP TABLE IF EXISTS public.payroll_adjustments       CASCADE;
DROP TABLE IF EXISTS public.payroll_items             CASCADE;
DROP TABLE IF EXISTS public.payroll_runs              CASCADE;

-- Schema cache refresh
NOTIFY pgrst, 'reload schema';
