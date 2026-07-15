# Sprint S0 — Security Lockdown

**Date:** 2026-07-15 | **Branch:** main | **Scope:** close every live, exploitable security gap identified in `docs/STUDENT_PARENT_PORTAL_AUDIT.md` §12, verified directly against the production Supabase project (`fkqwafedruparlqjiprq`), not just the migration files.

## Architecture Summary

Enforcement in this codebase is 100% hand-written: every application query uses the service-role Supabase client, which bypasses RLS unconditionally. Real access control lives in two layers — `modules/rbac/guards.ts` (`requireAuth`/`requirePermission`/`requirePortalRole`/`isBranchAccessible`) called at the top of Server Actions, and RLS policies that exist as defense-in-depth but are not exercised by the app today. Both layers had real gaps; both are now closed.

## Root Cause

1. **Database:** a prior hardening pass (2026-07-05, `20260705202917_security_hardening.sql` + `20260705203318_security_hardening_revoke_public.sql`) revoked `EXECUTE` on 26 `SECURITY DEFINER` functions from `anon`/`authenticated`/`PUBLIC`. `user_has_permission(uuid,text,uuid)` was deliberately excluded because ~5 RLS policies call it internally — but it was left with no internal authorization check, so any caller could ask "does arbitrary user X have permission Y" and get an answer, an enumeration/reconnaissance primitive. Three tables (2 backup tables + 1 policy) also carried unrestricted or missing access controls from prior repair sessions.
2. **Application:** 6 Server Action files/9 exported functions were written before the codebase's `requirePermission`/`isBranchAccessible` pattern was applied consistently, and were never retrofitted. `gradeSubmission()`'s branch-scoping only covered the `instructor` role — the `team_leader` branch was added later without the same check.

## Verification Method — why this report differs from the audit

The audit (`docs/STUDENT_PARENT_PORTAL_AUDIT.md`, same day) listed `award_xp()` and ~27 other functions as still anon-executable, based on reading migration *files*. Before writing new fixes, every claim was re-verified against the **live** database via `pg_proc`/`has_function_privilege` and Supabase's own `get_advisors`, because `docs/LMS_FULL_REVIEW_2026-07-05.md` §4 documents known drift between `supabase/migrations/` and what's actually applied to production. Result:

- `award_xp()` and all 26 functions from the 2026-07-05 hardening pass: **confirmed already `REVOKE`d live** (`anon_exec=false`, `authenticated_exec=false` for every one, spot-checked via direct ACL query). The audit's claim they're still exploitable was stale.
- `commit_cohort_graduation()` (created 2026-07-14, not covered by either audit): has an explicit `GRANT EXECUTE ... TO authenticated` in its migration file and a caller-supplied `p_performed_by` with no internal check — but confirmed **not anon/authenticated-executable live**. Documented here as a residual risk to watch, not fixed (no live exposure to fix).
- ~10 functions named in `LMS_FULL_REVIEW_2026-07-05.md` (`repair_finance_balances`, `sync_installments_for_account`, etc.) **do not exist in the live database at all** — their source migrations were never applied to production. No action needed; flagged as the same migration-drift pattern already tracked in that document.
- `user_has_permission(uuid,text,uuid)`: **confirmed live and exploitable** — `anon_exec=true`, `authenticated_exec=true`, and Supabase's own advisor independently flagged it (`anon_security_definer_function_executable`, `authenticated_security_definer_function_executable`). This is the one real, live SECURITY DEFINER gap in Sprint S0's scope.

## Files Modified

**Database (1 migration):** `supabase/migrations/20260715065550_sprint_s0_security_lockdown.sql`

**Application code:**
- `modules/groups/actions/attendance.ts` — `getStudentAttendanceHistoryAction`
- `modules/groups/actions/detail.ts` — `getGroupDetailDataAction`
- `modules/groups/export/queries.ts` — `fetchGroupsExportData`
- `modules/students/group-history.ts` — `getStudentGroupHistory`
- `modules/progress/actions.ts` — `calculateStudentProgress`
- `modules/tasks/actions.ts` — `updateTask`, `dismissTask`, `bulkCreateTasks`
- `modules/assignments/submissions/actions.ts` — `submitAssignment` (guard strength), `gradeSubmission` (TL branch scoping)

**Tests:** `tests/rbac/server-action-guards.test.ts` (new), `tests/progress/wiring.test.ts` (pre-existing mock updated to include `requirePortalRole`, which `submitAssignment` now uses)

## Database Changes

`user_has_permission` — `CREATE OR REPLACE` with the same signature (preserves every dependent RLS policy's grants and behavior) and one added condition in the `WHERE` clause: `AND (p_user_id = auth.uid() OR auth.role() = 'service_role')`. Every one of the ~5 RLS policies that call this function already passes `auth.uid()` as `p_user_id` (confirmed by reading every policy `qual`), and repo-wide grep confirmed zero application code calls this RPC directly — so this closes the enumeration hole with zero behavior change for any real caller.

3 backup tables (`finance_installments_backup_20260706`, `_backup_student_branch_fix_20260706`, `_backup_enrollment_status_fix_20260706` — one more than the audit found) had RLS disabled and were exposed via PostgREST (ERROR-level in the security advisor). Enabled RLS with no policy (deny-all) + revoked direct grants from `anon`/`authenticated`/`PUBLIC`.

`student_parent_contacts.service_full_access` policy was scoped to role `{public}` instead of `{service_role}` — an unrestricted `USING (true) WITH CHECK (true)` `ALL` policy open to every role. Recreated identically but scoped to `service_role` only.

## Permission Changes

| Function | File:Line | Fix |
|---|---|---|
| `getStudentAttendanceHistoryAction` | `modules/groups/actions/attendance.ts` | Added `requirePermission('manage_attendance')` |
| `getGroupDetailDataAction` | `modules/groups/actions/detail.ts` | Fetch group's `branch_id`, added `requirePermission('manage_groups')` + `isBranchAccessible` |
| `fetchGroupsExportData` | `modules/groups/export/queries.ts` | Added `requirePermission('manage_groups')`; caller-supplied `branchIds` AND `groupIds` are now filtered against the caller's actual access via `isBranchAccessible` before any query runs (both arrays were previously trusted verbatim) |
| `getStudentGroupHistory` | `modules/students/group-history.ts` | Added `requirePermission('manage_students')` |
| `calculateStudentProgress` | `modules/progress/actions.ts` | Added `requireAuth()` |
| `updateTask` / `dismissTask` | `modules/tasks/actions.ts` | Added `requirePermission('manage_students')` + fetch-then-`isBranchAccessible` |
| `bulkCreateTasks` | `modules/tasks/actions.ts` | Added `requirePermission('manage_students')` — verified its only real caller (`/api/automation/run`) already authenticates before reaching this function, so no functional regression |
| `submitAssignment` | `modules/assignments/submissions/actions.ts` | `requireAuth()` → `requirePortalRole('student')`, matching sibling student actions |
| `gradeSubmission` | `modules/assignments/submissions/actions.ts` | Added a `team_leader` branch-scoping check (fetch submission → student → group → `branch_id`, `isBranchAccessible`) — previously team_leaders could grade any submission in any branch |

## Security Improvements

- Closed the `user_has_permission` enumeration oracle (live, confirmed exploitable via both direct ACL check and Supabase's own advisor).
- Closed direct PostgREST exposure of 3 backup tables containing finance/student-repair data.
- Closed an unrestricted `ALL` RLS policy on `student_parent_contacts` that was open to every role instead of just `service_role`.
- Closed 9 IDOR/zero-guard Server Action functions exposing student PII (phone, DOB, guardian phone), finance balances, and attendance history to any caller regardless of role or branch.
- Closed a cross-branch grading gap that let a team_leader grade (and trigger XP/progress side effects for) a student outside their assigned branch.

## Performance Impact

None measurable. All guard additions are in-memory session checks (no extra DB round trip) except `getGroupDetailDataAction` and the two `tasks/actions.ts` mutation functions, which each add one small indexed lookup (`groups.id` / `operational_tasks.id`) before the existing query — negligible relative to the multi-query aggregations they guard.

## Tests Added

`tests/rbac/server-action-guards.test.ts` — 11 tests covering all 9 fixed functions: guard-call verification, branch-mismatch rejection, and (for `gradeSubmission`) both the negative (cross-branch TL forbidden) and positive (same-branch TL allowed) paths.

## Manual QA Results

Run against the production project via rolled-back SQL transactions (no data changed):

1. **Anonymous-context probe** — `user_has_permission(<arbitrary user id>, 'manage_system', null)` called with no JWT context (simulating anon) → `false`.
2. **Cross-user probe under a real authenticated context** — `set_config('request.jwt.claims', ...)` to simulate user A's session, then called `user_has_permission(<user B's id>, 'manage_system', null)` → `false`.
3. **Self-check under the same context** — `user_has_permission(<user A's own id>, 'manage_system', null)` → `true`, confirming the fix is fully behavior-preserving for the only legitimate call shape (every RLS policy passes `auth.uid()`).
4. **Advisors re-run after the migration** — the 3 backup tables' `rls_disabled_in_public` (ERROR) findings are gone (now `rls_enabled_no_policy`, INFO, expected/inert); the `student_parent_contacts` "always true policy" WARN is gone.

## Remaining Risks

- `user_has_permission` still shows as a WARN in the security advisor (`anon_security_definer_function_executable`) — this is **expected and intentional**: `EXECUTE` was not revoked (revoking it would break the RLS policies that call it), the internal check is what closes the actual exploit. The linter can't see the internal `auth.uid()` guard, only the grant.
- `commit_cohort_graduation()` has a caller-supplied `p_performed_by` with no internal check and an explicit `GRANT ... TO authenticated` in its migration file. It is confirmed **not currently exploitable live** (not anon/authenticated-executable), but if a future migration ever re-grants it without also fixing the parameter trust issue, it becomes the same class of bug as the original `award_xp` finding. Recommend addressing in a future hardening pass, not urgent today.
- 29 tables with RLS enabled and no policy remain (INFO-level, confirmed inert since the app never uses the RLS-bound client). Not fixed in this sprint — writing 29 correct policies without a specified access model would be guesswork; deferred to whichever future sprint first needs an RLS-bound client.
- `docs/legacy-migrations/` drift (functions whose source isn't tracked in `supabase/migrations/`) is a pre-existing, separately-documented issue (`LMS_FULL_REVIEW_2026-07-05.md` §4) — out of this sprint's scope.

## Recommendations

- Before any future Server Action is added, use `getGroupDetailDataAction`'s fix (fetch-then-`isBranchAccessible`) or `modules/attendance/actions.ts`'s pattern (`requirePermission(..., {branchId})`) as the template — both are now the only two idioms in active use for branch-scoped guards.
- Reconcile `docs/legacy-migrations/` against production so migration-drift stops being a recurring source of "already fixed" vs. "still broken" confusion in future audits.
