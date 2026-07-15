# Parent Experience Report — Sprint 4

**Date:** 2026-07-15
**Scope:** Complete Parent Workspace — Children Overview, multi-course Current Learning, Progress &
Evaluations, Attendance, Certificates, Competitions, Parent Notes, Finance, Timeline,
Notifications, Quick Actions. Reuses the Student Domain (Sprint 2) and Student Experience
(Sprint 3) wherever possible. XP, Analytics, and unrelated-module redesign are explicitly
out of scope per the mission.

---

## 1. Architecture Summary

Before writing any code, the existing Parent Portal was audited directly. It turned out to
already be a mature, multi-child-aware, mostly-correct implementation predating the Student
Domain work: `modules/parents/parent-portal-queries.ts` already had `getParentChildren`,
`getChildDashboardData`, `getChildAttendance`, `getChildAssignments`, `getChildEnrollmentContracts`
(already multi-course-correct for finance), and pages for Dashboard/Assignments/Attendance/
Progress/Portfolio/Certificates/History/Finance/Feedback — all with a shared `ChildSelector`
switcher. That work predates Sprint 2 and never touches Evaluations, Competitions, or the 6-tier
Notes visibility model, because those domains didn't exist yet.

Sprint 4 is therefore **not a rebuild** — it is: (1) four new pages wiring the Sprint-2 Student
Domain into the parent portal (Evaluations, Competitions, Notes, Journey/Timeline), each a thin,
parent-scoped adapter over the exact same business-layer readers the Student Workspace uses; (2)
a "Children Overview" grid (mission Section 2) that didn't exist before — the old dashboard could
only ever show one selected child's detail, never all linked children at a glance; (3) a
multi-course "Current Learning" section on the dashboard, reusing the Student Workspace's
`LearningCard` component instead of the dashboard's old single-course hero fields; (4) one
cross-cutting security fix (see §5) discovered while wiring the shared timeline table into a
second portal audience.

No new database tables or migrations were needed — every domain's schema, RLS, and business logic
already existed from Sprint 2.

## 2. Components Reused (no changes)

- `ChildSelector`, `ParentShell`, `ParentSidebar`, `ParentBottomNav`, `NoChildrenLinked`
  (`components/portal/parent/*`) — extended with new nav entries, not replaced.
- `SectionPreviewCard` (`components/portal/student/SectionPreviewCard.tsx`) — already portal-agnostic
  (props-only, no hardcoded `/portal/student/*` paths). Reused verbatim on the parent dashboard for
  the Evaluations/Competitions/Notes/Journey/Certificates/Portfolio preview grid — the exact same
  component the Student Workspace uses for its "Your Progress" grid.
- `EmptyState`, `StatusBadge` (`components/admin/*`).
- `requirePortalRole` (`modules/rbac/guards`).
- `getStudentEvaluations`, `getStudentCompetitions`, `getStudentNotes` + `canViewerReadNote`
  (Sprint 2 Student Domain — see §4).
- `getStudentLearningCards` (`modules/student-portal/queries`, Sprint 3).
- `getStudentTimeline` + `TIMELINE_EVENT_LABELS`/`TIMELINE_SEVERITY_COLORS` (`lib/timeline`, Sprint 2).
- `getChildCertificates`, `getChildPortfolioDetail`, `getParentChildFinance` — pre-existing parent
  finance/portfolio/certificate readers, reused by the new `getChildrenOverview` aggregator instead
  of re-querying certificates/portfolio/finance from scratch.
- `NotificationBell` — was instructor-only; now genuinely shared (see §3).

## 3. Components Created

- `components/portal/parent/ChildOverviewCard.tsx` — one card per linked child: photo/initials,
  status badge, active-course count, attendance %, outstanding balance, latest evaluation, latest
  achievement, certificate/competition count chips, quick actions. New because nothing like it
  existed — the old dashboard only ever rendered one selected child in detail.
- `components/portal/shared/NotificationBell.tsx` — **relocated**, not duplicated, from
  `components/portal/instructor/`. The component was already portal-agnostic (reads
  `recipient_id = current user`, no role check inside) — it just lived under the wrong folder
  because only the instructor portal used it. Moved to a shared location, `InstructorShell`'s
  import updated, and `ParentShell` now renders it too via `AdminTopbar`'s existing `bellSlot` prop.
  Extended `TYPE_ICON` with the 5 Sprint-2 notification types (`EVALUATION_PUBLISHED`,
  `STUDENT_NOTE_SHARED`, `PARENT_NOTE_SHARED`, `ACHIEVEMENT_EARNED`, `COMPETITION_RESULT`) — a gap
  flagged as dead in the Sprint 3 report ("`TYPE_ICON` map doesn't cover the 5 Sprint-2 types yet").

**Extended (not duplicated):** `components/portal/student/LearningCard.tsx` gained three optional
props — `basePath` (default `/portal/student`, unchanged for the student page), `childId`
(appends `?child=` to quick-action links), and `hideContinueLearning` (a parent isn't the one who
"continues learning"). The student page's existing call site needed zero changes; the parent
dashboard passes `basePath="/portal/parent"` and hides the CTA. This is exactly the mission's
"reuse the Student Learning Card wherever possible; remove student-only actions" instruction,
implemented as a prop rather than a fork.

## 4. Queries Reused / Added

**Added** (`modules/parents/parent-portal-queries.ts` — extended, not a new parallel module):
every function below is a *thin adapter* — it verifies the parent-child link via the existing
`verifyParentChild()`, then delegates straight to the Sprint-2/3 reader with zero reimplemented
query logic:

- `getChildLearningCards(parentUserId, studentId)` — resolves the student's own auth `user_id`
  (since `getStudentLearningCards` is keyed off it) and calls it unchanged.
- `getChildEvaluations(parentUserId, studentId)` → `getStudentEvaluations(studentId, 'parent')`.
- `getChildCompetitions(parentUserId, studentId)` → `getStudentCompetitions(studentId)`.
- `getChildNotes(parentUserId, studentId)` → `getStudentNotes(studentId, { userId: parentUserId, kind: 'parent' })`.
- `getChildJourneyTimeline(parentUserId, studentId)` → `getStudentTimeline` filtered through the
  new `PARENT_VISIBLE_TIMELINE_EVENT_TYPES` allowlist (see §5).
- `getChildrenOverview(parentUserId)` — the one genuinely new aggregation. Composes the above
  adapters plus the pre-existing `getChildCertificates`/`getChildPortfolioDetail`/
  `getParentChildFinance` (`Promise.all` per child) into one summary card per linked child. No new
  query logic — it's pure composition of already-verified readers.
- `ParentChildSummary` gained `status` and `avatar_url` (from `students.status` / `users.avatar_url`,
  additively selected — every existing caller destructures only the fields it needs, so this is
  backward compatible).

**Reused as-is (already existed, untouched):** `getParentChildren`, `getChildDashboardData`,
`getChildSessionsProgress`, `getChildEnrollmentContracts`, `getChildAttendance`,
`getChildAssignments`, `getChildHistoryTimeline`, `getChildCertificates`, `getChildPortfolioDetail`,
`getParentChildFinance`, `getProgressForChild`, `listStudentEnrollments`.

No query was duplicated. Every new capability is either a direct pass-through to the Student
Domain reader with a `verifyParentChild()` gate in front, or a composition of existing readers.

## 5. Security Review

- Every page uses `requirePortalRole('parent')` plus `verifyParentChild()` (or the equivalent
  ownership check inside the delegated reader) before returning any data for a `studentId` — a
  parent can never fetch another family's child by guessing/forging a `?child=` id.
- **Notes:** `getChildNotes` passes `kind: 'parent'` to the single-source-of-truth
  `canViewerReadNote()` — server-filtered to `SHARED`/`PARENT_EVALUATION` only. `PRIVATE_INSTRUCTOR`,
  `PRIVATE_TEAM_LEADER`, `INTERNAL_STAFF`, and `STUDENT_INSTRUCTION` notes are never fetched into
  the parent's list in the first place — not filtered client-side, which would be a real leak vector.
- **Evaluations:** filtered server-side to `visible_to_parent = true`.
- **Timeline — new finding, fixed this sprint:** `student_timeline_events` has no per-row
  visibility column and is shared across the student portal, the parent portal, and internal
  finance/collections tooling. Reusing it for a second audience (parent) surfaced a real,
  pre-existing leak: `logNoteTimelineEvent()` (added in Sprint 2) stored a 140-character content
  snippet on every `NOTE_ADDED` event regardless of the note's visibility tier, and the Student
  Workspace's Journey page (Sprint 3) renders that `notes` field for any allow-listed event type.
  Concretely: a `PARENT_EVALUATION`-only note (meant for parents, hidden from the student) would
  leak its text into the *student's own* Journey feed via the timeline event, and the reverse would
  happen for `STUDENT_INSTRUCTION`-only notes leaking to parents once a parent Journey page existed.
  **Fixed at the source** (`modules/student-notes/actions.ts`): the timeline event for `NOTE_ADDED`
  no longer carries note content at all — just the event type, student, and author. The actual
  content stays correctly gated behind `getStudentNotes()`/`canViewerReadNote()` on the dedicated
  Notes pages, which is the only place it should ever render. Regression-tested (`tests/student-notes/notes.test.ts`, TEST 10).
- Added `PARENT_VISIBLE_TIMELINE_EVENT_TYPES` (`lib/timeline/index.ts`) as an explicit allowlist,
  mirroring the Sprint-3 `STUDENT_VISIBLE_TIMELINE_EVENT_TYPES` pattern. It differs from the
  student allowlist by excluding `HOMEWORK_ASSIGNED`/`HOMEWORK_COMPLETED` — day-to-day homework
  detail isn't a parent-facing milestone and already has its own page (Assignments, which already
  exposes only `public_feedback`, never private submission notes). Finance/collections/staff-internal
  event types (`PAYMENT`, `PROMISE_MADE`, `BLOCK_APPLIED`, `CALL_LOGGED`, etc.) are excluded from
  both allowlists, same as Sprint 3. Regression-tested (`tests/timeline/timeline-events.test.ts`).
- No internal notes, staff-only timeline events, other students, or other parents are reachable
  from any new page — every query is scoped to the verified parent-child link.

## 6. Mobile Review

- All new pages (`evaluations`, `competitions`, `notes`, `journey`) follow the exact existing
  parent-portal page convention: `max-w-2xl` single-column layout, header + `ChildSelector` +
  content, no horizontal scroll anywhere — same pattern as every pre-existing parent page.
- `ChildOverviewCard` grid is `grid-cols-1 sm:grid-cols-2` — single column on phones, two-up from
  tablet width up.
- `LearningCard` grid on the dashboard is `grid-cols-1 lg:grid-cols-2`, matching the Student
  Workspace's own responsive behavior exactly (same component, same breakpoints).
- The "Story" preview grid (`SectionPreviewCard` tiles) is `grid-cols-1 sm:grid-cols-2` — stacks
  cleanly on mobile.
- Bottom nav "More" sheet grew from 5 to 9 items but stays a `grid-cols-3` grid (3 rows), unlike
  the Student Workspace's single-column "More" list that needed a `max-h-[70vh]` scroll cap at 9
  items — the grid layout stays comfortably within viewport height without one.
- Sidebar nav gained 4 new entries (Evaluations, Competitions, Notes, Journey) in the existing
  scrollable `<nav>` — no layout change needed, it was already `overflow-y-auto`.

## 7. Performance Review

- `getChildrenOverview` runs one `Promise.all` per child (6 already-existing readers), and the
  outer `children.map(...)` also runs concurrently via `Promise.all` — for a typical 1–3 child
  family this is bounded, not a per-child serial chain.
- The dashboard page fetches Sprint-2 domain data (evaluations/competitions/notes) once and reuses
  the same arrays for both the "Story" preview tiles and their counts — no duplicate requests for
  the same data, matching the Sprint 3 dashboard's own pattern.
- `getChildLearningCards`/`getChildEvaluations`/etc. add zero new query cost beyond what
  `getStudentLearningCards`/`getStudentEvaluations` already cost on the student side — they're the
  same function, called with a resolved id.
- Journey page fetches a single bounded `getStudentTimeline(studentId, null, 100)` call (existing
  100-row cap), same as the student Journey page.

## 8. Tests Added

13 new tests across 3 files, all passing (478/478 full suite, up from 465):

- `tests/multi-course/parent-student-domain-reuse.test.ts` (8 tests, new) — every new adapter
  (`getChildEvaluations`, `getChildCompetitions`, `getChildNotes`, `getChildLearningCards`,
  `getChildJourneyTimeline`) is verified to (a) refuse an unlinked parent *without* ever calling
  the underlying Student Domain reader, and (b) delegate with the exact right arguments
  (`kind: 'parent'`, resolved student user_id, etc.) for a linked one.
- `tests/timeline/timeline-events.test.ts` (+4 tests) — `PARENT_VISIBLE_TIMELINE_EVENT_TYPES`
  excludes every finance/staff-internal event type, includes the academic milestone types, has no
  orphaned entries missing a label, and correctly differs from the student allowlist (no homework
  detail).
- `tests/student-notes/notes.test.ts` (+1 test, TEST 10) — regression test for the `NOTE_ADDED`
  content-leak fix: creates a `PARENT_EVALUATION` note and asserts the resulting timeline event
  carries no `notes` field.

## 9. Manual QA

- `npx tsc --noEmit` — 0 errors (after clearing a stale `.next/types` cache referencing
  already-deleted routes, unrelated to this sprint).
- `npx eslint .` (scoped to touched files) — 0 errors; all warnings are pre-existing
  `no-explicit-any`/legacy-pattern warnings already present before this sprint.
- `npx vitest run` — 478/478 passing (465 pre-existing + 13 new).
- `npm run build` — exit 0, full production build, all ~154 routes compiled including the 4 new
  parent routes (`/portal/parent/{evaluations,competitions,notes,journey}`).
- Dev-server smoke test: all 8 touched/new parent routes plus 2 student routes return `307`
  redirects to `/login?next=...` when unauthenticated, with no errors in the dev server log —
  confirms every new page's import graph and RBAC guard execute cleanly (a broken import or
  syntax error would 500, not 307). Same methodology as the Sprint 3 report.
- **Not performed:** logged-in, authenticated visual QA as a real parent account — no test parent
  credentials were available in this environment, same documented gap as Sprint 3's own manual QA
  section. Flagged explicitly, not silently skipped. Recommend a follow-up pass with a seeded
  parent + multi-child account before shipping, particularly for: the Children Overview grid with
  2+ real children, the Current Learning grid with a child in 2+ concurrent courses, and the Notes
  page with a real mix of `SHARED`/`PARENT_EVALUATION` content.

## 10. Remaining Improvements

- **Payment reminders** (listed under mission Section 11, Notifications) are surfaced today via
  the existing dashboard "Recommended Actions" alert banner (overdue/upcoming-due detection,
  already present pre-sprint) rather than a new `notifications` table entry. Building an automated,
  scheduled payment-reminder notification pipeline is a genuinely separate piece of work (a cron/
  scheduled job, not a UI concern) and was judged out of scope for this UI-focused sprint —
  flagged as a real gap, not silently dropped.
- The old `getChildHistoryTimeline`/`semesters` page (attendance/homework/portfolio activity) and
  the new `getChildJourneyTimeline`/`journey` page (Sprint-2 academic milestones) are two
  intentionally separate systems, mirroring the exact same duality the Sprint 3 report documented
  on the student side (`modules/student-portal/queries.ts getStudentTimeline` vs `lib/timeline`).
  Not merged for the same reason: different audiences/tables, and conflating them was flagged as a
  real mistake risk in Sprint 3.
- No authenticated browser QA was performed (see §9) — should be the first follow-up before this
  reaches real parent accounts.
- `ChildOverviewCard`'s `outstanding_balance` returns `null` (rendered as "—") when
  `can_view_financials` is off for that parent-child link, same access-restriction semantics as
  the existing Finance page — but this is a silent "—" on the overview card rather than the
  Finance page's explicit "Financial access restricted" message. Acceptable for a summary card,
  worth a tooltip in a future pass.

## 11. Recommendations for Sprint 5

1. Authenticated manual QA pass (see §9) before this reaches production parent accounts, with a
   seeded multi-child, multi-course test family.
2. A scheduled payment-reminder notification pipeline (cron-driven `seedPaymentReminderNotification`,
   analogous to the existing 5 Sprint-2 seed functions) to close the one genuinely deferred item
   from mission Section 11.
3. Now that `NotificationBell` is shared, consider adding it to the Team Leader portal too
   (`InstructorShell`/`ParentShell` both have it; Team Leader does not) for consistency.
4. Delete the confirmed-dead `design-system/` folder (flagged in Sprint 3, still unaddressed).
5. Wire the two dead gamification paths (perfect-attendance achievement, Student-of-the-Week bonus)
   once XP work is back in scope — unchanged from the Sprint 3 recommendation, still not this
   sprint's concern.
