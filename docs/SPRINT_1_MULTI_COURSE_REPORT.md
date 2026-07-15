# Sprint 1 — Multi-Course Correctness

**Date:** 2026-07-15 | **Branch:** main | **Scope:** make the data both portals display actually match the business rule (a student may study multiple courses simultaneously — no primary course, no primary group), per `docs/STUDENT_PARENT_PORTAL_AUDIT.md` §6/§9/§10.

## Architecture Summary

`resolvePrimaryActiveGroupId()` (`modules/academic/enrollment-integrity.ts`) picks exactly one active group (FIFO by `joined_at`) and was used by 11 call sites across both portals to scope dashboards, attendance, certificate eligibility, timelines, and feedback prompts to that one group — silently hiding a second concurrently-active course everywhere except the (already-correct) Assignments list and Progress page. A sibling resolver, `resolveActiveGroupIds()`, now returns every active group; the highest-impact call sites were updated to aggregate across all of them instead of picking one, reusing the existing UI components (no redesign) rather than rendering a single-group view.

## Root Cause

Two independent root causes, not one:

1. **Query-layer assumption.** Every affected query used `.eq('group_id', groupId)` (one group) instead of `.in('group_id', activeGroupIds)` (all active groups) — a straightforward but pervasive single-course assumption baked in when the schema was still single-course-only.
2. **Incomplete migration, not just a stale query.** The audit described the parent-finance bug as `getParentChildFinance()` not filtering by `enrollment_id`. Live inspection during planning found the real root cause is deeper: migration `0054_schema_reconciliation.sql` (which added `student_financial_accounts.enrollment_id` and a partial unique index to allow multiple accounts per student) **never fully landed on production** — the legacy `UNIQUE(student_id)` constraint was still live, confirmed via `pg_constraint`. This meant a student could not physically have a second financial account at all, regardless of what the query layer did. Verified against the one real production student with 2 concurrent active enrollments: 1 account, linked to only one of the two enrollments — the second enrollment could never get its own account until this sprint's migration.

## Files Modified

**Database (1 migration):** `supabase/migrations/20260715070334_sprint1_finish_multi_account_finance.sql`

**Query layer:**
- `modules/academic/enrollment-integrity.ts` — added `resolveActiveGroupIds()`
- `modules/finance/queries.ts` — `getParentChildFinance()` rewritten (multi-account)
- `modules/enrollments/queries.ts` — `listStudentEnrollments()` (ownership check added)
- `modules/student-portal/queries.ts` — `getStudentDashboardData()`, `getCertificateEligibility()`, `getStudentAttendanceHistory()`, `getStudentTimeline()`
- `modules/parents/parent-portal-queries.ts` — `getChildDashboardData()`, `getChildSessionsProgress()`, `getChildAttendance()`
- `modules/feedback/queries.ts` — `getPendingFeedbackSessions()`

**UI (data-shape changes only, no redesign):**
- `app/portal/parent/finance/page.tsx` — renders one account card per financial account instead of one total; distinguishes "access denied" from "no account yet"
- `app/portal/student/certificates/page.tsx` — renders one eligibility card per active course instead of one
- `app/portal/student/leaderboard/page.tsx` — delegates to the shared resolver instead of re-implementing the group lookup

**Tests:** `tests/multi-course/` (5 new files, 14 tests)

## Database Changes

Finished `0054_schema_reconciliation.sql`:
```sql
ALTER TABLE student_financial_accounts DROP CONSTRAINT student_financial_accounts_student_id_key;
CREATE UNIQUE INDEX idx_sfa_unique_student_no_enrollment ON student_financial_accounts(student_id) WHERE enrollment_id IS NULL;
```
A student can now hold one financial account per `enrollment_id` (the intended multi-course design) while legacy accounts with no enrollment link stay capped at one per student.

## Query Improvements

| Function | Before | After |
|---|---|---|
| `getStudentDashboardData` / `getChildDashboardData` | Session counts, attendance, assignments, progress all scoped to one group | Summed/averaged across every active group; header (group/course/instructor name) still shows the primary group since a merged multi-course header would require a UI redesign, out of this sprint's scope — but every *number* is now a true multi-course total |
| `getCertificateEligibility` | One eligibility object for one course | One entry per active course (certificates are inherently per-course; audit §6.6 flagged the single-course card sitting above a multi-course cert list) |
| `getStudentAttendanceHistory` / `getStudentTimeline` / `getPendingFeedbackSessions` | Sessions from one group's courses | Sessions unioned across every active group's courses — pure query-layer change, no consumer shape change needed since these were already list-shaped |
| `getChildSessionsProgress` | One enrollment's session package (the number actually rendered on the parent dashboard) | Summed across every active enrollment |
| `getParentChildFinance` | `.eq('student_id', studentId).maybeSingle()` — one account, silently wrong/null for 2+ accounts | One entry per account; `null` (denied) vs `[]` (genuinely none) are now distinguishable, fixing the misleading "no account found" message the audit flagged (§6, Parent Portal item 2) |
| `listStudentEnrollments` | No ownership check — safe only because its one caller pre-validated the id | Takes `parentUserId`, verifies via `verifyParentChild()` internally |
| Leaderboard (`app/portal/student/leaderboard/page.tsx`) | Inline query sorted `joined_at` **descending** — opposite of `resolvePrimaryActiveGroupId`'s **ascending** | Calls the shared resolver directly; the two can no longer drift because there is only one implementation left |
| `getChildAttendance` | Unbounded query, grows with account age | Capped at 500 rows (not the sibling functions' 50 — this computes an all-time summary, and 50 would silently make the attendance percentage wrong for any long-tenured student; documented deviation from the original plan's literal "match the 50-row siblings" wording) |

**Deliberately not done:** a single shared helper unifying `getChildEnrollmentContracts` / `getParentChildFinance` / `listStudentEnrollments` into one function, as originally scoped. `getChildEnrollmentContracts` was already confirmed correct and reused as the reference join pattern for `getParentChildFinance`'s rewrite; forcing all three into one function would have meant reworking `listStudentEnrollments`'s admin-shape response (branch/instructor names, snapshot columns) to fit a parent-finance-shaped return type, or vice versa — a larger, higher-risk refactor than the actual bug required. The concrete correctness bug (`getParentChildFinance`) and the concrete security gap (`listStudentEnrollments`'s missing ownership check) are both fixed; full consolidation is left as a lower-risk follow-up.

## Performance Impact

Neutral to slightly positive. Most changes replace one `.eq()` query with one `.in()` query over the same table (no additional round trips). `getCertificateEligibility` and `getPendingFeedbackSessions` now do a small number of additional lookups (group names, group_course mapping) proportional to the student's course count (1-2 in practice, not unbounded). `get_advisors` (performance) re-run after both migrations: 404 total findings, identical count to the pre-sprint baseline — no new findings introduced.

## Tests Added

`tests/multi-course/` (14 tests):
- `resolve-active-groups.test.ts` — FIFO ordering invariant between the two resolvers
- `certificate-eligibility.test.ts` — one entry per active course; empty-state handling
- `finance.test.ts` — multi-account `getParentChildFinance` (including the null-vs-empty-array distinction) + `listStudentEnrollments` ownership enforcement
- `parent-dashboard.test.ts` — `getChildSessionsProgress` summing across enrollments; `getChildAttendance`'s query cap
- `leaderboard-sort.test.ts` — source-level contract test confirming the page delegates to the shared resolver

Full suite: 429/429 passing (415 pre-existing + 14 new), including one pre-existing test (`tests/progress/wiring.test.ts`) whose `@/modules/rbac/guards` mock needed `requirePortalRole` added after Sprint S0's `submitAssignment` guard-strength fix.

## Manual QA Results

Via a rolled-back SQL transaction against production: inserted a second `student_financial_accounts` row (linked to the previously-unlinked second active enrollment) for the one real production student with 2 concurrent active enrollments — succeeded (previously would have violated the `UNIQUE(student_id)` constraint), confirmed 2 accounts existed inside the transaction, then rolled back — production data unchanged. No manual data edits were made outside this rolled-back verification.

## Remaining Risks

- Only 1 student in production currently has 2+ concurrent active enrollments, so this sprint's real-world blast radius today is small — but the fixes are structural (query-layer, not per-student patches) and will apply automatically as more multi-course enrollments are created.
- The dashboard header (group/course/instructor name, day/time) still shows only the "primary" course label even though the underlying stats are now multi-course totals — a family in 2 courses will see correct combined numbers under a single course's name. Full per-course breakdown in the dashboard header is a UI change, explicitly out of this sprint's "no redesign" scope; flagged for the Sprint 5 (Portal UX Repair) roadmap item.
- `getStudentDashboardData`'s enrollment-window date filter now uses the **earliest** of all active enrollments' `start_date` as a floor (previously the primary enrollment's own date) — this can only be more permissive, never exclude a legitimate session, but is a documented tradeoff worth revisiting if a future case has widely different start dates across concurrent courses.

## Recommendations

- Extend the same `resolveActiveGroupIds()` pattern to the remaining single-group assumptions the audit catalogued but this sprint didn't reach in depth (Sprint 1's own roadmap explicitly deferred full dashboard-header redesign and the 3-way finance-helper consolidation to later sprints).
- When Sprint 5 (Portal UX Repair) is scheduled, use the certificate-eligibility page's "one card per course" pattern as the template for giving the dashboard header the same treatment.
