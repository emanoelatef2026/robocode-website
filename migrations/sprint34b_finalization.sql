-- ============================================================
-- Sprint 34b — Super Admin OS Finalization
-- Run AFTER sprint34_super_admin_complete.sql
-- ============================================================

-- ── NO NEW COLUMNS REQUIRED ──────────────────────────────────────────────────
-- All pages in this sprint read from existing tables.
-- The parent_messages table exists from migration 0046_parent_messages.sql.
-- The leads, lead_timeline, user_roles tables exist from prior sprints.
-- The deleteTeamLeader action uses user_permissions table (must exist).

-- ── Verify user_permissions table exists ─────────────────────────────────────
-- If this errors, run the earlier migration that creates user_permissions.
-- SELECT COUNT(*) FROM public.user_permissions;

-- ── Verify parent_messages table ─────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.parent_messages;

-- ── Force PostgREST schema reload (safe to run anytime) ──────────────────────
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================
-- SPRINT 34b CHANGES SUMMARY
-- ============================================================
--
-- PAGES REBUILT (no schema changes):
--   /admin (attendance) → Sessions Monitor (observe-only, removes Record button)
--   /admin/assignments  → Assignment Intelligence Center (monitor, no creation)
--   /admin/analytics    → 5 domains: Academic, Operations, Marketing, Instructors, Branches
--   /admin/communications → Hardened with try/catch, simplified joins
--   /admin              → Executive command center with Today/Month/Alerts/TopPerformers
--   /admin/sessions     → Redirect to /admin/attendance
--
-- ACTIONS ADDED:
--   deleteTeamLeader() in modules/team-leaders/actions.ts
--     - Removes user_roles + metadata
--     - Optionally transfers or unassigns leads
--     - Logs to lead_timeline and audit_log
--     - Does NOT delete students, groups, or certificates
--
-- UI CHANGES:
--   AdminSidebar: "Sessions" + "Attendance" merged → "Sessions Monitor"
--   TLActionButtons: Added "Delete" panel with confirmation + lead reassignment
--
-- ============================================================
-- END OF MIGRATION
-- ============================================================
