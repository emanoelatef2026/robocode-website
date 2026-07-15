# Student Experience Report — Sprint 3

**Date:** 2026-07-15
**Scope:** Complete Student Workspace — Hero Header, multi-course Current Learning, Learning
Journey, Achievements, Evaluations, Certificates, Competitions, Notes & Instructions, Quick
Statistics, Quick Actions, empty states, mobile responsiveness. Student portal UI only —
Parent Portal, XP mechanics, and analytics are explicitly out of scope per the mission.

---

## 1. Architecture Summary

Sprint 2 ("Student Domain Foundation") shipped the complete backend for Evaluations,
Competitions, and 6-tier Notes visibility, plus a generic Timeline event log and extended
Notifications/Gamification — but zero UI. Sprint 3 is the UI layer on top of that backend, plus
one small addition: the dashboard previously assumed a single active course
(`StudentDashboardData.group_id/course_title` are singular); a new `getStudentLearningCards`
query fixes the *display* to be multi-course-correct, matching the *data* layer that a prior
sprint already fixed.

No new database tables or migrations were needed — every domain's schema, RLS, and business
logic already existed. This sprint is pure UI + one new read query + one small dedup refactor.

## 2. UI Structure

**Rebuilt:** `app/portal/student/page.tsx` — the Workspace Home. Section order: Hero Header →
Current Learning (one card per active enrollment) → Quick Statistics → Leaderboard CTA → Quick
Actions → "Your Progress" preview grid (Journey/Achievements/Evaluations/Competitions/
Notes/Certificates) → Missions → Session Feedback → Upcoming Homework + Recent Feedback.

**New pages**, all under `app/portal/student/`:
- `journey/page.tsx` — chronological Learning Journey feed with category filter chips (URL-param based, no client JS needed).
- `achievements/page.tsx` — badges, milestones/achievements, competition awards, course-completion/certificates summary.
- `evaluations/page.tsx` — evaluations grouped by criterion, latest + collapsible history + CSS sparkline trend, teacher feedback.
- `competitions/page.tsx` — full competition gallery (season/year/role/coach/project/rank/award/certificate/notes).
- `notes/page.tsx` — student-visible notes/instructions only.

Every page: `requirePortalRole('student')` guard → resolve `studentId` from `user_id` (existing
repo pattern) → fetch → `EmptyState` (existing component) when empty. All built on `.ds-card`/
Tailwind, matching the existing portal's visual language exactly — no new design system.

## 3. Components Created

`components/portal/student/`:
- `HeroHeader.tsx` — identity (name/code/branch/status via `StatusBadge`), XP/level/streak/rank HUD, achievement/certificate/competition summary chips.
- `LearningCard.tsx` — one active enrollment: course/instructor/group/schedule, attendance %, progress %, next session, certificate status chip, quick actions.
- `QuickStatsGrid.tsx` — generic colored-tile stat grid (Active/Completed Courses, Attendance Rate, Certificates, Competitions, Achievements).
- `SectionPreviewCard.tsx` — generic "icon + count + preview + View all →" tile, reused 6× on the dashboard instead of copy-pasted markup.

## 4. Components Reused (no changes)

`StudentShell`/`StudentSidebar`/`StudentBottomNav` (extended, not replaced) · `.ds-card`/
`.ds-btn-*` (`app/globals.css`) · `EmptyState`, `LoadingSkeleton`, `StatusBadge`
(`components/admin/*`) · `SessionFeedbackWidget` · `requirePortalRole` (`modules/rbac/guards`) ·
`getStudentDashboardData`, `getPendingFeedbackSessions` · `resolveActiveGroupIds` ·
`getStudentNotes`/`canViewerReadNote` · `getStudentEvaluations` ·  `getStudentCompetitions` ·
`getStudentTimeline` (`lib/timeline`) · `getOwnPortfolioDetail` (achievements+badges source,
zero new query needed) · `getOwnCertificates` · existing `/certificates`, `/leaderboard`,
`/portfolio`, `/videos`, `/assignments`, `/attendance`, `/history` pages — untouched.

## 5. Existing Components Removed

Inline in the old `page.tsx`, both superseded and deleted: `HeroBanner`/`LevelBadge`/`StatCard`
(→ `HeroHeader`/`QuickStatsGrid`), single-course `SessionCard` (→ multi-course `LearningCard`
list), `AchievementsMini` (→ dedicated Achievements page + preview card). `DAY_LABELS`/
`formatTime` relocated into `LearningCard.tsx` (their only remaining consumer).

## 6. Existing Components Improved

- `modules/student-portal/queries.ts`: extracted `resolveGroupInstructorName()` — the
  instructor-name-resolution block was duplicated verbatim in `getStudentDashboardData` and
  `getStudentEnrollment`; both now call one shared helper (pure dedup, no behavior change).
- `StudentSidebar.tsx` / `StudentBottomNav.tsx`: 5 new nav entries added (sidebar: full list;
  bottom nav: added to the "More" sheet, which also got a `max-h-[70vh] overflow-y-auto` safety
  cap now that it holds 9 items instead of 4).
- `lib/timeline/index.ts`: added `STUDENT_VISIBLE_TIMELINE_EVENT_TYPES` — a security-relevant
  allowlist (see §9) filtering the shared `student_timeline_events` table down to what a
  student may see.

## 7. Queries Reused / Added

**Added:** `getStudentLearningCards(userId)` (`modules/student-portal/queries.ts`) — one
`LearningCard` per concurrently-active enrollment, batched (no per-group query loop): groups +
group_courses + student_enrollments + student_course_progress fetched in one `Promise.all`,
schedules/attendance bucketed by group in memory, certificate status derived by zipping
`getCertificateEligibility()`'s result against the same `resolveActiveGroupIds()` order (both
built from the identical resolver call, so the positional zip is safe) cross-checked against
`getOwnCertificates()` by course title. `getStudentProfileHeader(userId)` — a minimal,
self-scoped (no branch-access gate) read of student_code/branch_name/status for the Hero
Header, deliberately not reusing the staff-facing `modules/students/queries.ts` `getStudent()`
(which gates on `isBranchAccessible` against the *current* user — correct for staff browsing
other students, unnecessary risk for a student reading their own record).

**Reused as-is:** every Sprint 2 query (`getStudentNotes`, `getStudentEvaluations`,
`getStudentCompetitions`, `getStudentTimeline`), `getCertificateEligibility`,
`getStudentAttendanceHistory` (unchanged, still used by `/attendance` and `/history`),
`getOwnPortfolioDetail`, `getOwnCertificates`.

## 8. Performance Review

- `getStudentLearningCards` batches every lookup across all active groups in one `Promise.all`
  round — no N+1 per-course loop, matching the pattern already established in
  `getStudentDashboardData`.
- Dashboard page fetches Sprint-2 domain data (evaluations/competitions/notes/timeline) once
  and reuses the same arrays for both the Quick Stats counts and the preview cards — no
  duplicate requests for the same data.
- One new lightweight `head: true` count query (completed-courses stat) — O(1), not a table scan.
- Journey page limits the timeline fetch to 100 rows (existing function default was 50; the
  dashboard preview uses a separate 5-row fetch) — bounded, no unbounded queries introduced.

## 9. Security Review

- Every new page uses `requirePortalRole('student')` — the same guard as every existing student
  page.
- Notes: rendered exactly what `getStudentNotes(studentId, {kind:'student'})` returns — already
  filtered server-side to `SHARED`/`STUDENT_INSTRUCTION` via `canViewerReadNote()`. No client-side
  filtering of sensitive data (which would be a real leak vector) — the gate is server-side only.
- Evaluations: `getStudentEvaluations(studentId,'student')` already filters `visible_to_student`.
- **New finding, fixed in this sprint**: `student_timeline_events` is a *shared* table also
  used by the finance/collections domain (payments, promises, complaints, account blocks, call
  logs, parent escalations). A naive "show the student their timeline" implementation would have
  leaked internal collections/finance activity to the student. Added
  `STUDENT_VISIBLE_TIMELINE_EVENT_TYPES` as an explicit allowlist (13 of 31 event types) and the
  Journey page filters against it before rendering anything — finance/collections/internal-staff
  event types are never fetched into a student-visible list in the first place.
- No finance data, parent-only notes, or internal staff notes are reachable from any new page.

## 10. Mobile Review

- All new pages use the existing single-column, `max-w-2xl`/`max-w-3xl` mobile-first layout
  pattern already used by every student portal page — no horizontal scrolling anywhere.
- `LearningCard`s stack in a `grid-cols-1 lg:grid-cols-2` grid — single column on mobile/tablet,
  two-up on desktop (the mission's "desktop first, tablet optimized, mobile fully responsive"
  applied via a `lg:` breakpoint on top of an already-solid mobile base, rather than a
  desktop-only layout retrofitted for mobile).
  `QuickStatsGrid` is `grid-cols-2 md:grid-cols-3` — touch-sized tiles on mobile, denser on desktop.
- Journey timeline is naturally vertical (no adaptation needed).
- Bottom nav "More" sheet now holds 9 destinations (was 4); added `max-h-[70vh] overflow-y-auto`
  so it never overflows the viewport on small phones.
- Quick Actions row wraps naturally (`flex flex-wrap`) — touch-friendly pill buttons, no overflow.

## 11. Tests Added

`tests/student-portal/learning-cards.test.ts` — 3 tests for `getStudentLearningCards`:
zero-enrollment → `[]`, no-student-record → `[]` (short-circuits before resolving groups),
multi-course case → 2 cards with correct per-card course/group/progress/enrollment data,
verifying the certificate-status default and empty-schedule handling. All 3 pass.

## 12. Manual QA

- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 errors (2301 pre-existing-pattern `any`/`img` warnings, unchanged
  convention; 2 new errors were introduced and fixed during this sprint — unescaped apostrophes
  in `achievements/page.tsx` and `competitions/page.tsx`, both resolved with `&apos;`).
- `npx vitest run` — 465/465 passing (462 pre-existing + 3 new).
- `npm run build` — exit 0, all ~150 routes compiled including the 5 new ones.
- Dev-server smoke test: all 6 touched/new student routes (`/portal/student`,
  `/journey`, `/achievements`, `/evaluations`, `/competitions`, `/notes`) return `307` redirects
  to `/login?next=...` when unauthenticated — confirms every page's import graph and RBAC guard
  execute without throwing (a broken import or syntax error would 500, not 307).
- **Not performed**: logged-in, authenticated visual QA as an actual student account (no test
  student credentials were available in this environment, and creating one against the live
  Supabase project was out of scope for this session). This is a real gap, not a claimed
  success — flagged explicitly rather than asserting the pages "look right" without having
  seen them rendered with real data. Recommend a follow-up manual pass with a seeded student
  account before this ships, particularly for: multi-course card layout with 2+ real active
  enrollments, the evaluations sparkline with real history, and the notes page with a mix of
  `SHARED`/`STUDENT_INSTRUCTION` content.

## 13. Remaining Improvements

- No student-facing notification bell exists (confirmed pre-existing gap, not introduced or
  fixed here) — `NotificationBell.tsx` exists only in the instructor portal and its `TYPE_ICON`
  map doesn't cover the 5 Sprint-2 notification types yet either.
- `checkPerfectAttendanceAchievement()` (never called) and Student-of-the-Week's 250 XP bonus
  (never fires) remain dead code — both flagged in the Sprint 2 report, both XP-adjacent and
  therefore out of this sprint's scope ("Do NOT implement XP").
- The `design-system/` folder (138+ files) remains confirmed-dead (zero imports anywhere in the
  app) — real tech debt, deliberately not deleted this sprint since it's unrelated to building
  the Student Workspace and deleting it deserves its own reviewed change.
- No authenticated browser QA was performed (see §12) — should be the first follow-up before
  this ships to real students.

## 14. Recommendations for Sprint 4

1. Authenticated manual QA pass (see §12) before this reaches production students.
2. Student-facing notification bell + extend `TYPE_ICON` for the 5 Sprint-2 notification types.
3. Parent Experience — mirror this sprint's 5 new pages (Journey/Achievements/Evaluations/
   Competitions/Notes) for the Parent Portal, using the already-built `viewerScope: 'parent'` /
   `PARENT_EVALUATION` visibility paths that exist in every Sprint-2 query but have no UI yet.
4. Wire the two dead gamification paths (perfect-attendance achievement, Student-of-the-Week
   bonus) once XP work is back in scope.
5. Delete the unused `design-system/` folder as a standalone cleanup change.
