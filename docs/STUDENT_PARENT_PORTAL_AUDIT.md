# Student & Parent Portal — Full Product Audit

**Date:** 2026-07-15 | **Branch:** main | **Scope:** `app/portal/student/**`, `app/portal/parent/**`, and every server module they depend on (notes, evaluations/grading, gamification, RBAC, notifications, finance, database schema).

**Method:** Read-only. No code, migrations, or files were modified to produce this report. Findings are based on direct reading of the current implementation (five parallel research passes covering Student Portal, Parent Portal, Notes/Evaluation systems, RBAC/Gamification, and server-side performance), a live schema + advisor pull from the production Supabase project (`fkqwafedruparlqjiprq`), and cross-referencing against `docs/LMS_FULL_REVIEW_2026-07-05.md` (general system review, 10 days prior) and the closed 2026-07-07 UX bug-fix audit (memory). Every claim below is either freshly verified or explicitly marked as carried over from a prior source. Where a prior audit's finding turned out to be stale, this report says so explicitly (see §4).

**Headline:** the LMS foundation (auth, RBAC skeleton, gamification engine, finance ledger, cohort lifecycle) is real and mostly sound. But three things are true at once: (1) there are live, exploitable security gaps that must close before any public rebuild ships, independent of any redesign decision; (2) the Student and Parent Portals both violate the stated "multi-course" business rule at the data layer, not just in the UI; (3) two concepts the mission explicitly asked us to audit — **evaluations** and **competitions** — do not exist anywhere in the codebase as first-class entities. This report treats those as findings, not surprises.

---

## 1. Current Architecture

**Stack:** Next.js (App Router) + Supabase/Postgres, server-rendered. Both portals are 100% Server Components performing direct `createServiceClient()` (service-role) queries at request time; mutations go through Server Actions. There are no API routes, no client-side data-fetching library (no SWR/React Query), and — confirmed by repo-wide grep — **zero caching anywhere in the codebase** (`unstable_cache`, React `cache()`, and `revalidate` exports all return zero hits). `revalidatePath`/`revalidateTag` calls exist in 54 action files but only invalidate the Next.js router cache, which has no read-side data cache to compensate for. This is a systemic, codebase-wide characteristic, not a student/parent-specific regression — the admin and TL portals have the identical pattern.

**Auth/session:** `modules/rbac/guards.ts` — `getCurrentUser()` reads a signed `lms_session` cookie (no DB round trip per request); `requireAuth()`, `requirePermission()`, `requirePortalRole()`, `isBranchAccessible()` are the core guards (see §12 for the full RBAC picture). Permissions are resolved once at login from `user_roles → roles → role_permissions → permissions` and cached in the session cookie.

**Portal shells:**
- Student: `app/portal/student/layout.tsx` → `requirePortalRole('student')` + `getStudentDashboardData(user.id)` → `StudentShell.tsx` (`StudentSidebar` desktop, `StudentBottomNav` mobile with a "More" sheet for overflow items).
- Parent: `app/portal/parent/layout.tsx` → `requirePortalRole('parent')` + `getParentChildren(user.id)` → `ParentShell.tsx`, which now uses the shared `components/admin/AdminTopbar.tsx` (migrated in the 2026-07-07 audit — confirmed still true), with `ParentSidebar`/`ParentBottomNav`.

**Data ownership pattern:** Student-side queries never accept a caller-supplied student ID — they resolve identity from the session internally (`resolveStudentId(userId)` in `modules/student-portal/queries.ts:18-27`), which structurally eliminates IDOR risk on that side. Parent-side queries accept a `studentId` (from a `?child=` URL param) but validate it against the parent's actual linked children (`children.find(...) ?? children[0]`) before any query runs, and nearly every function in `modules/parents/parent-portal-queries.ts` independently re-verifies via `verifyParentChild()`. This pattern is sound (see §12 for where it breaks down at the Server Action layer, not the page layer).

**Central single-group assumption:** A load-bearing helper, `resolvePrimaryActiveGroupId()` (`modules/academic/enrollment-integrity.ts:118-132`), picks exactly one "primary" active `group_students` row (earliest `joined_at`) and nearly every student- and parent-portal query scopes itself to that one group/course. This directly conflicts with the stated business rule that a student may study multiple courses simultaneously — it is the single most consequential architectural fact in this audit and recurs throughout §5, §6, and §16.

**RLS is architecturally present but not actually in the request path.** All application code uses the service-role Supabase client, which bypasses Row Level Security unconditionally. Every RLS policy in the schema (including on `student_notes`, `submissions`, `parent_students`) is currently dead code from the app's point of view — a defense-in-depth backstop that is never exercised, not a functioning second line of defense. The real enforcement is 100% hand-written ownership checks inside query/action functions. This raises the stakes of any function that omits such a check (§12).

---

## 2. Current Student Portal Features

Routes: `/portal/student` (dashboard), `assignments`, `attendance`, `certificates`, `history`, `leaderboard`, `portfolio`, `videos`, `semesters` (legacy redirect, intentionally kept).

- **Dashboard** — XP/level hero banner, streak chip, group rank + "Star of the Week" badge, session progress card, 4 stat tiles (attendance/tasks/projects/score), achievements mini-card (count-only, no drill-down), "missions" next-actions list, session feedback widget, upcoming homework + recent feedback cards.
- **Assignments** — list (To Do/Submitted, correctly aggregated across *all* active course memberships — the one place multi-course already works right), detail + submission (text/drive/github/url/video/image, resubmission flow).
- **Attendance** — stats page (single "primary" group only).
- **History/Sessions** — topic-first session log (single "primary" group only) — near-duplicate of Attendance, see §6.
- **Certificates** — list (correctly cross-course), eligibility progress card (single "primary" course only — inconsistent with the list below it).
- **Portfolio** — bio, badges, projects grid, upload flow with client-side image compression, and (contrary to a stale prior-audit note — see §4) a working **edit mode** via `ProjectCard.tsx`'s "✎ Edit" button.
- **My Videos** — gallery derived from portfolio projects with a `video_url`, multi-platform embed detection (YouTube/TikTok/Instagram/Facebook/Drive).
- **Leaderboard** — group ranking, top-3 podium, self-position callout — but resolves its "primary group" via a *different* sort order than every other page (see §6, a confirmed bug, not a design choice).
- **Session feedback** — bilingual (EN/AR) star-rating widget per session.

Absent from the route tree entirely: any Achievements/Badges gallery page, any self-serve "browse/join another course" flow, any RTL/bilingual layout support, and (correctly, per business rule) any financial/balance data.

---

## 3. Current Parent Portal Features

Routes: `/portal/parent` (dashboard), `assignments`, `attendance`, `certificates`, `feedback`, `finance`, `portfolio`, `progress`, `semesters`.

- **Dashboard** — student/group/course/instructor hero, 4 stat tiles (single "primary" course, unlabeled), an Enrollment Contracts card that *is* correctly multi-course-aware (inconsistent with the tiles above it — see §6), a rules-based "Recommended Actions" alert block (low sessions / overdue payment / low attendance), and a recent-activity feed.
- **Assignments** — filtered list, public feedback + score only (private grading notes correctly excluded).
- **Attendance** — summary, trend, per-session records table (only completed sessions shown).
- **Progress** — per-course breakdown across *all* `student_course_progress` rows — the best example of correct multi-course handling anywhere in either portal.
- **Portfolio** — projects/badges/achievements, read-only.
- **Certificates** — list, eligibility, PDF download + public verify link.
- **History/Semesters** — timeline view.
- **Finance** — account summary, installments, payments, current-enrollment cards — **contains a live data-integrity bug for multi-course families** (§5, §10).
- **Feedback** — 6-session-milestone parent satisfaction survey.
- (Contact Team Leader / messaging exists as a component, `ContactForm.tsx`, reachable from the feedback area.)

A shared `ChildSelector.tsx` + `NoChildrenLinked.tsx` pair (built in the 2026-07-07 audit, confirmed still applied consistently) covers all 9 pages. No page is orphaned; every route is reachable from both the desktop sidebar and the mobile bottom-nav "More" sheet.

---

## 4. Features Already Implemented (confirmed working, including corrections to stale prior notes)

- Multi-course-aware **Assignments** list (student side) and **Progress** page (parent side) — the two genuine bright spots for the "no fixed curriculum path" business rule.
- Cross-course **Certificates** listing on both portals.
- **Portfolio edit mode** — a 2026-07-07 audit note claimed this was "unexposed in the UI." That is now false: `ProjectCard.tsx` has a working "✎ Edit" button wired to `UploadProjectForm mode="edit"`. **Correcting the record — do not re-flag this as a gap.**
- `calculateLevel()` duplicate removal and `portfolio/SessionFeedbackWidget.tsx` dead-file removal (both from the 2026-07-07 audit) — confirmed still clean, no regression.
- `semesters/page.tsx` legacy redirect — confirmed intentionally kept (old-bookmark support), not orphaned dead code.
- Gamification engine — XP, 15 levels, streaks (attendance + graded-submission activity), 17 achievement definitions, 10 badge definitions, dynamic (non-materialized) leaderboard and Student-of-the-Week — real, substantially wired, not vaporware (see §13 for what's *not* wired).
- Parent-child ownership verification (`verifyParentChild`) — applied consistently across nearly every parent-portal query function; this is a genuinely solid pattern, just inconsistently centralized (§9, §12).
- Assignment grading's two-tier `feedback` (private) / `public_feedback` (parent-visible) column split — a clean, reusable precedent for how visibility tiers *should* work elsewhere in the system.
- Notifications infrastructure (`notifications`, `notification_recipients`, `notification_preferences`, `notification_reads`) — well-normalized schema, multi-channel-ready — but currently under-utilized (0 rows in production; see §5).

---

## 5. Missing Features

Ranked by how directly each contradicts a stated business rule or mission requirement.

1. **No `evaluations` table or concept exists anywhere.** Confirmed by live schema inspection (no `evaluations`/`student_evaluations`/`evaluation_notes` table in the 125-table public schema) and by migration history (zero `CREATE TABLE ... evaluations` anywhere in `supabase/migrations/`). What exists instead is four *fragmented*, purpose-specific tables that each cover a slice of "evaluation": `submissions` (assignment grading, has the `feedback`/`public_feedback` split), `feedback_notes` (instructor note on a student, `rating` 1-5, `visible_to_parent` boolean), `session_feedback` (student's *own* self-rating of a session), and `parent_feedback` (parent's periodic satisfaction survey *about* the school, not an evaluation *of* the student). None of these represent "an instructor evaluates a student holistically, independent of a specific assignment," which is what the mission asks for.
2. **No `competitions` table or concept exists anywhere.** "Competition" appears only as an enum value — `student_achievements.achievement_type = 'competition'`, `certificates.certificate_type = 'competition_award'`, `assignments.type = 'competition'` — with no structured record of competition name, date, placement, or team. Live data confirms this isn't just unused schema: no `ACHIEVEMENT_DEFS` entry in the gamification module even uses `type: 'competition'`. The business rule "competition history belongs to the student's history" has no data model to belong to yet.
3. **Notes system has no visibility model matching the 6-tier target** (Private Instructor / Private TL / Internal Staff / Shared / Student Instructions / Parent Evaluation). Current reality: `student_notes.is_private` is a single boolean (author-only vs. author+TL/admin); `feedback_notes.visible_to_parent` is a second, unrelated boolean on a different table. Neither student nor parent portal has ever queried `student_notes` (confirmed by grep — zero references). **Team Leaders can neither author nor read student notes today**, despite an RLS policy nominally granting TL read access — there is no TL UI surface for it at all. Full breakdown in §8/§10.
4. **Self-serve "join another course" is missing from the Student Portal.** `deriveNextActions()` only offers a link to the public marketing site when a student has zero groups — a currently-enrolled student has no discoverable in-portal path to add a second concurrent course, despite that being an explicit, named business rule.
5. **No Achievements/Badges gallery page** on either portal — the data (`student_achievements`, `student_badges`) is written correctly but never independently browsable; only aggregate counts appear on the student dashboard's dead-end mini-card.
6. **No notification firing on grading or note creation.** Confirmed: `gradeSubmission()` triggers audit log + progress recalc + XP/achievements, but no notification row. Creating a `student_notes`/`feedback_notes` row triggers nothing. The mission explicitly asks that "Parents should receive: Evaluation, Parent-visible notes, Notifications" — none of the three currently happen automatically; parents only discover a grade by visiting the portal and having the activity feed re-derive a pseudo-event.
7. **Portal-wide RTL/bilingual support is missing** (confirmed still true — only one Arabic string exists in the entire student/parent tree, `SessionFeedbackWidget.tsx`'s single feedback-question label). Deliberately deferred in the 2026-07-07 audit as a product decision, not a bug — still deferred here for the same reason, but worth naming given the academy's Arabic-speaking user base.
8. **No streak-calendar-capable data.** `students.current_streak`/`best_streak` are running counters with no underlying daily-activity log — a heatmap/calendar view of "which days were active" cannot be built from the current schema without a new table (deliberately omitted from the original gamification migration for cost reasons).
9. **Student-of-the-Week bonus XP and the "perfect attendance" achievement are both dead code.** `XP_AWARDS.STUDENT_OF_THE_WEEK = 250` and `PERFECT_ATTENDANCE_BONUS = 50` are defined but never referenced in any `awardXP()` call; `checkPerfectAttendanceAchievement()` exists but has zero call sites. The UI displays a "Star of the Week" badge that pays out nothing. This will read as broken, not aspirational, if gamification is made more prominent in a rebuild without fixing it first.

---

## 6. UX Problems

**Student Portal:**
1. **Single-group data scoping directly contradicts the multi-course business rule.** Dashboard, Attendance, Session History, and Certificate-eligibility all resolve one "primary" group and silently hide a second concurrently-enrolled course's data everywhere except the (correctly multi-course) Assignments list and Certificates list. This is the single biggest structural finding in the entire audit.
2. **Leaderboard shows a different "primary group" than the rest of the portal — a live inconsistency bug, not a design gap.** `leaderboard/page.tsx` sorts `group_students` by `joined_at` **descending** (most recent); every other page's `resolvePrimaryActiveGroupId()` sorts **ascending** (earliest). A student in 2 active groups can see Group A's stats on the dashboard and Group B's ranking on the leaderboard in the same session.
3. **Attendance and History pages are near-duplicates** — identical underlying queries, near-identical UI, and the codebase itself acknowledges the overlap in a comment, yet both occupy separate nav slots with no in-UI explanation of which to use for what.
4. Achievements mini-card is a visual dead end (chevron with no link, and no page to link to).
5. Only one shared, dashboard-shaped `loading.tsx` exists for the whole route tree — navigating to Leaderboard or Videos briefly shows a mismatched skeleton.
6. Certificate eligibility card (single-course) sits directly above a certificate list that may span multiple courses, with no per-course grouping to explain the mismatch.

**Parent Portal:**
1. **Dashboard stat tiles show one course's numbers, unlabeled, directly above a multi-course-aware Enrollment Contracts section** — internally inconsistent on the same page, and a plausible source of "why doesn't this % match" support tickets for any multi-course family.
2. **Finance page's empty state actively misleads.** For the exact families this system should serve well (2+ concurrent enrollments), it shows "No financial account found — Contact the academy to set one up," when an account genuinely exists (see §5/§10 bug). The `can_view_financials`-restricted case renders the identical message, so a parent who's been deliberately denied access can't tell the difference from a genuine setup gap.
3. **Zero `loading.tsx`/`error.tsx` anywhere in the parent portal** (vs. 5 in the instructor portal, 1+1 in the student portal) — the Dashboard alone fires 5+ sequential/parallel query sets before first paint with nothing shown in between, and any unhandled query error falls through to the generic global error page instead of a portal-branded state.
4. Certificates/Portfolio pages render raw `<img>` tags with no broken-image fallback.
5. Query-string building for the child selector + filters is hand-rolled differently across pages (`?child=` vs `&child=` prefixes) rather than using one shared URL-builder utility — currently cosmetic, but fragile as more filters are added.

---

## 7. UI Problems

- **Duplicate/near-duplicate status-color maps**: attendance `STATUS_CONFIG` is independently defined in both `attendance/page.tsx` and `history/page.tsx` (slightly different, one has emoji/iconBg the other doesn't) — a status-taxonomy change requires editing both and risks drift. The 2026-07-05 general review separately found this exact "12 duplicate `getStatusColor`/status-map definitions" pattern is systemic across the whole app, not unique to these two files.
- **Nav item lists hand-duplicated**: `ParentSidebar.tsx` (`NAV_ITEMS`) and `ParentBottomNav.tsx` (`PRIMARY`/`MORE_ITEMS`) independently define the same 9 destinations with separately-drawn icon sets — no shared config module, so a renamed/added route must be updated in two places by hand.
- **"Sprint N" inline IIFE left in production JSX** (`app/portal/parent/page.tsx:225-257`, the Recommended Actions block) — works, but is a leftover implementation artifact that hurts readability and testability, and its naming style (referencing an internal sprint number) doesn't belong in a component that will outlive the sprint.
- Instructor-facing UI trap: on the attendance-taking screen, a generic "Attendance note" input (which **is** shown to parents) sits immediately next to a staff-private note button, with no label distinguishing which is parent-visible — an easy way for staff to accidentally disclose an internal remark.
- Assignments module previously had a mismatched color palette vs. the rest of the student portal — confirmed already fixed in the 2026-07-07 audit, no regression found.

---

## 8. Technical Debt

- **Dead exports, `modules/student-portal/queries.ts` (810 lines):** `getStudentEnrollment`, `getStudentProgressStats`, `getRecentFeedback`, `getStudentTimeline` — zero callers anywhere in the app (verified by repo-wide grep), roughly 220 lines (~27% of the file).
- **Dead exports, `modules/parents/parent-portal-queries.ts`:** `getChildProgressStats` (25 lines), `getChildEnrollment` (48 lines) — likewise zero callers.
- **`getStudentDashboardData`** (~380 lines) and **`getChildDashboardData`** (~195 lines) are both large, monolithic functions mixing identity/gamification/group/enrollment/scheduling/attendance/assignments/portfolio/feedback concerns in one call — hard to test in isolation, and the reason every page that needs even 5 of the ~35 returned fields ends up re-calling the entire function (see §11).
- **`app/portal/student/page.tsx` is 586 lines** — mixes ~10 presentational subcomponents, data-fetching, and derivation logic in one file with no extraction to `components/`, 2.3x the next-largest student-portal page.
- **`modules/finance/queries.ts` is 2,583 lines** (shared with the admin finance module) — the small, parent-facing `getParentChildFinance` function is easy to overlook inside a file this size, which is very plausibly *why* the multi-account schema migration (see §10) was never propagated into it.
- **Stale type file:** `modules/students/notes/types.ts` predates the `category`/`severity` migration on `student_notes` and doesn't include those fields — the actual runtime types are inlined elsewhere; a future editor trusting this file as source-of-truth will write incorrect code.
- **Dead notification type:** `TEAM_LEADER_NOTE` is defined in `modules/notifications/types.ts`, referenced in a UI icon map and a test, but has zero producers anywhere — a half-finished feature that should be repurposed or removed before building real note notifications.
- **Dead achievement checker:** `checkPerfectAttendanceAchievement()` exists with zero call sites (see §5, item 9).
- General codebase-wide items already documented in `docs/LMS_FULL_REVIEW_2026-07-05.md` and still relevant to this scope: WhatsApp-link logic manually duplicated in 20+ files, `formatDate` defined 3x, several files over 900-2000 lines (outside portal scope but same pattern class as the two named above).

---

## 9. Duplicate Code

- **Assignment "Path A / Path B" resolution logic duplicated 3x, near line-for-line**: `modules/student-portal/queries.ts:251-279` (count-only), `modules/assignments/submissions/queries.ts:93-239` (`listStudentAssignments`), `modules/parents/parent-portal-queries.ts:267-402` (`getChildAssignments`).
- **Parent-child ownership verification implemented 5 separate ways** instead of consistently reusing `verifyParentChild()`: correctly reused in `modules/progress/queries.ts`; independently reimplemented inline in `modules/certificates/queries.ts` (`getChildCertificates`), `modules/portfolio/queries.ts` (`getChildPortfolioDetail`), `modules/finance/queries.ts` (`getParentChildFinance` — this one *needs* to diverge, since it also checks `can_view_financials`, so it's not a pure duplicate), and `modules/parent-feedback/queries.ts` (`resolveParentId`, a straight 4th copy of the same helper). `modules/enrollments/queries.ts`'s `listStudentEnrollments` has **no** ownership check at all — the one genuine gap, not just duplication (see §12).
- **Timeline-building duplicated**: `getStudentTimeline` and `getChildHistoryTimeline` both independently assemble an activity feed from attendance/submissions/portfolio/certificates with near-identical event-shaping logic.
- **`getChildProgressStats` is a byte-for-byte duplicate of `getStudentProgressStats`** except for the added `verifyParentChild` guard — a strong candidate for one function parameterized by an optional ownership check.
- **Dashboard-assembly duplicated in shape** between `getStudentDashboardData` and `getChildDashboardData` — both independently resolve group/course/instructor-with-fallback and portfolio/certificate counts from the same tables.
- **Three divergent "financial summary for a family" code paths** computing overlapping paid/remaining/session numbers from different joins: `getChildEnrollmentContracts` (dashboard), `getParentChildFinance` (finance-page account view), `listStudentEnrollments` (finance-page enrollment cards). This divergence is the direct root cause of the finance bug in §5/§10, not a cosmetic duplication.

---

## 10. Database Improvements

*(Live schema pulled directly from the production Supabase project on 2026-07-15; cross-checked against `docs/LMS_FULL_REVIEW_2026-07-05.md` where that report's findings still apply.)*

**Structural gaps (highest priority — these block the mission's explicit asks):**
- **No `evaluations` table.** Needs a new table decoupled from `assignment_id` (unlike `submissions`) so an instructor can log a standalone skill/behavior checkpoint not tied to a specific homework item, with a visibility model matching §5/§8's notes redesign.
- **No `competitions`/`competition_results` table.** Needs student_id, competition name, date, placement/result, team members (if applicable), and a link to the achievement/certificate it may generate — currently a total data-model void.
- **Notes visibility model needs a schema change, not a patch.** `student_notes.is_private BOOLEAN` cannot represent 6 tiers. Two viable paths: (a) replace `is_private` with a `visibility` enum (`INSTRUCTOR_ONLY | TEAM_LEADER_ONLY | INTERNAL_STAFF | SHARED | STUDENT_ONLY | PARENT_ONLY`) with a backfill migration, reusing the existing `category`/`severity` columns as-is; or (b) split into purpose-specific tables given how differently "who can author" varies per tier (e.g., parent-visible notes plausibly need a different creation-permission gate than instructor-private ones). `feedback_notes`, `finance_notes`, and `instructor_notes` (a different domain — HR notes *about* instructors, don't conflate with student notes) should all be reconciled into whichever direction is chosen, not left as four parallel, inconsistent note tables.

**Live data-integrity bug (confirmed via migration history, not speculative):**
- `supabase/migrations/0054_schema_reconciliation.sql:168-197` deliberately dropped the old `UNIQUE(student_id)` constraint on `student_financial_accounts` and replaced it with per-`enrollment_id` uniqueness — explicitly enabling multiple concurrent accounts per student, matching the multi-course business rule. But `getParentChildFinance()` (`modules/finance/queries.ts:837-841`) still queries `.eq('student_id', studentId).maybeSingle()` with no `enrollment_id` filter, and discards the resulting error. For any family with 2+ concurrent enrollments, this silently returns `null` and the Parent Portal tells them no account exists. **This is a live bug in production schema/code alignment, not a hypothetical risk** — flagging it here as a database/query-consistency issue in addition to the UX section (§6) because the root cause is the migration not being propagated to every consumer of the table it changed.

**Security posture (live, from `get_advisors` on 2026-07-15 — 10 days after the last general review, spot-checked for drift):**
- 29 tables have RLS *enabled* but *no policy at all* (deny-all — safe today because the app never uses the RLS-bound client, but means these tables are currently inaccessible to any future direct-client-SDK use case without adding real policies first). Includes `assignments`, `notifications`, `quiz_attempts`, `learning_journey_stages`.
- 2 tables have RLS **disabled** and are ERROR-level exposed: `finance_installments_backup_20260706` and `_backup_student_branch_fix_20260706` — both backup tables left in the public, API-exposed schema from a prior repair session. Should be dropped or moved to a non-exposed schema, not fixed with a policy (they shouldn't be reachable at all).
- `user_has_permission(uuid, text, uuid)` — the RPC that appears to underlie the RBAC permission-check flow — is `SECURITY DEFINER` and executable by both `anon` and `authenticated` roles with no apparent restriction. Given its name, this is worth auditing specifically for whether it can be used to probe/enumerate permission grants for arbitrary users without authorization (cross-reference with §12's `award_xp` finding, which confirms this general pattern — anon-executable SECURITY DEFINER functions with no internal auth check — is not an isolated incident).
- `student_parent_contacts.service_full_access` policy uses `USING (true) WITH CHECK (true)` for `ALL` operations — an unrestricted policy that, again, is only safe today because it's never actually exercised by an RLS-bound client.

**Performance (filtered to the ~45 student/parent-domain tables from the live advisor pull):**
- 178 of 404 total performance lints touch this domain: the majority (170 systemwide) are `unused_index` — many are very plausibly false positives from a low-traffic dev/staging dataset rather than genuinely dead indexes, so this needs a production-traffic-informed pass before deleting anything, not a blind sweep.
- `unindexed_foreign_keys` genuinely worth adding: `student_financial_accounts.group_id`, `student_grade_summaries.group_course_id`, `student_progress.group_course_id`, `portfolio_projects.semester_id`, `submissions.graded_by`, `notifications.created_by` — all FKs that the student/parent portal query patterns actually traverse.
- `finance_payments` alone carries 3 apparently-unused indexes (`idx_fp_enrollment_id`, `idx_fp_account_id`, `idx_fp_student_id`) — worth reconciling against the finance-query consolidation recommended in §9 rather than indexing three divergent query shapes independently.

**Reasonable existing patterns worth preserving in any redesign:**
- Heavy, consistent use of "snapshot" denormalization columns (`group_name_snapshot`, `course_name_snapshot`, `instructor_name_snapshot`, `pricing_snapshot`) for historical accuracy on `student_enrollments`/`attendance_records` — a deliberate, sound pattern for a system where groups/courses/instructors change over time but historical records must stay accurate to what was true then.
- `parent_students.can_view_financials`/`can_receive_notifications` — existing, reusable per-parent granular permission columns that are underused today (the finance-visibility gate exists but its UX is confusing, per §6) but are exactly the right shape for the "parent evaluation notes" / "shared notes" visibility model being designed in §5/§8.
- `renewal_of` on `student_enrollments` — confirmed present and used by the cohort-graduation module; correctly supports the "renewal chain" concept without needing a new table.

---

## 11. Performance Improvements

- **`getStudentDashboardData` and `getParentChildren` are each fetched twice per request** — once in the portal `layout.tsx` (for shell header chips) and again independently in the page/subroute (`page.tsx`, `attendance/page.tsx`, `history/page.tsx` on the student side; nearly every one of the 9 parent pages on the other). Neither is wrapped in React's `cache()`. This is the single highest-leverage, lowest-risk fix available: wrapping both in `cache()` deduplicates the redundant fetch on *every* page load in both portals with no UI change required.
- **`getStudentOfTheWeek`/`getGroupLeaderboard`/`getStudentGroupRank`** recompute an entire group's shared, non-personalized ranking from scratch on every individual student's dashboard load — a 5-10 minute cache window keyed by `groupId` would turn O(students-in-group) redundant computation into O(1) per revalidation window.
- **Chatty, sequential (not batched) round trips inside both dashboard-aggregator functions** — `getStudentDashboardData` makes ~20 sequential/parallel Supabase calls per invocation, `getChildDashboardData` ~15. Several are written as sequential `if`-chains (e.g., enrollment lookup with fallback, instructor lookup with fallback) that could be combined into single queries with `.or()`/joins, or restructured into 3-4 `Promise.all` batches instead of one long chain.
- **Unbounded query**: `getChildAttendance()` fetches *all* `attendance_records` for a student with no `.limit()`, inconsistent with every sibling function in the same file (which cap at `.limit(50)`) — grows linearly with account age, a genuine scalability risk for long-tenured students.
- **Dead/wasted query**: `getChildDashboardData` computes `completed_sessions`/`total_sessions` via a `schedules` query whose result is never read by the only caller (`app/portal/parent/page.tsx` uses a *different* source of truth, `getChildSessionsProgress`, for the same concept) — both a wasted round trip and a two-divergent-numbers data-integrity smell worth resolving alongside the finance consolidation in §9/§10.
- **Redundant ownership re-verification**: pages that call 2-3 `parent-portal-queries.ts` functions in the same `Promise.all` (e.g., the parent dashboard calling `getChildDashboardData` + `getChildSessionsProgress` + `getChildEnrollmentContracts`) each independently re-run `verifyParentChild` — good defense-in-depth, but 3x the necessary round trips for one logical check already guaranteed by the calling page's own child-resolution step. Worth revisiting once the ownership-check helper is centralized (§9).
- No caching gap specific to student/parent vs. admin — the admin portal has the identical zero-caching pattern, so this is a codebase-wide investment, not a portal-specific fix.

---

## 12. Permission Improvements

**Architecture:** 5 roles (`super_admin`, `team_leader`, `instructor`, `student`, `parent` — there is **no distinct "Branch Manager" role**; `team_leader` is the branch-scoped operator role in this system, always bound to explicit `branch_id` rows). Permission model is a hybrid: canonical strings + role defaults in TS (`modules/rbac/permissions.ts`), production truth resolved from `user_roles → roles → role_permissions → permissions` at login and cached in the session cookie, with per-user override rows (`user_permissions`) for configurable permissions on `team_leader`/`instructor`.

**What's solid:** Student-side data access is structurally safe (identity resolved from session, never from a caller-supplied ID). Parent-side page-level access is well-guarded (`verifyParentChild` applied consistently, §9's duplication is a maintainability issue, not a security one — everywhere it's called, it works). `isBranchAccessible()` is used correctly as post-fetch defense-in-depth across ~36 files.

**What's broken — ranked by severity:**

1. **CRITICAL — `award_xp()` Postgres function is `SECURITY DEFINER`, executable by the public `anon` role, with zero internal auth/ownership check.** Confirmed by reading the function body directly (`supabase/migrations/20260624083735_award_xp_fn.sql`): it takes `p_student_id`, `p_amount`, `p_is_activity` and performs no `auth.uid()` check, no role check, nothing. Because it's anon-executable, **anyone with the public anon key (which ships in every page's JS bundle) can call `supabase.rpc('award_xp', {...})` directly from a browser console — no login required — and mint unlimited XP for any student, repeatedly.** This completely bypasses every application-layer permission check in `modules/gamification/xp-service.ts`. This is not a theoretical RLS-policy nuance; it's a directly callable, unauthenticated write path into student game-profile data, and it's part of a documented pattern: `docs/LMS_FULL_REVIEW_2026-07-05.md` separately flagged 28 total anon-executable `SECURITY DEFINER` functions (including `repair_student_portal_accounts`, `full_recompute_all_consumption`, `cancel_schedule_with_cascade`). **This must be fixed (REVOKE EXECUTE FROM anon, authenticated) before any further work on the gamification-facing surface, independent of any redesign timeline.**

2. **CRITICAL — six Server Action files have zero auth/ownership checks, and are independently callable regardless of which page renders them.** Next.js Server Actions are network endpoints in their own right; a page-level `requirePortalRole` guard does not protect the action itself. Confirmed exploitable:
   - `getStudentAttendanceHistoryAction(studentId)` (`modules/groups/actions/attendance.ts:13`) — returns full attendance detail for any student ID, no check.
   - `getGroupDetailDataAction(groupId)` (`modules/groups/actions/detail.ts:39`) — returns a full group roster **including student phone numbers, dates of birth, guardian phone numbers, and financial account balances**, no auth or branch check.
   - `fetchGroupsExportData(groupIds, branchIds)` (`modules/groups/export/queries.ts:7`) — takes `branchIds` directly from the caller with no verification the caller is authorized for them.
   - `getStudentGroupHistory(studentId)` (`modules/students/group-history.ts:15`) — no auth check.
   - `calculateStudentProgress(...)` (`modules/progress/actions.ts:9`) — write action, no auth check (lower severity, but still a gap).
   - `updateTask`/`dismissTask`/`bulkCreateTasks` (`modules/tasks/actions.ts`) — no `getCurrentUser()` call at all; any authenticated user of any role can mutate operational tasks belonging to any branch.

   These need `requireAuth()`/`requirePermission()`/ownership checks added directly inside each function, not just at the page level that happens to call them today.

3. **HIGH — Team Leader can grade/give-XP-for submissions outside their own branch.** `gradeSubmission()` (`modules/assignments/submissions/actions.ts:25-96`) explicitly scopes `instructor` role to their own groups but the code comment states TLs can grade "any submission" with no branch check — inconsistent with the rest of the codebase, where TL is *always* branch-bound via `isBranchAccessible`/`requirePermission(..., {branchId})`. A TL assigned only to Branch A can currently grade a Branch B student's work.

4. **MODERATE — `listStudentEnrollments(studentId)` has no ownership check of its own** (`modules/enrollments/queries.ts:11`) — safe today only because its one caller (`app/portal/parent/finance/page.tsx`) happens to pre-validate the ID; a latent IDOR waiting for the next caller who doesn't replicate that exact pattern.

5. **MODERATE — RLS-as-documentation is misleading.** Comments in `modules/rbac/permissions.ts` (e.g., `"own only — enforced by RLS"`) describe protections that are not actually active at the application layer, since every query uses the service-role client. Anyone reading those comments without also knowing this could reasonably (and incorrectly) conclude a code path is protected when it isn't. Worth correcting the comments to state the real enforcement mechanism (hand-written checks) as part of any redesign, so future contributors don't inherit the same false assumption.

6. **LOW — inconsistent guard strength on `submitAssignment`**, which uses `requireAuth()` (login-only) rather than `requirePortalRole('student')` like its sibling student-facing actions. Not currently exploitable (fails downstream on a missing `students` row for non-students) but a looser pattern than the rest of the codebase for no apparent reason.

**Note on the notes system's permission model:** covered in depth in §5/§10 — the short version is that visibility enforcement for `student_notes` is a single hand-written `.filter()` in one query function (currently correct, structurally fragile — no RLS backstop and no structural guarantee a future read path replicates it).

---

## 13. Gamification Opportunities

**What already exists and works well:** XP with 15 levels, atomic race-condition-safe increment (`award_xp()` SQL function under row lock), a unified attendance-or-graded-submission streak (current + best), 17 achievement definitions, 10 badge definitions, and fully dynamic (non-materialized, always-fresh) leaderboard/rank/Student-of-the-Week computation. Attendance, assignment submission/grading, and certificate issuance are all genuinely wired end-to-end to XP + achievements + badges. Portfolio/video uploads are wired to XP + achievements but deliberately not to streak.

**What's wired but silently broken (fix before making more prominent):**
- Student-of-the-Week is displayed as a badge but its 250-XP bonus is defined and never paid.
- The "perfect attendance" achievement checker exists and is never called.
Making gamification more visually prominent in a rebuild while these stay broken will read as the product lying to students about rewards — this is a cheap, high-priority fix (§16).

**What's missing entirely:**
- Competition history — no data model at all (see §5/§10); the achievement-type scaffolding for it exists but is unused.
- Any Achievements/Badges gallery page — the data is there, there is simply no route that queries it individually.
- A streak calendar/heatmap — needs a new lightweight daily-activity-log table; deliberately omitted from the original migration for cost reasons, and the running-counter columns (`current_streak`/`best_streak`) cannot reconstruct which specific days were active.
- Level-up "moment" UI (toast/animation) — the signal already exists (`awardXP()` returns `leveledUp: boolean`) but every caller is a fire-and-forget block that discards the return value; wiring this to the UI is a plumbing exercise, not new engine work.

**Reuse assessment for a rebuild:** the XP/level math, the achievement/badge check-and-award functions, and the leaderboard/rank/SOTW queries are all pure, stateless, and directly reusable for a visually bigger, more prominent gamification surface. The engine does not need to be rebuilt — only extended (new achievement/badge defs for competitions, a new activity-log table for streak calendars, and UI work to surface what already exists but isn't browsable).

---

## 14. Student Portal Score: 6/10

**What earns the points:** a genuinely well-built gamification layer that's already emotionally engaging (XP bar, level badge, streak chip, rank, SOTW banner all present on first load); assignments and portfolio are cross-course-correct and full-featured (submission types, resubmission, client-side image compression, working edit mode); the shell/nav pattern is clean and consistent; no financial data leaks into the student experience, correctly respecting the business rule.

**What caps it at 6, not higher:** the multi-course scoping violation (§6, item 1) is not a polish issue — it means the core "no fixed curriculum path" business promise is not actually reflected in what a multi-course student sees on their own dashboard, and it recurs as the root cause of the leaderboard bug too. Layer on top of that: zero caching causing a real (if currently small-scale) performance cost on every page load, two broken gamification payouts sitting in the UI as of today, no way to browse achievements/badges individually, no self-serve path to add a course, and no i18n/RTL for a bilingual user base. None of these are hard to fix individually, but together they mean the portal currently under-delivers on its own stated mission (motivation + accurate multi-course progress) more than its polish level would suggest.

---

## 15. Parent Portal Score: 5/10

**What earns the points:** the security/ownership pattern is the most consistently well-implemented part of either portal (`verifyParentChild` applied nearly everywhere, server actions independently re-verify client-supplied IDs, the multi-child switcher is uniformly applied across all 9 pages); Progress is the single best example of correct multi-course UX in the whole codebase; the shell now correctly reuses the shared admin topbar.

**What caps it at 5, not higher:** Finance — the one domain this portal is explicitly supposed to own and get right — has a live, confirmed data-integrity bug that can tell a paying family their account doesn't exist, and it happens to hit exactly the multi-course families the business rules say should be normal, not edge cases. That single finding alone would justify capping the score at a 5 in a "does this do its one job reliably" sense, independent of anything else. On top of it: the same dashboard/reality mismatch problem as the student portal (single-course stat tiles above a multi-course contracts list), zero loading/error states anywhere (the one portal where "looks trustworthy on every visit" matters most), and three independently-computed, occasionally-disagreeing sources of truth for "how much does this family owe." The underlying security architecture is good; the finance feature built on top of it is not currently reliable.

---

## 16. Top 25 Highest-Priority Improvements

Ordered by a blended read of business impact, user-facing risk, and how much everything downstream depends on it — security and data-correctness items lead because they are prerequisites for any rebuild to be trustworthy, not because they're the most interesting.

| # | Improvement | Impact | Complexity | Risk if unaddressed |
|---|---|---|---|---|
| 1 | Revoke `anon`/`authenticated` execute on `award_xp` and the other 27 anon-exposed `SECURITY DEFINER` functions (§12.1) | Critical | Low | Unauthenticated write access to student game data today |
| 2 | Add auth/ownership checks to the 6 zero-guard Server Actions exposing PII/finance/attendance (§12.2) | Critical | Low-Med | Direct, callable IDOR today |
| 3 | Fix `getParentChildFinance` to be enrollment-aware per the 0054 migration (§5/§10/§15) | Critical | Low | Paying families told they have no account |
| 4 | Fix Team-Leader cross-branch grading gap (§12.3) | High | Low | Cross-branch data access/grading |
| 5 | Make Student Portal dashboard/attendance/certificate-eligibility genuinely multi-course-aware (§6, §14) | High | Med-High | Core business rule not reflected in product |
| 6 | Make Parent Portal dashboard stats multi-course-consistent with Enrollment Contracts (§6, §15) | High | Medium | Same root cause as #5, parent-facing |
| 7 | Fix leaderboard vs. dashboard "primary group" sort-order mismatch (§6.2) | Medium | Low | Confusing, contradictory data in one session |
| 8 | Design + migrate the notes system to a real visibility model (6-tier or equivalent) (§5.3, §10) | High | High | Mission-named feature doesn't exist yet |
| 9 | Design + build an `evaluations` data model independent of assignment grading (§5.1, §10) | High | High | Mission-named feature doesn't exist yet |
| 10 | Design + build a `competitions` data model (§5.2, §10, §13) | Medium-High | Medium | Business-rule-named history has nowhere to live |
| 11 | Wire notifications for grading + note creation, including parent delivery (§5.6, §8) | High | Medium | Parents currently get zero proactive updates |
| 12 | Fix SOTW bonus payout + wire the perfect-attendance achievement checker (§13) | Medium | Low | Gamification visibly pays out nothing for a displayed reward |
| 13 | Wrap `getStudentDashboardData`/`getParentChildren` in `cache()` to kill the double-fetch (§11) | Medium | Low | Free performance win, zero UI risk |
| 14 | Add `loading.tsx`/`error.tsx` across the parent portal (§6, §15) | Medium | Low | Portal looks broken on slow connections/errors |
| 15 | Build an Achievements/Badges gallery page (§5.5, §13) | Medium | Low-Med | Existing data invisible to students |
| 16 | Add a self-serve "join another course" entry point (§5.4, §14) | Medium | Medium | Stated business capability has no UI path |
| 17 | Consolidate the 5 duplicated parent-ownership-verification implementations onto one helper; close the `listStudentEnrollments` gap (§9, §12.4) | Medium | Low-Med | Latent IDOR + maintenance drift |
| 18 | Fix the unbounded `getChildAttendance` query (§11) | Low-Med | Low | Unbounded growth risk for long-tenured students |
| 19 | Merge or clearly differentiate Attendance vs. History student pages (§6.3) | Low-Med | Medium | Redundant nav, confusing to first-time users |
| 20 | Consolidate the 3 divergent financial/enrollment computation paths into one source of truth (§9, §10) | High (root-causes #3) | Medium-High | Recurrence risk for the exact bug in #3 |
| 21 | Build a Team Leader notes UI (authoring + reading), matching what RLS already nominally grants (§5.3) | Medium | Medium | A designed capability exists in the DB with no product surface |
| 22 | Cache group-shared gamification computations (leaderboard/SOTW/rank) per group (§11, §13) | Low-Med | Low | Redundant computation scales with group size |
| 23 | Clean up dead exports/dead types across `student-portal`/`parent-portal-queries`/notification types (§8) | Low | Low | Maintenance drag, misleading source-of-truth files |
| 24 | Harden certificate access (sequential/enumerable codes on public, unauthenticated PDF/verify routes) (§10, Parent audit) | Low-Med | Low-Med | Enumerable download of any issued certificate |
| 25 | Portal-wide RTL/bilingual support | Strategic (not urgent) | High | Deferred by design until product decision is made — named for roadmap completeness |

---

## 17. Implementation Roadmap

Sprints are sequenced so that later sprints don't build UI on top of data that's still wrong. Security work is not optional or schedulable-later — it precedes everything else regardless of what else ships.

### Sprint 0 — Security Lockdown
- **Objective:** Close the live, exploitable gaps before touching anything else. This is not part of "the rebuild" — it's a prerequisite that stands on its own regardless of what happens to the portals afterward.
- **Scope:** Items #1, #2, #4 from §16 — revoke anon/authenticated execute on the 28 flagged `SECURITY DEFINER` functions; add auth/ownership guards to the 6 zero-check Server Actions; add branch scoping to TL grading.
- **Dependencies:** None — can start immediately.
- **Risk:** Low technical risk (mostly `REVOKE`/guard-clause additions to functions already known to be safe when called through the app's own authenticated paths); requires careful regression testing of every legitimate call site before/after the `REVOKE`s ship, per the pattern already used successfully for the prior security-hardening pass (per project memory).
- **Business value:** Removes unauthenticated write access to student data and IDOR exposure of PII/finance data — this is trust-and-liability-level value, not a feature.

### Sprint 1 — Data-Layer Correctness
- **Objective:** Make the data both portals already display actually match reality before any UI rework sits on top of it.
- **Scope:** Items #3, #5, #6, #7, #18, #20 — the parent-finance multi-account bug, student/parent multi-course dashboard scoping, the leaderboard sort-order bug, the unbounded attendance query, and consolidating the 3 divergent financial/enrollment computations into one source of truth.
- **Dependencies:** None on Sprint 0, but should follow it in priority ordering. #20 is the structural fix that prevents #3 from recurring, so do it in the same sprint rather than patching #3 in isolation.
- **Risk:** Medium — touches core dashboard queries used everywhere; needs careful regression testing against real multi-enrollment student accounts (which the codebase already has test fixtures for, per the RBAC agent's confirmation that `student_enrollments` supports concurrent active rows today).
- **Business value:** High — this is the gap between "the product's marketing claim (multi-course, no fixed path)" and "what the product actually shows a family." Fixing it is foundational trust, not a nice-to-have.

### Sprint 2 — Notes, Evaluations & Notifications Redesign
- **Objective:** Build the data model and permission model the mission explicitly asked for, since none of it exists today.
- **Scope:** Items #8, #9, #11, #21 — unified notes visibility model (migration + backfill), a standalone evaluations data model, notification wiring for grading/notes/evaluations (student + parent delivery), and a Team Leader notes UI.
- **Dependencies:** Should follow Sprint 0 (permission-checking primitives need to be trustworthy before building new permission-gated features on top of them) and benefits from Sprint 1's cleanup of the ownership-verification helper (#17, pull forward into this sprint if sequencing allows, since new note/evaluation read paths will need exactly that helper).
- **Risk:** High — this is the largest schema change in the roadmap (new tables, a visibility enum, backfill of existing `student_notes` rows, new RLS policies that will actually need to be *real* this time if any future client-side/RLS-bound access path is ever added). Needs a design decision (single table + enum vs. multiple tables) made explicitly before implementation, not organically.
- **Business value:** High — directly fulfills the mission's named notes-and-evaluation requirements; currently a 0% built feature area despite being explicitly named as core scope.

### Sprint 3 — Competitions & Gamification Completion
- **Objective:** Give competition history a real home, and stop the gamification UI from silently lying about rewards it doesn't pay.
- **Scope:** Items #10, #12, #15, #22 — new `competitions` table + achievement/badge wiring, fixing the SOTW/perfect-attendance dead payouts, an Achievements/Badges gallery page, and caching shared group-level gamification computations.
- **Dependencies:** Independent of Sprints 1-2; can run in parallel with Sprint 2 if resourcing allows, since it touches a mostly disjoint set of tables/modules.
- **Risk:** Low-Medium — the gamification engine is proven and reusable (§13); the new table and UI page are additive, not a rework of anything load-bearing.
- **Business value:** Medium-High — directly serves the "motivation, achievements" pillar of the Student Portal mission, and closes out a named business rule (competition history) with low technical risk relative to its visibility.

### Sprint 4 — Performance & Code Health
- **Objective:** Stop paying for the same query twice on every page load, and collapse the duplicated helper functions identified throughout this audit before they multiply further in the rebuild.
- **Scope:** Items #13, #17, #23 — `cache()`-wrap the dashboard aggregators, consolidate the 5 duplicated ownership-check implementations, clean up dead exports/types.
- **Dependencies:** Best done after Sprint 1 (data-layer fixes will themselves touch these same functions, so sequencing the cache-wrapping after the correctness fixes avoids caching a function mid-rewrite).
- **Risk:** Low — these are refactors with no behavior change by design; straightforward to verify via existing test coverage plus manual smoke tests.
- **Business value:** Medium — invisible to end users directly, but materially reduces both DB load and the maintenance surface area the rebuild will otherwise have to carry forward.

### Sprint 5 — Portal UX Repair
- **Objective:** Fix the concrete UX problems documented in §6/§7 that don't require a full visual redesign to resolve.
- **Scope:** Items #14, #16, #19, #24 — parent-portal loading/error states, student self-serve course-join entry point, merge/differentiate Attendance vs. History, certificate-access hardening.
- **Dependencies:** Can run in parallel with Sprint 3; benefits from Sprint 1's multi-course fix being in place before deciding the final shape of #16 and #19 (both are easier to design correctly once the underlying data is multi-course-aware).
- **Risk:** Low-Medium — mostly additive UI work plus one nav-restructuring decision (#19) that needs a product call on whether to merge or keep both routes.
- **Business value:** Medium — closes the gap between "data is correct" (Sprints 1-2) and "the experience feels intentional," without requiring the full visual rebuild to be scheduled first.

### Sprint 6 — Next-Generation Portal Rebuild (out of this audit's scope, named for roadmap continuity)
- **Objective:** The actual visual/experiential redesign of both portals referenced in the mission's framing ("build the next generation of the Student and Parent experience") — this audit's deliverable is the input to that design phase, not the design itself.
- **Scope:** To be defined in a follow-up design phase, informed directly by §2-§7 and §13 of this report (what already works and should be reused/extended vs. what should be replaced).
- **Dependencies:** Should not start in earnest until Sprints 0-2 are complete — designing new UI on top of unfixed multi-course scoping, an unbuilt evaluations/notes model, or open IDOR gaps means re-doing the design work once those land.
- **Risk:** Unscoped until the design phase defines it.
- **Business value:** The stated end goal of this entire initiative — unscored here since it's a separate phase, not a line item.

### Sprint 7 — Strategic / Deferred
- **Objective:** Track items that are real but intentionally not urgent.
- **Scope:** Item #25 (portal-wide RTL/bilingual support) — requires a product decision (is Arabic-first UI an actual near-term requirement?) before scheduling, per the same reasoning the 2026-07-07 audit used to defer it originally.
- **Dependencies:** A product decision, not a technical one.
- **Risk:** N/A until scoped.
- **Business value:** Potentially high given the academy's user base, but explicitly not blocking anything else in this roadmap.
