# Team Leader Portal — Product Discovery Audit

**Status:** Discovery only. No code, migrations, or components were changed to produce this document.
**Method:** Full-repo read of `app/portal/team-leader/**` (41 pages), `modules/team-leader*/**`, `modules/instructor-portal/**`, `modules/rbac/**`, `modules/auth/**`, `modules/user-permissions/**`, and 30+ domain/infra modules (academic, attendance, evaluations, notes, assignments, portfolio, certificates, competitions, notifications, finance, staff-finance, collections-pipeline, operational-engine, tasks, automation-engine, predictive-engine, analytics, shared components, and more). Every claim below is grounded in code actually read; file:line citations are preserved wherever the source material had them.

---

## 1. Executive Summary

The Team Leader (TL) portal is **not a skeleton and not a green-field build** — it is a large, actively-iterated product surface: 41 routes, its own RBAC scope, a dedicated dashboard, and deep feature sets for CRM (students/parents/groups/instructors/leads/courses), finance/payroll, attendance, homework analytics, portfolio review, certificates, special sessions, and multi-tab analytics. Prior sprints (per project history: Sprints 56–68, Phases 18–31) rebuilt Groups, Students, Instructors, and Payroll into genuinely sophisticated workspaces with bulk actions, drawers, wizards, and reconciliation tooling.

What keeps it from being "done" is not missing surface area — it's **incomplete consolidation and a handful of concrete defects**:

- **One critical, portal-wide-CTA-breaking bug**: the dedicated "Record Attendance" page cannot submit — the shared server action requires a `topic` field the form never collects (§10.1).
- **A real cross-branch data leak**: the Special Sessions list page loads every branch's trial/makeup sessions with no branch filter, unlike every sibling page (§10.2).
- **Two full parallel implementations exist for Students detail, Groups detail, and Parent-Satisfaction reporting** — newer drawer/workspace UIs were built without removing (or fixing links to) the older full-page UIs, which are still reachable from other parts of the app (§10.3–10.5).
- **Three completely blind spots in academic-quality oversight**: student evaluations, student notes, and competitions have zero TL-facing UI and zero branch-aggregate query function to build one from — despite the *exact same pattern* already existing and working for attendance, assignments, and portfolio (§4, §5).
- **Navigation defects**: a broken tab-value link ("Satisfaction" nav item points to an invalid tab), an orphaned page reachable only by typing its URL, a Finance-section label/route swap, and a TL sidebar that (unlike Admin's) cannot respect per-user permission revocations (§7, §8).
- **Widespread, unconsolidated UI duplication**: the same KPI-tile shape is hand-built 7 separate times; the same gradient "hero" header 3 times; the same "add adjustment" form 3 times; the same "add student note" form 2 times with a TL-ready backend action (`createTeamLeaderNote`) that has zero UI callers (§9).

**Bottom line (see §15 for full reasoning): Partially implemented, trending toward mostly complete.** The operational/financial spine of the TL role is genuinely strong. The academic-quality-oversight spine — the part of the mission brief most concerned with "is teaching happening well" — is the weakest link and the clearest, lowest-risk place to invest next, because the infrastructure pattern to build it (branch-scoped aggregate query → TL page, exactly like `getTLAssignmentOverview` or `getAttendanceReconciliationStatus`) already exists twice in the codebase.

---

## 2. Current Architecture

**Shell & rendering.** Every TL page is wrapped by `app/portal/team-leader/layout.tsx` → `components/portal/team-leader/TLShell.tsx`, which composes the cross-portal `AppLayout`/`PortalSidebar`/`TopHeader`/`BottomNav` primitives (`components/shared/layout/**`, `components/shared/sidebar/PortalSidebar.tsx`) — the same shell family Student, Parent, Instructor, and Admin all use. Sidebar/bottom-nav content comes from a single config, `modules/team-leader/navigation.tsx` (`TL_SECTIONS`, `TL_BOTTOM_NAV`, `TL_BOTTOM_MORE`).

**A genuine naming collision exists, but it is not dead code.** `modules/team-leader/` (singular, one file — the nav config above) and `modules/team-leaders/` (plural, 4 files — Admin's CRUD layer for TL *user accounts*, powering `app/admin/team-leaders/**`) are two unrelated modules that happen to be one letter apart. Recommend renaming the singular one to `modules/team-leader-portal/` to match the existing `instructor-portal` convention.

**Data layer pattern.** Almost every page delegates to a `modules/*/queries.ts` function, generally branch-scoped via `user.branchIds`. One page breaks this convention: `calendar/page.tsx` builds a raw Supabase query inline (lines 33-57) instead of calling a module function — the only one of the audited pages to do so.

**RBAC model (full detail in §8).** Enforcement is 100% server-side: a signed session cookie carries role + resolved permissions + `branchIds`; `modules/rbac/guards.ts` (`requireAuth`, `requirePermission`, `requirePortalRole`, `checkPermission`) gates every page and Server Action. Permissions resolve from `role_permissions` with per-user overrides in `user_permissions` (`modules/rbac/resolver.ts`), and 13 of TL's permissions are individually revocable per-user by an admin.

**Branch scoping.** TL's `user.branchIds` array is the load-bearing filter across nearly every query (finance, students, attendance, portfolio, certificates). Admin has the same permission set (§8.3) but is unscoped/global — branch scoping is effectively what defines "Team Leader" as distinct from "Admin" at the data layer, not a different capability set.

**Two "instructor performance" computations coexist.** TL's dashboard/Instructor Performance page uses `getInstructorOpsData` (`modules/tl-dashboard/queries.ts`, health-score composite: 40% attendance + 30% rating + 20% retention + 10% inverse-risk). The Analytics page's Instructors tab uses a raw `getInstructorPerformance()` call, unranked by health score. Both live in the same query file but were never reconciled.

---

## 3. Current Capabilities

### 3.1 Full permission set (role-default, `modules/rbac/permissions.ts:176-214`)

`read_branches, manage_settings, manage_students, manage_instructors, manage_parents, manage_groups, archive_cohort, view_archived_cohorts, graduate_cohort, manage_courses, manage_modules, manage_lessons, manage_semesters, manage_schedule, manage_attendance, read_attendance, manage_assignments, grade_assignments, read_grades, manage_quizzes, manage_curriculum, manage_financials, read_financials, manage_payroll, read_analytics, export_analytics, send_announcements, send_notifications, manage_feedback, manage_media, read_media, read_audit_logs, manage_portfolio, manage_certificates, manage_evaluations, manage_competitions, read_ai_reports`.

Plus a role-independent Studio CMS grant (see §8.3).

### 3.2 What a TL can actually do today, by domain

| Domain | Pages | Capability level |
|---|---|---|
| **Students** | `students`, `students/[id]`, `students/[id]/edit` | Full CRUD, 9-filter search, bulk soft-delete, group assignment, welcome-message/credential flow. **No finance/contracts tab in the primary drawer.** |
| **Parents** | `parents`, `parents/[id]` | Full CRUD, 6-tab drawer (richest in the CRM cluster), WhatsApp templating, self-service password reset. **No delete action anywhere.** |
| **Groups** | `groups` workspace, legacy `groups/[id]` | Outlook-style split-panel workspace: 4-tab detail, bulk student ops, graduation wizard, archive/recover lifecycle, Excel export. A second, older full-page detail view is still live and linked from 4+ other pages. |
| **Instructors** | `instructors` workspace, orphaned `instructors/new` | Grid/list views, 5-tab popup, archive/delete with impact warnings. Two parallel creation paths (modal vs. standalone page). |
| **Leads** | `leads`, `leads/[id]` | Rich pipeline KPIs, aging alerts, trial booking/conversion. The one CRM entity still on full-page pagination instead of the modal pattern the rest converged on. |
| **Courses** | `courses` | Full CRUD, correctly reuses Admin's `CourseModal` — the cluster's best reuse example. |
| **Attendance** | `attendance`, `attendance/record` | Rich monitoring dashboard with reconciliation health (`getAttendanceReconciliationStatus`). **The dedicated record-session page is functionally broken (§10.1)** — attendance can only actually be recorded via the Groups drawer's `GroupAttendanceModal`. |
| **Assignments (homework)** | `assignments`, `assignments/[id]`, `assignments/new` | Analytics-grade overview (KPIs + by-group + by-instructor grading-delay breakdown) — the best "review center" precedent in the portal. Creation flow ejects the TL into the Admin shell on success (§10.6) and offers unscoped (all-branch) course/module pickers. |
| **Certificates** | `certificates`, `certificates/new`, `certificates/[id]` | Best-scoped workflow in the portal — every list/picker query is branch-filtered. No revoke/reissue action exposed despite the data model supporting `status=revoked`. |
| **Portfolio** | `portfolio` | Full branch-wide review queue (approve/needs-improvement/feature + badge awards), always-visible review form regardless of active tab. One real status-reflection bug (§10.7). |
| **Special Sessions** | `special-sessions`, `new`, `[id]` | Sophisticated end-of-session flows (atomic attendance+lead-promotion+payroll). **List page has no branch filter — cross-branch data leak (§10.2).** Postpone and edit-trial-student actions exist server-side with zero UI. |
| **Finance** | `finance`, `finance/new`, `collections` | Enrollment-aware Student Operations Center, 3-step Enrollment Wizard, live ledger/timeline drawer with reversal audit trail. `finance/new` and a 5-tab `StudentOpsModal` are dead code superseded by the wizard/drawer. |
| **Payroll** | `payroll` (+workspace), `instructor-payroll` (redirect shim) | Unified instructor+staff payroll with a 3-tier rate hierarchy (override → group → base) and historical fallback resolution. Adjustment-form UI is independently built 3 times. |
| **Instructor Performance** | `instructor-performance` | Composite health-score leaderboard. Disagrees with Analytics' own Instructors tab (different source function, different sort order). |
| **Analytics** | `analytics` (7 tabs) | The single richest page in the portal — Overview tab's Operational Alerts (6 alert types, severity-sorted, deep-linked) is the closest thing to a true cross-domain review center anywhere in the app. |
| **Calendar** | `calendar` | Month-grid view of primary/trial/makeup sessions. No day/week view, "+N more" overflow is not clickable, only page that bypasses the module-query-function convention. |
| **Parent Feedback / Satisfaction** | `parent-feedback` (5 tabs), `parent-satisfaction` (orphaned) | 48h SLA badge on unresolved messages is a strong proactive signal. The standalone Satisfaction page is a strict subset of, and superseded by, the Satisfaction tab inside `parent-feedback` — yet the sidebar link to reach that tab is itself broken (§7). |

### 3.3 What is invisible to a TL regardless of page (cross-cutting)

- **Student evaluations** — zero TL-facing query or UI anywhere; only per-student, viewer-scoped functions exist (`modules/student-evaluations/queries.ts`), consumed only by instructor/parent/student portals.
- **Student notes** — same pattern; `createTeamLeaderNote()` (`modules/student-notes/actions.ts:229`) was built for exactly this purpose and has never been called from any UI.
- **Competitions** — no TL page, no aggregate query; entry is instructor/student-facing only.
- **Session-level drill-down into an instructor's teaching** (topic, notes, recordings, resources, per-student attendance detail) — the entire `SessionDetailsPanel.tsx`/`AttendanceForm.tsx` surface that instructors use is invisible to TL; the TL instructor popup only shows aggregate compliance %.

---

## 4. Current Limitations

Summarized from §3.3 and the page-level findings, grouped by why they matter operationally:

1. **Quality-of-teaching blind spot.** A TL can see *whether* attendance was taken and *whether* homework was graded (rich signals), but cannot see *whether an instructor is writing evaluations or behavioral notes at all* — there's no data to distinguish an instructor who evaluates every student each cycle from one who has never written one.
2. **No actionable review center, only KPI counts, for assignments.** `getTLAssignmentOverview` gives a TL "3 submissions are grading-delayed" but no link to the actual 3 submissions — the only queryable list (`modules/assignments/submissions/queries.ts`) is per-assignment, not per-branch.
3. **Attendance recording is effectively single-path and undiscoverable.** The dedicated page is broken; the only working path (Groups drawer modal) is not where the portal's own "Record Session" CTA sends a TL.
4. **Special session oversight leaks across branches.** A multi-branch academy's TL sees every other branch's trial/makeup pipeline mixed into their own.
5. **No delete for Parents, no bulk actions for Parents/Instructors** — CRUD parity gap vs. Students/Groups.
6. **No branch-wide financial P&L view for TL** — `getGroupPnLRows`/`getBranchPnLRows`/`getAcademyPnL` already accept branch filters but are wired only into Admin's Finance Center.
7. **`modules/tasks` (a ready-made branch work-queue: COLLECTION/RENEWAL/ATTENDANCE/RETENTION/PARENT_REPLY/INSTRUCTOR_REVIEW/COMPLAINT/FOLLOW_UP types) has zero UI consumer anywhere** — the single largest "exists but unwired" capability found in the whole audit.
8. **Dropout-risk scoring exists but is invisible.** `modules/predictive-engine`'s `computeDropoutScore` (weighted attendance/financial/engagement/contract factors, `SAFE|WATCH|HIGH_RISK|CRITICAL`) is only consumed internally by the automation engine — no TL page shows the score or its contributing factors, only the downstream auto-created tasks (which themselves have no UI, per #7).

---

## 5. Daily Workflow Analysis

Modeling a TL's day against what the code actually supports (not invented features):

| Time / activity | What exists | What's missing or broken |
|---|---|---|
| **Morning review** | Main dashboard (`page.tsx`) streams 9 sections: today's actions, group/finance/student-risk/instructor health, trial conversion, academic quality, parent escalation — genuinely the strongest single page in the portal. | No leads-pipeline summary tile despite Leads having a rich KPI page elsewhere. |
| **Instructor monitoring** | Instructor Performance leaderboard (composite health score) + Analytics' Instructors tab (different metric set, unreconciled). | No drill-down into a specific instructor's actual session content, notes, or evaluation activity — TL sees the *outcomes* (attendance %, rating) but not the *behaviors* that produce them. |
| **Attendance follow-up** | Attendance monitor page with chronic-absence/near-exhaustion/unpaid-and-attending KPIs, reconciliation health panel. | Recording a session from the dedicated page is broken (§10.1); trend classification is hobbled by a hardcoded flag (§6). |
| **Student quality review** | Finance/Student Ops Center risk scoring; Analytics' at-risk list. | No unified "student needs attention" view that also folds in evaluation/notes gaps — risk scoring today is attendance+finance only. |
| **Homework quality** | Assignments page: KPIs + by-group + by-instructor grading-delay breakdown — a real, working oversight surface. | No drill-down to the actual pending/overdue submissions (counts only). |
| **Evaluation quality** | **Nothing.** No page, no aggregate query, no data. | Full gap — would need a net-new branch-scoped query, following the `getTLAssignmentOverview` pattern. |
| **Parent complaints** | `parent-feedback` page's Complaints tab (a category-filtered view of the Messages table) with 48h SLA badges. | No reply-to-parent channel from the page itself — only internal (parent-invisible) notes and status changes. |
| **Instructor support** | Payroll/finance detail modals give a TL full visibility into an instructor's pay. | No coaching-note or flag mechanism from the Instructor Performance page — it's purely observational. |
| **Special sessions** | Sophisticated trial/makeup lifecycle with atomic end-of-session side effects. | List view leaks other branches' sessions (§10.2); makeup-student entry requires pasting raw UUIDs instead of using a picker that already exists for the trial flow. |
| **Competitions** | **Nothing** — instructor/student-facing only. | Full gap. |
| **Certificates** | Best-scoped workflow in the portal; issuance and eligibility tracking exist. | No aggregate "certificate-eligible but not yet issued" or "expiring in 30 days" query; no revoke UI. |
| **Academic quality** | Portfolio review queue (branch-wide, working); Academic module's FIFO/consumption logic underlies attendance/finance correctness. | No "days pending" staleness metric on portfolio reviews (unlike homework's 3-day grading-delay signal). |
| **Branch/group health** | Group Health Board (dashboard), Groups workspace performance tab, Branch Comparison (Analytics, multi-branch TLs only). | — (this is a comparatively strong area). |
| **Escalations** | Operational Alerts section (Analytics Overview tab) — 6 severity-sorted, deep-linked alert types; the best cross-domain proactive signal in the app. | Alerts are view-only — no acknowledge/dismiss/snooze. |
| **Late evaluations / missing notes / unreviewed homework / pending approvals** | Homework has partial support (counts, no list). Evaluations and notes have **zero** support — not even a backend function to build a UI on top of. Portfolio review is the one fully-working "pending approvals" queue. | This cluster is the mission's Phase 3 checklist almost item-for-item, and it's the weakest area of the whole audit. |

---

## 6. UX Audit (selected, highest-signal findings — full detail in the per-cluster research)

- **Dashboard (`page.tsx`)**: best-built page in the portal; systemic accessibility issue — `text-[8px]`/`text-[9px]`/`text-[10px]` KPI labels recur across nearly every dashboard/table/badge surface audited, not isolated to one page.
- **Students**: `StudentDetailDrawer` (the live UI) has no Finance/Contracts tab; the abandoned full `students/[id]/page.tsx` had one. The newer UI is in this respect less complete than what it replaced. "Edit" from the full detail page redirects back to itself in a dead loop (`students/[id]/edit/page.tsx`).
- **Groups**: `groups/[id]/edit` redirects to a `?edit=` query param the new workspace never reads — a genuine dead end for any link still using the old convention.
- **Attendance**: `has_assignment_submissions: true` is hardcoded in the risk-trend computation (`attendance/page.tsx:467`), permanently disabling the `ACADEMIC_FOLLOW_UP` trend category regardless of a student's real submission history.
- **Assignments**: "By Group"/"By Instructor" tables have no mobile-card fallback (`overflow-x-auto` only) — inconsistent with the rest of the portal's mobile-first pattern.
- **Portfolio review form**: the status `<select>`'s `defaultValue` ternary collapses `needs_improvement`/`pending_review` to the same "Approve" pre-selection as `approved` — the form visibly misrepresents a project's actual current status.
- **Calendar**: "+N more" overflow on busy days is unclickable text, not a link — a real dead end on the portal's only calendar view; no day/week view exists at all.
- **Payroll workspace**: `StaffTab`'s `onDelete` prop is wired but never called from any button (delete moved into the Edit modal by design, but the dead prop remains).
- **Cross-cluster pattern**: bulk actions and delete support are inconsistent across otherwise-parallel entity lists (Students has both; Groups has bulk-only; Parents and Instructors have neither).

---

## 7. Navigation Audit

- **Broken tab link**: the sidebar's "Satisfaction" item routes to `/parent-feedback?tab=reviews`, but the page's valid tab values are `messages|satisfaction|followups|complaints|suggestions` — `reviews` silently falls back to Messages. The intended destination is never reachable from the nav.
- **Orphaned page**: `/portal/team-leader/parent-satisfaction` has no entry in `TL_SECTIONS`, `TL_BOTTOM_NAV`, or `TL_BOTTOM_MORE` — reachable only by typing the URL, and (per §10.4) largely redundant with the Satisfaction tab anyway.
- **Sidebar routes that exist as real, permission-gated pages but have no nav entry at all**: `/attendance` (+`/record`) and `/assignments` (+`/[id]`, `/new`) are reachable only via deep-links from dashboard widgets, never from the sidebar itself.
- **Label/route mismatch**: in the Finance nav section, the label "Collections" points to `/finance`, and the label "Watchlist" points to `/collections` (`modules/team-leader/navigation.tsx:37-38`) — the labels and routes are swapped relative to what a reader would expect.
- **`instructor-payroll` is an intentional, documented redirect shim** to `/payroll` (Phase 20) — not a bug, but a legacy URL worth removing once confidence is high nothing external still links to it.
- **Structural gap vs. Admin's nav**: `PortalNavItem` (the type TL's sidebar renders) has no `permission` field at all, unlike `AdminNavItem` which does and is filtered through `filterAdminSections()`. Combined with §8's finding that several of TL's permissions are individually revocable per-user, this means **a TL whose `manage_financials` was revoked still sees "Collections" in their sidebar** and only discovers it's blocked after a `?error=forbidden` redirect.

---

## 8. Permission Audit

**Enforcement model.** 100% server-side (`modules/rbac/guards.ts`), via a signed session cookie carrying pre-resolved permissions. No client-side authorization gating found beyond hiding nav items.

**TL vs. Admin.** Every TL permission is a strict subset of super_admin's. On paper, TL and Admin are **operationally identical** except: (a) TL is branch-scoped everywhere via RLS, Admin is global; (b) TL lacks `manage_system`, `manage_permissions`, `manage_branches`, `manage_users`, `recover_archived_cohort`, `manage_ai_agents`. This is the strongest evidence that **the TL/Admin split is a branch-scoping and UX-ergonomics distinction, not a capability distinction** — worth stating plainly in any roadmap conversation about "what should TL be able to do that it can't."

**TL vs. Instructor.** Instructor's permission list is a strict subset of TL's; the real differentiator instructor-side is row-level ownership scope (own classes/courses only, enforced by RLS), not the permission names themselves.

**Studio CMS gate bypasses the permission system entirely.** `STUDIO_ROLES = new Set(['super_admin', 'team_leader'])` is hardcoded independently in **four separate files** (`modules/auth/actions.ts:14`, `app/select-workspace/page.tsx:8`, `app/studio/login/page.tsx:5`, `app/studio/(dashboard)/layout.tsx:8`) with no `PermissionName` behind it — any future change to who gets Studio access requires editing all four in lockstep with no compiler enforcement.

**Permission changes may not take effect until re-login.** Permissions live in a 7-day session cookie, refreshed only at sign-in or via an explicit `refreshUserPermissions()` call. That refresh call was not found alongside `saveUserPermissions()` in the TL-account-update flow (`modules/team-leaders/actions.ts:221-222`) — meaning an admin revoking a TL's permission mid-session likely does not take effect until the TL's cookie expires or they re-log in.

**DB/RLS permissions with no UI at all:**
- `read_audit_logs` — granted to TL, written to via `write_audit_log` RPC calls, but no page anywhere (TL or Admin) reads it back.
- `export_analytics` — granted to TL, no consumer checks this specific permission.
- `view_financial_reports`, `view_branch_revenue`, `manage_payments` — explicitly documented in code as scaffolding not yet seeded to the DB ("expose when financial features ship") — intentional, not a bug, but currently unusable.

---

## 9. Reuse Opportunities

**Already well-reused (no action needed):** the entire shell (`AppLayout`, `PortalSidebar`, `TopHeader`, `BottomNav`), `StatusBadge` (33 consumers across every portal), `NotificationBell`, `WizardStepper`, and — the cluster's best example — TL's Courses page reusing Admin's `CourseModal` wholesale.

**Ready-to-use, currently unwired capabilities** (highest-leverage reuse targets, because the hard part — the query/action function — is already written):

| Capability | Where it already exists | What's missing |
|---|---|---|
| Branch work queue | `modules/tasks` — `getOpenTasks(branchIds, {type, severity, limit})`, `getTaskCounts(branchIds)` | Any TL page/widget calling it |
| Dropout risk scoring | `modules/predictive-engine` — `computeDropoutScore`, pure function | A TL-facing risk widget (currently only consumed internally by automation) |
| Branch P&L | `modules/finance` — `getGroupPnLRows`/`getBranchPnLRows`/`getAcademyPnL`, already accept `branchIds` | TL page wiring (currently Admin-only) |
| Collection stage escalation | `modules/collections-pipeline` — full `FRIENDLY_REMINDER→...→FINAL_ESCALATION` engine | A stage badge/manual-escalate action on the existing TL Collections page (which currently reimplements a simpler version via `modules/finance`) |
| TL note authoring | `modules/student-notes` — `createTeamLeaderNote()`, fully implemented, tested | Any UI caller at all |
| Instructor "Review Center" pattern | `app/portal/instructor/review/page.tsx` + its query functions (`listInboxSubmissions`, `listProjectsForInstructorReview`, `getStudentsMissingEvaluation`) | Reuse the same functions scoped to "all instructors in my branch" instead of building new TL query logic |
| Session-level detail | `app/portal/instructor/groups/[id]/sessions/[sid]/SessionDetailsPanel.tsx` + `AttendanceForm.tsx` | Mount read-only inside TL's `InstructorPopup.tsx` |
| Evaluation/note authoring UI | `components/portal/instructor/StudentEvaluationModal.tsx`, `StudentNoteModal.tsx` — self-contained, permission-agnostic at the UI layer | Drop directly into TL's group/instructor views |

**Duplicated UI patterns worth consolidating instead of extending:**
- **KPI/stat-tile shape reimplemented 7 times**: `components/admin/KpiCard.tsx`, `AcademyKPICard.tsx`, `components/portal/student/QuickStatsGrid.tsx` (`StatTile` — most "designed for reuse," already supports `href`), `app/portal/team-leader/_components/ui/StatCard.tsx`, a second independent `instructors/workspace/components/StatCard.tsx`, `groups/workspace/components/KpiStrips.tsx` (2 more variants), `components/studio/StatCard.tsx`.
- **Gradient "hero" header built 3 times**: `HeroHeader.tsx` (student), `ParentHero.tsx`, `InstructorHero.tsx` — identical `StatChip` sub-component and identical gradient/blur-circle shell, independently defined in each. TL has no hero today; if one is ever built, it should factor out a shared `PortalHero` rather than becoming a 4th copy.
- **"Add adjustment" form built 3 times**: `InstructorDetailModal.tsx`, `StaffDetailModal.tsx`, and the standalone `AdjustmentModal.tsx` — near line-for-line duplicates.
- **"Add student note" form built twice**: `StudentNoteModal.tsx`'s inline form and `groups/[id]/students/[studentId]/NoteForm.tsx` — same fields, same categories, same severities, both delegating to the same underlying action.
- **Portfolio review query built twice**: `listAllProjectsForTL` and `listProjectsForInstructorReview` independently re-derive the same "resolve students → resolve portfolios → resolve projects by status" logic instead of sharing a scope-parameterized helper.
- **"Instructor performance" computed twice**, disagreeing with itself (§2, §3.2).

---

## 10. Technical Debt

Concrete, cited defects and dead code, ranked by severity:

1. **`attendance/record/page.tsx` cannot submit.** `recordAttendanceSession` (`modules/attendance/actions.ts:43-53`) hard-requires a `topic` field; `TLAttendanceRecordForm.tsx` has no such input. Every submission fails with a generic error banner after the TL fills the entire form. The same bug exists in the parallel Admin page. The only working attendance-recording path is the Groups drawer's `GroupAttendanceModal` (which does have a topic field).
2. **`special-sessions/page.tsx` has no branch filter.** `listSpecialSessions({ limit: 100 })` is called without `branchId`, even though the function accepts it and the sibling `new/` page correctly scopes by `user.branchIds`. Every TL sees every branch's trial/makeup sessions. One-line fix.
3. **Students: two parallel detail UIs.** `StudentDetailDrawer` (live, used by the list) vs. `students/[id]/page.tsx` (still linked from 3+ dashboard widgets, has features — a Finance/Contracts view — the drawer lacks).
4. **Groups: two parallel detail UIs**, plus `groups/[id]/edit` redirecting to a `?edit=` param the new workspace never reads (dead-end redirect).
5. **Parent Satisfaction: built twice.** `parent-satisfaction/page.tsx` is a near-byte-identical subset of the Satisfaction tab inside `parent-feedback/page.tsx` (which additionally has mobile responsiveness the standalone page lacks) — and neither is currently reachable via a working nav link (§7).
6. **Dead code, confirmed zero importers:** `finance/StudentOpsModal.tsx` (631 lines, superseded by `StudentOpsDrawer`), `finance/new/page.tsx` (superseded by `EnrollmentWizard`, reuses an Admin form component), `modules/progress`'s `getProgressForGroup` (shaped like a working oversight query, never called), `modules/gamification`'s `checkPerfectAttendanceAchievement` (defined, never invoked), `special-sessions`'s `postponeSpecialSession` import in `TLSpecialSessionDetail.tsx` (imported, never used) and `updateTrialStudent` (no caller anywhere in the TL portal).
7. **Two competing "recommended action" rule engines**: `modules/actions-engine` (legacy, still used by `students/[id]/page.tsx`) and `modules/operational-engine` (canonical, explicitly documented as its replacement). TL's student detail page still depends on the legacy one.
8. **Instructor creation: two divergent paths.** `instructors/new/page.tsx` is a full standalone page (still linked from Admin/Analytics/Instructor-Performance), separate from the workspace's modal-based creation — breaking the otherwise-consistent "modal-only creation" convention every other CRM entity converged on.
9. **Assignment creation ejects the TL from their own portal.** `createAssignment` always redirects to `/admin/assignments/[id]` regardless of caller; a TL who successfully creates an assignment lands inside the Admin shell with no way back, unlike the Certificates flow, which correctly parameterizes its success redirect per portal.
10. **Information-disclosure gap (low severity):** `getAssignment(id)` and `getCertificateDetail(id)` have no branch check at the read layer — a TL who obtains another branch's entity ID can view (not mutate — writes are still branch-checked) its detail.
11. **Naming collision**: `modules/team-leader` vs `modules/team-leaders` (§2) — rename, don't merge.
12. **`makeup`-session student entry requires pasting raw UUIDs** into plain text inputs, despite a working picker (`getAbsentSessionsForStudent`) already existing to power exactly that lookup for the parallel trial-session flow.

---

## 11. Product Gaps

**Critical**
- Fix the attendance-record submission bug (§10.1) — this is a primary CTA that currently always fails.
- Fix the special-sessions branch-scoping leak (§10.2) — a real cross-branch data exposure.

**Important**
- Build a branch-scoped evaluations query + TL page (currently zero support).
- Build a branch-scoped student-notes query + wire up the existing `createTeamLeaderNote` action into a UI.
- Make the Assignments "grading delay" KPI actionable — add the missing per-branch submission list query.
- Reconcile the two instructor-performance computations into one.
- Fix the Satisfaction nav link (`?tab=reviews` → `?tab=satisfaction`) and remove/redirect the orphaned `parent-satisfaction` page.
- Add permission-aware filtering to the TL sidebar (mirror Admin's `filterAdminSections`).
- Fix the assignment-creation redirect to stay inside the TL portal.

**Nice to have**
- Surface `modules/tasks` as a TL work-queue widget.
- Surface `computeDropoutScore` factors on the student risk views.
- Add a TL-scoped branch P&L view (functions already support it).
- Add a certificate revoke/reissue action and an "eligible but not issued" aggregate view.
- Add a student/session picker to the makeup-session form instead of raw UUID entry.

**Technical debt**
- Remove `StudentOpsModal.tsx`, `finance/new/page.tsx`, the orphaned `parent-satisfaction/page.tsx` (after confirming no external links).
- Consolidate the KPI-tile (7×), hero-header (3×), adjustment-form (3×), and note-form (2×) duplicates.
- Consolidate `listAllProjectsForTL`/`listProjectsForInstructorReview` behind one scope-parameterized function.
- Retire `modules/actions-engine` in favor of `modules/operational-engine`.

**Architecture debt**
- `PortalNavItem` needs a `permission` field, matching `AdminNavItem`.
- Confirm/fix that permission edits force-refresh the affected user's session.
- Decouple the Studio CMS gate from a hardcoded role Set into a real permission.
- Rename `modules/team-leader` → `modules/team-leader-portal` to remove the singular/plural collision.

**UX debt**
- Systemic sub-10px font sizes across dashboard/table/badge surfaces.
- Inconsistent CRUD interaction models (modal-based vs. full-page-paginated) between Leads/orphaned-Instructor-creation and the rest of the CRM cluster.
- Inconsistent bulk-action/delete support across Students/Parents/Groups/Instructors.
- Missing mobile-card fallbacks on Assignments' by-group/by-instructor tables and on the Calendar page.

---

## 12. Recommended Experience

Rather than inventing new TL concepts, the highest-confidence path is to **finish the pattern the codebase has already proven twice** (attendance's `getAttendanceReconciliationStatus`, assignments' `getTLAssignmentOverview`) and apply it to the modules where it's missing:

1. **A unified "Review Center"** (mirroring the instructor portal's own `/review` page, which already blends homework + portfolio + missing-evaluations into one queue) — but branch-wide instead of self-scoped. This single page would absorb: pending homework grading (with an actual list, not just counts), pending portfolio review (already works), and the two currently-nonexistent surfaces — evaluation gaps and note gaps — once their aggregate queries are written.
2. **An Instructor Monitoring drill-down**, reusing (not rebuilding) `SessionDetailsPanel.tsx`/`AttendanceForm.tsx`/`StudentEvaluationModal.tsx`/`StudentNoteModal.tsx` from the instructor portal, mounted read-only (or TL-override-enabled) inside the existing `InstructorPopup`.
3. **A branch work-queue widget** on the dashboard, powered by the already-built `modules/tasks` functions — this is pure wiring, no new backend logic.
4. **Consolidation passes** on the KPI-tile/hero/adjustment-form/note-form duplication (§9) before adding new UI in those families, so new work doesn't become an 8th copy.
5. **A navigation correctness pass**: fix the Satisfaction link, retire the orphaned page, fix the label/route swap, add permission-aware sidebar filtering, add nav entries for Attendance/Assignments (currently deep-link-only).

This ordering matters: items 4 and 5 are cheap and de-risk everything after them; item 1 delivers the mission's most explicitly requested capability ("late evaluations, missing notes, unreviewed homework, pending approvals") using existing precedent rather than new architecture.

---

## 13. Sprint Roadmap

Each sprint is scoped to be shippable independently; later sprints depend on earlier ones only where stated.

### Sprint A — Critical Bug Fixes
- **Goal**: Stop active harm — a broken primary CTA and a cross-branch data leak.
- **Scope**: Add `topic` field to `TLAttendanceRecordForm.tsx` (+ the parallel Admin form); add `branchId: user.branchIds` to the `special-sessions/page.tsx` query.
- **Dependencies**: None.
- **Risk**: Low — both are narrow, well-understood, single-file-ish changes with existing correct patterns to copy (Groups drawer's topic field; `new/page.tsx`'s branch scoping).
- **Expected outcome**: Attendance can be recorded from its dedicated page; special-sessions data is correctly branch-isolated.

### Sprint B — Navigation & Permission Correctness
- **Goal**: Make the existing 41 pages actually reachable and correctly gated.
- **Scope**: Fix `?tab=reviews`→`?tab=satisfaction`; retire/redirect `parent-satisfaction`; fix the Collections/Watchlist label-route swap; add `permission` filtering to `PortalNavItem`/TL sidebar; add sidebar entries for Attendance and Assignments; confirm/fix session refresh on permission edits.
- **Dependencies**: None (independent of Sprint A).
- **Risk**: Low-medium — the sidebar permission-filtering change touches a shared component (`PortalSidebar`), so needs regression checks across all portals, not just TL.
- **Expected outcome**: No dead links, no orphaned pages, sidebar honestly reflects what a given TL can access.

### Sprint C — Dead Code & Duplication Cleanup
- **Goal**: Remove maintenance hazards before building more on top of the affected areas.
- **Scope**: Delete `StudentOpsModal.tsx`, `finance/new/page.tsx` (after a final link-grep); consolidate the 7 KPI-tile implementations into one; consolidate the 3 adjustment-form implementations; consolidate the 2 note-form implementations; retire `modules/actions-engine` callers in favor of `modules/operational-engine`.
- **Dependencies**: None, but easiest right after Sprint A/B since those touch some of the same files (finance, attendance).
- **Risk**: Medium — consolidating shared UI components touches multiple pages at once; needs visual regression review across Students/Groups/Payroll/Portfolio.
- **Expected outcome**: One canonical KPI tile, hero shell (deferred until one is actually needed, but documented), adjustment form, and note form.

### Sprint D — Evaluation & Notes Oversight (the mission's core ask)
- **Goal**: Close the largest capability gap identified — TL currently cannot see whether instructors are evaluating/documenting students at all.
- **Scope**: New branch-scoped query functions in `modules/student-evaluations` and `modules/student-notes` (modeled directly on `getAttendanceReconciliationStatus`/`getTLAssignmentOverview`); wire `createTeamLeaderNote` into a UI; new TL page(s) or a Review Center tab.
- **Dependencies**: Benefits from Sprint C's consolidated components (note form, KPI tiles) to avoid a 3rd/8th duplicate.
- **Risk**: Medium — first genuinely new backend query logic in this roadmap (everything before this sprint was fix/consolidate); needs careful branch-scoping to avoid repeating the special-sessions leak pattern from Sprint A.
- **Expected outcome**: A TL can answer "which students haven't been evaluated this cycle" and "what high-severity notes exist across my branch this week" without opening students one at a time.

### Sprint E — Unified Review Center
- **Goal**: Fulfil the mission's "review center" ask end-to-end by combining Sprint D's new evaluation/notes visibility with the already-working assignment and portfolio queues, and making the assignment KPI counts actionable (add the missing per-branch pending-submissions list).
- **Scope**: One TL page/section aggregating: pending homework (with real drill-down list), pending portfolio (already works), evaluation gaps, note gaps (from Sprint D) — modeled on the instructor portal's existing `/review` page.
- **Dependencies**: Sprint D.
- **Risk**: Medium — this is the first page that aggregates across 4 domain modules at once; needs the same query-cost discipline the Assignments page already exhibits (tab-conditional loading) to avoid a slow page.
- **Expected outcome**: A single "what needs my attention" surface answering the mission's Phase 3 checklist almost verbatim.

### Sprint F — Instructor Monitoring Drill-Down
- **Goal**: Let a TL see *how* an instructor is teaching, not just aggregate outcome metrics.
- **Scope**: Mount `SessionDetailsPanel`/`AttendanceForm` read-only inside `InstructorPopup`; reconcile the two instructor-performance computations into one; drop in `StudentEvaluationModal`/`StudentNoteModal` for TL-side authoring during a monitoring session.
- **Dependencies**: Sprint C (consolidated components), Sprint D (evaluation/notes backend now exists to power the modals).
- **Risk**: Medium-high — reusing instructor-portal components in a TL context needs a permission-boundary review (should a TL be able to *edit* a session, or only view it?) — this is a product decision, not just an engineering one, and should be confirmed with the user before implementation.
- **Expected outcome**: TL can open an instructor's specific session and see/act on what actually happened, closing the "session-level blind spot" from §3.3.

### Sprint G — Underused Backend Capabilities
- **Goal**: Wire the ready-but-unused engines into the UI.
- **Scope**: `modules/tasks` work-queue widget on the dashboard; `computeDropoutScore` factors surfaced on student risk views; branch P&L view for TL (reusing `getGroupPnLRows` etc.); `collections-pipeline` stage badges/escalate action on the existing Collections page.
- **Dependencies**: None functionally, but sequenced last because it's additive rather than fixing anything broken — lowest urgency, highest "quick win once prioritized" ratio.
- **Risk**: Low — every function here already exists and is tested by its current (internal/automation) caller; this sprint is UI wiring only.
- **Expected outcome**: TL dashboard gets a real task inbox; risk/collection views get the scoring depth that already exists elsewhere in the codebase.

---

## 14. Risks

- **Scope creep risk**: the mission brief's Phase 3 workflow list (evaluations, notes, competitions, escalations) maps almost entirely onto Sprints D–E. It would be easy to over-scope Sprint D into "build the whole review center at once" — resist; the sprints are deliberately split so evaluation/notes backend logic ships and is validated before it's aggregated into a bigger page.
- **Shared-component risk**: Sprint C's consolidation work touches components used by Students, Groups, Payroll, and Portfolio simultaneously. A regression there has wide blast radius — needs visual QA across all four, not just TL.
- **Cross-portal risk**: the attendance-record bug fix (Sprint A) and the assignment-creation redirect fix (Sprint B/C candidate) both also affect the parallel Admin implementation of the same features — fixing TL-only risks the bug resurfacing from the Admin side, or the two implementations drifting further apart. Recommend fixing both call sites together or extracting the shared logic.
- **Permission-model risk**: the sidebar permission-filtering fix (Sprint B) is the first time TL's nav config gets a `permission` field — this changes `PortalNavItem`, a type shared with other portals' sidebars even if only TL currently lacks filtering. Needs confirmation this doesn't silently change Student/Parent/Instructor sidebar behavior.
- **Product-decision risk**: Sprint F (instructor session drill-down) raises a real question — should TL have edit rights inside an instructor's session, or view-only? This is not resolvable from the code alone and should be an explicit product decision before implementation, not an engineering default.
- **Unknown scale risk**: the `_listFromEnrollments` cap at 1000 rows (Finance) and the Attendance monitor's 100-row cap were both flagged as silent-truncation risks by the research agents — worth a data-volume check (how many active enrollments does the largest branch actually have today?) before these become real problems, independent of this roadmap.

---

## 15. Final Recommendation

**The Team Leader Portal is Partially Implemented, with the operational/financial spine closer to Mostly Complete and the academic-quality-oversight spine closer to Skeleton.**

Justification:

- It is unambiguously **not** "skeleton only" or "not really implemented" in aggregate — 41 real routes, deep CRUD across every core entity, a sophisticated finance/payroll engine, a genuinely strong analytics/alerts page, and multiple prior sprints of real iteration (evidenced by the accumulated Sprint 56–68 history) rule that out.
- It is **not** simply "mostly complete" either, because three of the mission's explicitly-named workflows — evaluation quality, missing-notes follow-up, and competitions — have **zero** code to build a UI on top of (no aggregate query exists, not even an unwired one), which is qualitatively different from "the feature exists but has a bug" (the state most other gaps in this audit are in).
- The correct mental model is a **two-speed portal**: everything that touches money, attendance, or CRM (students/parents/groups/instructors/leads/courses) has been rebuilt at least once into a mature, workspace-grade UI — sometimes *twice*, which is itself the main source of remaining defects (orphaned old UIs, broken redirects). Everything that touches academic-quality judgment (evaluations, notes, competitions) was scoped out of every prior sprint that touched the surrounding modules (the instructor and student portals *did* get this functionality; TL explicitly did not, per `docs/STUDENT_DOMAIN_IMPLEMENTATION_REPORT.md`'s own admission).

Implementation can begin with confidence: Sprints A–C are pure fixes/cleanup with no open product questions, and Sprints D–E have a proven architectural pattern to copy from two working precedents already in the codebase. The only sprint carrying a real open product decision is Sprint F (instructor session edit-vs-view rights), and it's sequenced last specifically so that decision can be made deliberately rather than under pressure to unblock earlier work.
