# Instructor Experience — Final Report

**Status: Sprint 2 (final). Sprint 1 shipped the foundation, Student Workspace, Review Center
v1, and a security fix. This sprint finishes the Session Experience, ships the Performance
Center, and closes the remaining accessibility/tablet gaps found in Sprint 1's audit.** Commits
are local only — push to `origin/main` was intentionally not performed autonomously, per this
session's direction.

---

## 1. What remained from Sprint 1

From `INSTRUCTOR_EXPERIENCE_FINAL_REPORT.md` §14 (the prior version of this document):

1. Performance Center — did not exist at all.
2. In-session portfolio review / badge award shortcuts.
3. Auto-composed session summary.
4. Accessibility and responsive audits (explicitly deferred, no tooling available).
5. A fresh audit before calling anything "final."

Item 4 was re-scoped this sprint into a targeted code-level audit (touch targets, aria-labels,
focus affordances) since no browser/device is available in this environment — visual/live-device
QA is still outstanding and is called out explicitly in §12.

## 2. What was completed this sprint

Re-audited the live Instructor Portal (not the prior report) via a read-only pass over every
route under `app/portal/instructor/**`, cross-referenced against `modules/instructor-portal/**`
and a query inventory of every module the brief asked to reuse (gamification, certificates,
portfolio, student-competitions, instructor-payments, tl-dashboard). Findings and the resulting
work:

**Session Experience** (`groups/[id]/sessions/[sid]` + `AttendanceForm.tsx`):
- Added a **Quick Evaluation** modal to every attendance roster row (⭐ icon) — an instructor can
  now record an evaluation without leaving the live class screen. New shared component
  `components/portal/instructor/StudentEvaluationModal.tsx` factors the evaluation form logic out
  of the page-local `EvaluationForm.tsx` that Sprint 1 had left as page-scoped; the old file was
  deleted and the Student Workspace page now imports the same shared form — one source of truth
  instead of two.
- The roster row's avatar+name is now itself a link into the full Student Workspace (bigger tap
  target, one click), replacing what would otherwise have been a fourth separate icon button —
  kept the row from becoming icon-cluttered while still closing the "can't reach a student's full
  profile from mid-session" gap.
- Fixed touch targets and missing `aria-label`s found during the audit: the attendance-note
  toggle and `StudentNoteModal` trigger were `p-1` icon buttons with no explicit hit area (under
  ~24px) and only a `title` attribute; both are now 32×32px with proper `aria-label`s. The "All
  Present/All Absent" bulk buttons went from `py-0.5` to `py-1.5` and gained `aria-label`s.
- The group page (`groups/[id]/page.tsx`) now shows a live "N to review →" count (homework +
  portfolio pending, scoped to that specific group) next to the Sessions list, linking into a
  group-filtered Review Center — closes the loop between "I'm teaching this group" and "this group
  has pending review work" without a separate lookup.

**Performance Center** (new, `app/portal/instructor/performance/page.tsx`):
Built the previously-nonexistent fifth product. Every metric reuses an existing, already-tested
query rather than recomputing business logic — see §4 for the exact function-by-function mapping.
Sections: Overview (active groups/students, attendance rate, homework/portfolio review %, avg
student rating, sessions taught this month), Students Needing Attention, Top Performers,
Evaluation coverage ("Never Evaluated"), Certificate Readiness, Portfolio Completion breakdown,
Competition Activity, and a Class Summary table. Added to `INSTRUCTOR_NAV` under a new "Insights"
section.

**Review Center** (extended): now accepts an optional `?groupId=` filter, reusing the `groupId`
parameter both `listInboxSubmissions` and `listProjectsForInstructorReview` already supported —
no new query logic, just a page-level plumbing change.

**Accessibility spot-fixes**: `StudentNoteModal`'s close button had no `aria-label` (icon-only ×
button) — fixed. `InstructorGroupCard`'s clickable affordance was hover-only (`group-hover:`
color change, `hover:shadow`) with no touch-visible state — added `active:bg-[#F8FAFC]` so tapping
on a tablet/phone gives the same tactile feedback a mouse hover would on desktop.

## 3. Remaining technical limitations

Documented honestly, not deferred by omission:

- **In-session portfolio review / badge award** was evaluated and deliberately *not* built inline.
  `assignProjectBadge` requires a `project_id` tied to a specific submitted project — there's no
  concept of "award a badge during a live class" independent of reviewing an actual submitted
  project, and that review already lives on a dedicated page with its own tested form
  (`ProjectReviewForm.tsx`). Embedding the full project-review UI inside the session page would
  duplicate that component for a workflow (project review) that doesn't naturally happen mid-class
  anyway — projects are submitted and reviewed asynchronously, not created during a session.
  Instead, the new group-page "N to review →" badge (§2) gets the instructor there in one click
  when it *is* relevant.
- **Auto-composed session summary** was not built. No existing query aggregates
  attendance+notes+homework into a single artifact, and inventing the aggregation format (what
  counts as "the summary," what's shown to parents vs. TLs) is a product decision, not a UI
  wiring task — building it without that decision would mean guessing at a new business rule,
  which the brief explicitly prohibits ("Do not invent fake metrics" / "Do not change business
  rules").
- **Achievement creation stays TL/Admin-only for instructors**, unchanged and intentionally so:
  `createAchievement` in `modules/portfolio/actions.ts` is gated by `manage_portfolio`, which the
  `instructor` role does not hold (`modules/rbac/permissions.ts`). Instructors can view
  achievements (Sprint 1) and award project-linked badges (Sprint 1, IDOR-fixed) but not create
  freeform achievements — that boundary is deliberate RBAC, not a gap, and building an
  instructor-side "create achievement" button would bypass it.
- **`getInstructorPerformanceSummary` and `getCertReadyStudentsForInstructor` compute branch-wide
  first, then filter to one instructor** (they call the TL dashboard's `getInstructorPerformance`
  / `getCertReadyStudents` verbatim rather than re-deriving the computation). This is the correct
  choice under "never duplicate business logic," but it means Performance Center does more work
  per page load than a purpose-built instructor-scoped query would. Acceptable for a single
  on-demand page visit; if it becomes a hot path, the right fix is adding an optional
  `instructorId` filter parameter to `getInstructorPerformance` itself (extending, not
  duplicating) — left as a follow-up rather than done speculatively here.
- **Competition Activity reports facts, not "candidates."** The brief asked for "competition
  candidates" but no existing query encodes what makes a student a candidate (that's a coaching
  judgment call, not derivable data). Performance Center instead shows real counts — total
  competition records and distinct students with a record — sourced directly from
  `student_competitions`, scoped to the instructor's own groups.
- **Live browser/device QA was not performed** (§12) — no dev server or browser tooling is
  available in this execution environment. Every claim about spacing/touch targets/contrast in
  this report is a code-level read, not a rendered observation.

## 4. Components/queries reused (no duplicated business logic)

| Performance Center metric | Reused from |
|---|---|
| Attendance rate, homework/portfolio review %, avg rating | `getInstructorPerformance` (`modules/tl-dashboard/queries.ts`), filtered to one instructor |
| Certificate readiness | `getCertReadyStudents` (`modules/tl-dashboard/queries.ts`), filtered to own groups |
| Students needing attention | `getStudentsRequiringAttention` (Sprint 1) |
| Top performers | `getTopStudentsAcrossInstructorGroups` (existing) |
| Never evaluated | `getStudentsMissingEvaluation` (Sprint 1) |
| Portfolio completion | `listProjectsForInstructorReview` (existing), called once per status |
| Workload (sessions this month) | `getInstructorSessionEarnings` (`modules/instructor-payments/queries.ts`), filtered by month |
| Class summary | `listInstructorGroups` (existing) |

New, genuinely new logic (no prior equivalent existed): `getCompetitionActivityForInstructor` —
a straightforward count/list over `student_competitions` scoped through the same
`resolveGcContext` → `group_students` ownership pattern every other instructor-scoped query in
this file already uses.

`StudentEvaluationModal.tsx` reuses `createInstructorEvaluation` (Sprint 1's action, itself
already ownership-checked) — no new server action was written for the Quick Evaluation modal.

## 5. Components removed

- `app/portal/instructor/groups/[id]/students/[studentId]/EvaluationForm.tsx` — superseded by the
  shared `EvaluationForm` export in `components/portal/instructor/StudentEvaluationModal.tsx`.
  Deleted, not deprecated-in-place.

## 6. UX improvements

- Session roster rows: one fewer icon (name/avatar is now the profile link) while adding a new
  capability (quick evaluation) — net reduction in visual chrome per row despite adding a feature.
- Group page now surfaces "what needs my review" contextually instead of requiring a separate trip
  to Homework or Portfolio to find out.

## 7. Workflow improvements

- Evaluation can happen at the moment it's most natural (during class, per student) instead of
  requiring a trip to that student's full profile afterward.
- Batch workflows were reviewed explicitly (per the brief's "Batch Workflows" section) and found
  largely already correct: attendance already has bulk "All Present/All Absent"; homework and
  portfolio review are intentionally per-item because grading requires actual review — a bulk
  "approve all" would compromise review quality, not save meaningful time, so none was added.
  Portfolio Review already avoids per-item page navigation (all pending projects render on one
  page with inline forms); Homework Inbox does require per-submission navigation, which is correct
  given the necessarily individual nature of feedback/scoring.

## 8. Performance improvements

No query introduces an N+1 — every new function follows the existing "resolve group IDs once,
batch `.in()` queries" pattern already established in `instructor-portal/queries.ts`. The one
known cost (§3, `getInstructorPerformanceSummary`) is documented rather than silently accepted.

## 9. Accessibility improvements

- `aria-label`s added to every icon-only interactive element touched this sprint: attendance-note
  toggle, `StudentNoteModal` trigger and close button, `StudentEvaluationModal` trigger and close
  button, "All Present/All Absent" bulk buttons.
- Form inputs inside `StudentEvaluationModal` (criterion select, custom-criterion input,
  score/rating/feedback fields) all have explicit `aria-label`s, matching what a sighted user
  infers from the adjacent `<p>` label.
- **Not done**: a full keyboard-navigation and focus-order pass, and color-contrast verification —
  both require either live rendering or a dedicated axe-core/Lighthouse run, neither of which is
  available in this environment. Listed as the top item for the next sprint that has browser
  tooling.

## 10. Tablet improvements

- Icon buttons in the attendance roster and note/evaluation modals are now 32×32px minimum
  (previously as small as ~22px with `p-1`), closer to the ~40px touch-target guideline.
- `InstructorGroupCard` gained a touch-visible `active:` state to match its hover-only desktop
  affordance.
- Confirmed (read-only check, both sprints) that no instructor-portal component uses fixed pixel
  widths that would overflow a ~768px tablet viewport — everything uses Tailwind's relative sizing
  (`w-full`, `max-w-sm`, grid/flex) already.
- **Not done**: this is still a code-level read, not a real device/viewport test — see §3 and §12.

## 11. Security review

No new IDOR-class issues found this sprint. `StudentEvaluationModal` calls the same
`createInstructorEvaluation` action Sprint 1 already hardened with `hasInstructorGroupAccess`; no
new server action was introduced. All new query functions are read-only and scope through
`resolveGcContext` before touching student data, matching the established ownership pattern.

## 12. Manual QA checklist (for the next session with browser access)

- [ ] Load `/portal/instructor/performance` as a real instructor account with ≥2 groups; confirm
      every section renders (empty states for zero-data instructors, populated states for active
      ones).
- [ ] From a session's attendance roster, open the Quick Evaluation modal (⭐), submit, confirm it
      closes and the evaluation appears on that student's Student Workspace page.
- [ ] Confirm the roster row's name/avatar navigates to the student profile and does not
      accidentally submit the surrounding attendance `<form>`.
- [ ] On an actual tablet (~768–1024px) and phone (~375px) viewport: attendance roster row icons
      should not wrap or overlap; Performance Center stat-tile grid should reflow to 2–3 columns
      without horizontal scroll.
- [ ] Keyboard-only pass: tab through the attendance roster row, note modal, evaluation modal —
      confirm focus order is logical and modals trap focus / return it on close.
- [ ] Verify the group-page "N to review →" badge count matches what actually appears when
      following the link into `/portal/instructor/review?groupId=...`.
- [ ] Confirm an instructor cannot see another instructor's students in Performance Center
      (Certificate Ready / Competition Activity sections) — spot-check with two instructor
      accounts in the same branch.

## 13. Quality gates (this sprint)

- `tsc --noEmit`: clean.
- `eslint`: 0 errors (pre-existing `no-explicit-any` warnings only, none newly introduced by this
  sprint's changes beyond the existing codebase pattern).
- `vitest run`: 478/478 passing, no regressions.
- `next build`: succeeds; `/portal/instructor/performance` confirmed in the route manifest.
