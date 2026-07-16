# Instructor Experience — Sprint Report (2026-07-16)

**Status: Sprint 1 of the Instructor Experience mission. Not the full mission.** The original
brief asked for a five-product rebuild (Workspace, Session Workspace, Student Workspace, Review
Center, Performance Center) in one pass, ending in an autonomous push to `origin/main`. Given the
real scope (multiple sprints of work touching RBAC/RLS and production data) and that the working
tree already contained a large, un-committed, in-progress slice of exactly this work, this sprint:

1. Audited the actual current state (not a stale report).
2. Fixed a real IDOR found during that audit.
3. Finished the two workspace gaps the audit found were still open.
4. Shipped a first version of the Review Center (previously nonexistent).
5. Left the Performance Center and the rest of the backlog for a follow-up sprint (see §14).

Push to `origin/main` was intentionally **not** performed autonomously — commits are local,
pending explicit user review per this session's direction.

---

## 1. Product audit findings

A read-only audit (Explore agent, verified against live file contents, not prior reports) found:

- **Instructor Workspace** (dashboard): hero, today's/upcoming sessions, KPI row, top
  students/pending-projects highlights, pending homework, at-risk students, notifications — all
  present and reusing `SectionPreviewCard` from the student portal. Gap: no dashboard signal for
  "students never evaluated" or "certificates pending" (partially closed this sprint — see §8).
- **Session Workspace** (`groups/[id]` + `groups/[id]/sessions/[sid]`): attendance roster,
  class-pulse/leaderboard/Student-of-the-Week, curriculum accordion, in-session homework,
  resources, recordings, end/cancel/postpone — all present. Gap: no in-session portfolio review or
  badge-award shortcut, no auto-composed session summary. Deferred (see §14).
- **Student Workspace** (`groups/[id]/students/[studentId]`): attendance, assignments, notes,
  evaluations, competitions, certificates, timeline were already present from a prior
  (uncommitted) sprint. **Gap closed this sprint:** portfolio projects, badges and achievements
  were computed by `getStudentPortfolioDetail` but never rendered on this page — added.
- **Review Center**: confirmed absent. Homework review and Portfolio review were two disconnected
  pages with duplicated status-tab UI, and evaluations/certificates had no queue view at all.
  **Built this sprint** (see §8) as an aggregating hub, not a rewrite of the two existing pages —
  see §3 for why.
- **Performance Center**: confirmed absent — no analytics/reporting route exists for the
  instructor role today, despite the role holding `READ_ANALYTICS`. Not attempted this sprint;
  scoped as the next sprint's primary deliverable (§14).
- **RBAC**: competitions are correctly read-only for instructors (`manage_competitions` is not
  granted to the `instructor` role) — matches the brief. Evaluation writes correctly re-verify
  group ownership. Portfolio review/badge writes did **not** — see §10, fixed.

## 2. UX problems discovered

- Homework Inbox and Portfolio Review are two separate pages an instructor must visit
  independently after class, each with its own filter/tab pattern — no single "what needs me"
  view existed.
- A student's portfolio (projects, badges, achievements) was invisible from the one screen an
  instructor actually uses to look at a student — it only existed on a disconnected,
  non-student-scoped review queue.
- No dashboard/queue signal ever surfaced students who have **zero** evaluations on record — an
  instructor could go an entire term without evaluating a student and get no prompt.

## 3. Architecture decisions

- **Review Center was built as an aggregator, not a merge of Homework + Portfolio.** Those two
  pages have genuinely different data shapes (table vs. card grid) and working, tested review
  actions. Merging them into one mega-page was assessed as high-risk, low-value churn against the
  brief's own instruction not to perform risky rewrites unrelated to the mission. Instead,
  `/portal/instructor/review` pulls the top pending items from both existing queries
  (`listInboxSubmissions`, `listProjectsForInstructorReview`) plus a new query
  (`getStudentsMissingEvaluation`) into one triage view, and links out to the existing dedicated
  pages for the actual review action — single source of truth preserved, zero duplicated business
  logic.
- **Special Sessions was deliberately left out of primary nav**, even though the audit initially
  flagged it as "orphaned." A Phase XL test (`XL.2 TEST D`) explicitly encodes that
  `INSTRUCTOR_NAV` must **not** contain a special-sessions route — a documented prior decision to
  keep primary nav focused and surface trial/makeup sessions contextually (dashboard quick-start,
  calendar) instead. This sprint initially violated that test, caught it via `vitest run`, and
  reverted the nav change rather than overriding a decision already encoded in the test suite.

## 4. Components reused

- `SectionPreviewCard` (student portal) — dashboard highlights.
- `EmptyState`, `StatusBadge`, `ds-card` — Review Center, matching the rest of the LMS design
  system, no new primitives invented.
- `getStudentPortfolioDetail`, `PROJECT_STATUS_CONFIG` (portfolio module) — student workspace
  portfolio section and Review Center, no new portfolio query logic.
- `listInboxSubmissions`, `listProjectsForInstructorReview` — Review Center, unchanged.
- `resolveGcContext` (existing group-ownership resolver) — new `getStudentsMissingEvaluation`
  query, same ownership-scoping pattern as `getStudentsRequiringAttention`.

## 5. Components removed

None removed this sprint — no dead code was found in the areas touched (the pre-existing
`sessions/new` redirect stub had already been folded into the group page inline by the prior,
uncommitted work; confirmed via `git diff`, not re-done here).

## 6. Business logic reused

- Ownership/ ownership-scoping pattern (`group_courses` + `group_instructors` → `group_students`)
  reused verbatim from `getStudentsRequiringAttention` / `listProjectsForInstructorReview` for the
  new `getStudentsMissingEvaluation` query and the new `hasInstructorStudentAccess` guard — no new
  ownership model invented.
- No new timeline event types, notification types, or RBAC permissions were added.

## 7. Navigation improvements

- Added **Review Center** to `INSTRUCTOR_NAV` (top of sidebar, alongside Dashboard) and to the
  mobile bottom bar (replacing Homework, which remains reachable via the sidebar/"More" sheet and
  now also surfaces inside Review Center itself).

## 8. Workflow improvements

- **Review Center** (`/portal/instructor/review`, new): single triage view — pending homework,
  pending portfolio projects, and students with zero evaluations on record, each linking to the
  authoritative page/action.
- **Student Workspace**: added Portfolio & Achievements section (projects with status, badges,
  achievements) with a direct link into the review queue — closes the last gap in the brief's
  "Student Workspace" product definition.

## 9. Performance improvements

No perf-specific work this sprint; all new queries follow the existing scoped-ID-set pattern
(resolve group IDs → batch `.in()` queries) already used throughout `instructor-portal/queries.ts`
— no N+1s introduced.

## 10. Security review

**Fixed:** `modules/portfolio/instructor-actions.ts` had two IDOR gaps found during the audit:
- `assignProjectBadge` performed **no ownership check at all** — any authenticated instructor
  could award a badge to any student in the system, not just their own.
- `reviewPortfolioProject` fetched the project's `student_id` but never verified that student was
  in one of the caller's groups — same class of gap.

Both now call a new `hasInstructorStudentAccess(studentId, instructorId, db)` helper (mirrors the
existing `hasInstructorGroupAccess` pattern in `instructor-portal/actions.ts`) before mutating.
Verified with `tsc --noEmit` and the full `vitest` suite (478/478 passing, no regressions).

## 11. Accessibility review

Not audited this sprint (out of scope for the slice delivered — flagged for the Performance
Center / full-audit follow-up sprint).

## 12. Responsive review

New Review Center page uses the same `ds-card` / stacked-list patterns as the rest of the mobile-
first instructor portal; not manually verified in a browser this sprint (no dev server / browser
tooling available in this environment) — flagged, do not treat as visually confirmed.

## 13. Technical debt removed

None new this sprint beyond what the prior uncommitted work had already cleaned up (dead
`sessions/new` redirect stub, confirmed removed).

## 14. Remaining recommendations (next sprint)

Priority order, based on the audit:

1. **Performance Center** — does not exist at all. Needs: cross-group attendance/engagement
   trends, homework/evaluation completion rates, top/at-risk students beyond the dashboard's
   top-5, instructor productivity view. This is the largest remaining gap from the original brief.
2. **In-session portfolio review / badge award** inside the Session Workspace, so an instructor
   doesn't have to leave the class-in-progress screen to do it.
3. **Auto-composed session summary** (attendance + notes + homework rolled into one artifact) at
   session end, for parent/TL visibility.
4. Accessibility and responsive audits (both explicitly deferred this sprint, no tooling
   available in this environment to verify visually).
5. Re-run this same Phase-0-style audit once the above lands, before attempting a genuine "final"
   report — this document should not be treated as the mission's closing report.
