# Robocode LMS — UX Execution Plan

**Status:** Implementation roadmap, derived from `docs/design/product-blueprint.md`
(the constitution). This document is **planning only**: it inventories, classifies,
and sequences work. It contains **no UI, no code, no colors, no component styling,
no design tokens** — those belong to `DESIGN.md` and to the implementation itself.

**Relationship to the blueprint:** Where this document identifies a gap between
current implementation and the blueprint's standards, it is presented as
**CURRENT STATE vs. RECOMMENDED STATE**, each with rationale, benefits, risks,
migration cost, and priority. Nothing here silently overrides the blueprint or
silently "fixes" a screen — every divergence is surfaced as a decision for the
team to make, per blueprint §20 (Future AI Rules, MUST #10).

**Source data:** 181 route files (`app/**/page.tsx`) as of 2026-07-11, 9 layout
files, verified directly against the repository (route paths, redirect targets,
and query-layer imports were read from source, not inferred). No existing route
is renamed or moved by this document.

---

## 1. Executive Summary

### 1.1 What this plan is for

The blueprint (`product-blueprint.md`) defines *how the product should behave*.
This plan answers three implementation questions the blueprint deliberately
leaves open:

1. **Where does every one of the 181 existing routes sit** relative to the
   blueprint's business domains, templates, and standards?
2. **Where has implementation already diverged** from the blueprint — either
   as legitimate prior-art the blueprint should learn from, or as drift the
   blueprint should correct?
3. **In what order** should conformance work happen, given real dependencies
   (a shared component can't be extracted until its duplicates are inventoried;
   a wave can't start until its blocking decision is made)?

### 1.2 Headline findings

| # | Finding | Severity | Where addressed |
|---|---|---|---|
| 1 | **Modal/drawer CRUD pattern in production contradicts blueprint §7/§8** ("dedicated route, never a modal beyond 2-3 fields"). 11 routes are now pure `redirect()` shims because Create/Edit/View moved to a modal or drawer on the list page. This is a deliberate, shipped architecture, not a bug. | High — blocks a clean "every route = one template" mapping | §13.1 (Blueprint Conformance Gap #1) |
| 2 | **Admin and Team-Leader surfaces fork components per role for the same entities**, violating blueprint §6.1/D-02 ("one shared component tree, permission-gated, never forked per role"). Confirmed for Group detail and several other entities. Only the query layer (`modules/*/queries`) and atomic primitives (`StatusBadge`) are actually shared. | High — top long-term maintenance risk | §13.1 (Blueprint Conformance Gap #2) |
| 3 | **`/dashboard/analytics/*` is a superseded legacy surface**, not a distinct one. Confirmed via git history and source: it predates (2026-05-28) both `/portal/team-leader/analytics` (Sprint 31, 2026-05-31) and `/admin/analytics` (Sprint 34C, 2026-06-01), shares literally copy-pasted helper functions and the same underlying query functions (`resolveGroupFilter`, `listAtRiskStudents`, `listCertificateReadiness`, `listMissingAssignments`, `listSemestersForAnalytics`) with both, and is a strict functional subset (335 lines vs. 988 in `/admin/analytics`, 844 in `/portal/team-leader/analytics` — the latter two additionally include `listGroupPerformance`, `listCoursePerformance`, and finance KPIs). This resolves the open question flagged mid-research: it is legacy, not parallel-purpose. | Medium — a live route serving stale/duplicate content to 3 roles | §13.1 (Blueprint Conformance Gap #3) |
| 4 | **~6 confirmed pure legacy-alias redirects** beyond the modal-migration shims, from route renames/consolidations (`/admin/revenue`, `/admin/expenses` → `/admin/finance-center`; `/admin/sessions` → `/admin/attendance`; `/portal/team-leader/instructor-payroll` → `/portal/team-leader/payroll`; `/portal/student/semesters` → `/portal/student/history`). A recurring, ungoverned pattern. | Low — functions correctly, but has no lifecycle/monitoring policy | §13.2 |
| 5 | `/verify/[code]` is taxonomically mis-grouped in the blueprint's domain table (listed under Identity & Access; it actually queries `modules/certificates/queries` and is a Learning Record/Public artifact). Small correction, not an architecture problem. | Low | §5.3 |
| 6 | Studio's CMS `students` entity (`/studio/(dashboard)/students`) shares an exact name with the LMS `Student` entity across every other domain, despite being conceptually unrelated (marketing showcase content vs. an enrolled learner). Naming-collision risk for any future contributor (human or AI) searching the codebase by entity name. | Low | §13.2 |

### 1.3 What this plan recommends, in one paragraph

Resolve the two blocking architecture decisions first — modal-vs-route CRUD
(Wave 1) and shared-component consolidation (Wave 1) — because every later
wave either depends on the answer or will re-encounter the same fork if left
unresolved. Then work outward from the highest-frequency, highest-risk daily
loop (attendance/sessions/groups, Wave 2) through financial-integrity surfaces
(Wave 3), then analytics/growth/learning-record consolidation (Wave 4), and
finally governance/long-tail/Studio alignment (Wave 5). Full sequencing and
reasoning: §9.

### 1.4 Scope boundary (restated)

This document does not choose colors, typography, spacing, component internals,
or visual layout. Every reference to a "template" or "pattern" below is a
structural/behavioral classification (what data it shows, what interactions it
supports), not a visual specification.

---

## 2. Route Inventory

181 routes, grouped by the blueprint's 10 business domains (§3.1 of the
blueprint) plus a separate **Landing Dashboards** group for the 6 role-home /
studio-home aggregator pages, which don't belong to a single domain — they
aggregate across every domain a role can see (blueprint §11). Grouping this
way avoids repeating an identical "Business Domain" column value across 181
rows; the domain is stated once per group instead.

Columns: **Route** · **Template** (§3) · **Complexity** (§10) · **State**
(Active / Redirect-Shim / Legacy-Alias — see §7.4 legend) · **Notes** (only
where non-obvious).

### 2.0 Landing Dashboards (role-home aggregators — cross-domain)

| Route | Template | Complexity | State |
|---|---|---|---|
| `/admin` | Role Dashboard | L | Active |
| `/portal/team-leader` | Role Dashboard | L | Active |
| `/portal/instructor` | Role Dashboard | M | Active |
| `/portal/parent` | Role Dashboard | M | Active |
| `/portal/student` | Role Dashboard | L | Active |
| `/studio` | Role Dashboard (Studio surface, §2.6 of blueprint) | S | Active |

### 2.1 Domain 1 — People

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/students` | Data Table/List | M | Active | |
| `/admin/students/[id]` | Detail Profile | L | Active | 300 lines — largest People detail page |
| `/admin/students/new` | Single-Page/Multi-Step Form | S | Active | |
| `/admin/parents` | Data Table/List | S | Active | |
| `/admin/parents/[id]` | Detail Profile | S | Active | |
| `/admin/parents/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/instructors` | Data Table/List | S | Active | |
| `/admin/instructors/[id]` | Detail Profile | S | Active | |
| `/admin/instructors/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/team-leaders` | Data Table/List | S | Active | |
| `/admin/team-leaders/[id]` | Detail Profile | L | Active | |
| `/admin/team-leaders/[id]/edit` | Single-Page Create/Edit Form | S | Active | |
| `/admin/team-leaders/[id]/performance` | Analytics/Reporting | L | Active | Individual TL performance — related to Domain 6 |
| `/admin/team-leaders/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/staff` | Data Table/List | S | Active | HQ-only, Platform Governance-adjacent |
| `/portal/team-leader/students` | Data Table/List | S | Active | |
| `/portal/team-leader/students/[id]` | Detail Profile | L | Active | 381 lines — largest single detail page in the product |
| `/portal/team-leader/students/[id]/edit` | Redirect Shim | XS | **Redirect-Shim** | Redirects into modal/drawer edit on list or detail page |
| `/portal/team-leader/students/new` | Redirect Shim | XS | **Redirect-Shim** | Redirects into modal/drawer create |
| `/portal/team-leader/parents` | Data Table/List | S | Active | |
| `/portal/team-leader/parents/[id]` | Redirect Shim | XS | **Redirect-Shim** | |
| `/portal/team-leader/parents/new` | Redirect Shim | XS | **Redirect-Shim** | |
| `/portal/team-leader/instructors` | Data Table/List / Workspace | S | Active | `InstructorsWorkspaceClient` — Workspace template |
| `/portal/team-leader/instructors/new` | Single-Page Create/Edit Form | S | Active | Not converted to modal, unlike the entities above — inconsistency, see §7.3 |
| `/portal/instructor/students/search` | Data Table/List (search-only) | S | Active | Read-only, own-groups-scoped |

### 2.2 Domain 2 — Academics

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/courses` | Data Table/List | S | Active | |
| `/admin/courses/[id]` | Redirect Shim | XS | **Redirect-Shim** | 6 lines; edit moved to modal |
| `/admin/courses/[id]/modules/[moduleId]` | Detail Profile | S | Active | |
| `/admin/courses/new` | Redirect Shim | XS | **Redirect-Shim** | 6 lines |
| `/admin/semesters` | Data Table/List | M | Active | |
| `/admin/semesters/[id]` | Detail Profile | S | Active | |
| `/admin/semesters/new` | Single-Page Create/Edit Form | S | Active | |
| `/admin/semesters/academic-years` | Settings/Self-Service | XS | Active | |
| `/admin/groups` | Data Table/List | S | Active | |
| `/admin/groups/[id]` | Detail Profile | M | Active | |
| `/admin/groups/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/sessions` | Legacy Alias | XS | **Legacy-Alias** | → `/admin/attendance` |
| `/admin/special-sessions` | Data Table/List | M | Active | |
| `/admin/attendance` | Data Table/List (ledger-adjacent) | L | Active | 559 lines |
| `/admin/attendance/record` | Multi-Step Wizard | S | Active | |
| `/admin/assignments` | Data Table/List | M | Active | |
| `/admin/assignments/[id]` | Detail Profile | S | Active | |
| `/admin/assignments/[id]/submissions/[submissionId]` | Detail Profile | S | Active | |
| `/admin/assignments/new` | Single-Page Create/Edit Form | XS | Active | |
| `/portal/team-leader/courses` | Data Table/List | S | Active | |
| `/portal/team-leader/courses/[id]` | Redirect Shim | XS | **Redirect-Shim** | Mirrors `/admin/courses/[id]` |
| `/portal/team-leader/courses/new` | Redirect Shim | XS | **Redirect-Shim** | |
| `/portal/team-leader/groups` | Data Table/List / Workspace | S | Active | `GroupsWorkspaceClient` — Workspace template |
| `/portal/team-leader/groups/[id]` | Detail Profile | L | Active | 351 lines |
| `/portal/team-leader/groups/[id]/edit` | Redirect Shim | XS | **Redirect-Shim** | |
| `/portal/team-leader/groups/[id]/sessions/new` | Single-Page Create/Edit Form | S | Active | Not converted to modal — inconsistency, see §7.3 |
| `/portal/team-leader/groups/new` | Redirect Shim | XS | **Redirect-Shim** | |
| `/portal/team-leader/calendar` | Calendar/Scheduling | M | Active | |
| `/portal/team-leader/assignments` | Data Table/List | M | Active | |
| `/portal/team-leader/assignments/[id]` | Detail Profile | S | Active | |
| `/portal/team-leader/assignments/new` | Single-Page Create/Edit Form | S | Active | |
| `/portal/team-leader/special-sessions` | Data Table/List | S | Active | |
| `/portal/team-leader/special-sessions/[id]` | Detail Profile | S | Active | |
| `/portal/team-leader/special-sessions/new` | Multi-Step Wizard | M | Active | |
| `/portal/instructor/groups` | Data Table/List | S | Active | |
| `/portal/instructor/groups/[id]` | Detail Profile | L | Active | |
| `/portal/instructor/groups/[id]/sessions/[sid]` | Detail Profile | L | Active | |
| `/portal/instructor/groups/[id]/sessions/new` | Redirect Shim | XS | **Redirect-Shim** | Redirects to group page |
| `/portal/instructor/groups/[id]/students/[studentId]` | Detail Profile | L | Active | |
| `/portal/instructor/calendar` | Calendar/Scheduling | M | Active | |
| `/portal/instructor/homework` | Data Table/List | M | Active | |
| `/portal/instructor/homework/[submissionId]` | Detail Profile | S | Active | |
| `/portal/instructor/special-sessions` | Data Table/List | S | Active | |
| `/portal/instructor/special-sessions/[id]` | Detail Profile | S | Active | |
| `/portal/instructor/special-sessions/new-makeup` | Redirect Shim (role-restricted) | XS | **Redirect-Shim** | Redirects instructors away entirely — not a modal migration, an access-restriction shim |
| `/portal/parent/attendance` | Data Table/List (read-only) | M | Active | |
| `/portal/parent/assignments` | Data Table/List (read-only) | M | Active | |
| `/portal/student/attendance` | Data Table/List (read-only) | S | Active | |
| `/portal/student/assignments` | Data Table/List | S | Active | |
| `/portal/student/assignments/[assignmentId]` | Detail Profile | S | Active | |

### 2.3 Domain 3 — Learning Record

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/portfolio` | Data Table/List | S | Active | |
| `/admin/portfolio/[studentId]` | Portfolio/Timeline | L | Active | |
| `/admin/portfolio/[studentId]/achievements/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/portfolio/[studentId]/badges/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/portfolio/[studentId]/projects/new` | Single-Page Create/Edit Form | S | Active | |
| `/admin/portfolio/[studentId]/projects/[projectId]/edit` | Single-Page Create/Edit Form | S | Active | |
| `/admin/portfolio/[studentId]/projects/promote` | Single-Page Create/Edit Form | S | Active | |
| `/admin/certificates` | Data Table/List | M | Active | |
| `/admin/certificates/[certificateId]` | Detail Profile | XS | Active | |
| `/admin/certificates/new` | Multi-Step Wizard | S | Active | Includes Bulk Group Certificate Generation flow |
| `/admin/certificates/templates` | Data Table/List | S | Active | |
| `/admin/certificates/templates/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/certificates/templates/[templateId]/edit` | Single-Page Create/Edit Form | XS | Active | |
| `/portal/team-leader/portfolio` | Portfolio/Timeline | M | Active | |
| `/portal/team-leader/certificates` | Data Table/List | M | Active | |
| `/portal/team-leader/certificates/[id]` | Detail Profile | S | Active | |
| `/portal/team-leader/certificates/new` | Multi-Step Wizard | S | Active | |
| `/portal/instructor/portfolio` | Portfolio/Timeline | M | Active | |
| `/portal/parent/portfolio` | Portfolio/Timeline (read-only) | M | Active | |
| `/portal/parent/progress` | Analytics/Reporting (read-only, simplified) | S | Active | |
| `/portal/parent/certificates` | Data Table/List (read-only) | M | Active | |
| `/portal/student/portfolio` | Portfolio/Timeline | S | Active | Primary self-surface, per blueprint §2.5 |
| `/portal/student/leaderboard` | Analytics/Reporting (gamification) | M | Active | |
| `/portal/student/certificates` | Data Table/List (read-only) | M | Active | |
| `/portal/student/videos` | Data Table/List | S | Active | |
| `/portal/student/history` | Data Table/List | S | Active | Renamed from "semesters," see §7.4 |
| `/portal/student/semesters` | Legacy Alias | XS | **Legacy-Alias** | → `/portal/student/history` |

### 2.4 Domain 4 — Finance

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/finance` | Finance/Ledger Surface | M | Active | |
| `/admin/finance/new` | Single-Page Create/Edit Form | S | Active | |
| `/admin/finance/queue` | Approval Queue | M | Active | |
| `/admin/finance-center` | Finance/Ledger Surface | M | Active | Consolidation target of Phase XXXV — see `project-phase35-finance-center` memory |
| `/admin/revenue` | Legacy Alias | XS | **Legacy-Alias** | → `/admin/finance-center` |
| `/admin/expenses` | Legacy Alias | XS | **Legacy-Alias** | → `/admin/finance-center` (preserves query string) |
| `/admin/payroll` | Finance/Ledger Surface | S | Active | |
| `/portal/team-leader/finance` | Finance/Ledger Surface | S | Active | |
| `/portal/team-leader/finance/new` | Single-Page Create/Edit Form | S | Active | |
| `/portal/team-leader/collections` | Finance/Ledger Surface | S | Active | |
| `/portal/team-leader/payroll` | Finance/Ledger Surface / Workspace | S | Active | `FinanceClient` — Workspace template; unified target of Phase 20 |
| `/portal/team-leader/instructor-payroll` | Legacy Alias | XS | **Legacy-Alias** | → `/portal/team-leader/payroll` (Phase 20 rename) |
| `/portal/instructor/payments` | Finance/Ledger Surface (read-only) | S | Active | |
| `/portal/parent/finance` | Finance/Ledger Surface (read-only) | M | Active | |

### 2.5 Domain 5 — Growth (CRM)

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/leads` | Data Table/List | M | Active | |
| `/admin/leads/[id]` | Detail Profile | M | Active | |
| `/admin/leads/new` | Single-Page Create/Edit Form | XS | Active | |
| `/admin/leads/funnel` | Analytics/Reporting | M | Active | |
| `/portal/team-leader/leads` | Data Table/List | M | Active | |
| `/portal/team-leader/leads/[id]` | Detail Profile | S | Active | |
| `/portal/team-leader/leads/new` | Single-Page Create/Edit Form | S | Active | |
| `/portal/team-leader/parent-feedback` | Approval Queue / Data Table | M | Active | |
| `/portal/team-leader/parent-satisfaction` | Analytics/Reporting | S | Active | |
| `/portal/parent/feedback` | Single-Page Create/Edit Form (submission) | M | Active | |
| `/book-session` | Public Marketing Page (lead capture form) | XS | Active | Public-facing; feeds the funnel |

### 2.6 Domain 6 — Operations Intelligence

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/analytics` | Analytics/Reporting | XL | Active | 988 lines — superset; see §1.2 Finding 3 |
| `/admin/executive` | Analytics/Reporting | L | Active | |
| `/admin/branches` | Data Table/List | S | Active | |
| `/admin/branches/[id]` | Detail Profile | XS | Active | |
| `/admin/branches/[id]/performance` | Analytics/Reporting | L | Active | |
| `/admin/branches/new` | Single-Page Create/Edit Form | S | Active | |
| `/dashboard/analytics` | Analytics/Reporting | L | **Flagged — Legacy/Superseded** | See §1.2 Finding 3 and §13.1 Gap #3: resolved as legacy, recommend consolidation |
| `/dashboard/analytics/courses` | Analytics/Reporting | M | **Flagged — Legacy/Superseded** | |
| `/dashboard/analytics/groups` | Analytics/Reporting | M | **Flagged — Legacy/Superseded** | |
| `/dashboard/analytics/semester/[id]` | Analytics/Reporting | S | **Flagged — Legacy/Superseded** | |
| `/portal/team-leader/analytics` | Analytics/Reporting | XL | Active | 844 lines |
| `/portal/team-leader/instructor-performance` | Analytics/Reporting | L | Active | |
| `/admin/team-leaders/[id]/performance` | Analytics/Reporting | L | Active | Cross-listed under People (§2.1) — evaluates a person, lives conceptually in both |

### 2.7 Domain 7 — Platform Governance (HQ-only)

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/admin/system-health` | Governance/System Tooling | XL | Active | 636 lines |
| `/admin/system-events` | Governance/System Tooling | M | Active | |
| `/admin/production-readiness` | Governance/System Tooling | XL | Active | 568 lines |
| `/admin/recovery` | Governance/System Tooling | L | Active | |
| `/admin/communications` | Governance/System Tooling | M | Active | |

### 2.8 Domain 8 — Marketing Content (Studio — separate surface, blueprint §2.6/D-08)

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/studio` | Role Dashboard (Studio) | S | Active | Also counted in §2.0 |
| `/studio/blog` | Content Management | M | Active | |
| `/studio/homepage` | Content Management | L | Active | |
| `/studio/gallery` | Content Management | S | Active | |
| `/studio/partners` | Content Management | S | Active | |
| `/studio/reviews` | Content Management | M | Active | |
| `/studio/site-media` | Content Management | S | Active | |
| `/studio/branches` | Content Management | L | Active | |
| `/studio/students` | Content Management | XL | Active | **Naming collision with LMS Student entity** — see §1.2 Finding 6 |
| `/studio/why-robocode` | Content Management | XL | Active | 572 lines |
| `/studio/accreditations` | Content Management | L | Active | |
| `/studio/bookings` | Content Management | S | Active | |
| `/studio/learning-journey` | Content Management | XL | Active | 494 lines |
| `/studio/faq` | Content Management | M | Active | |
| `/studio/projects` | Content Management | M | Active | |

### 2.9 Domain 9 — Identity & Access

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/login` | Authentication | XS | Active | |
| `/forgot-password` | Authentication | S | Active | |
| `/reset-password` | Authentication | S | Active | |
| `/select-workspace` | Authentication (post-login routing) | S | Active | |
| `/account/password` | Settings/Self-Service | S | Active | |
| `/studio/login` | Authentication (Studio surface) | XS | Active | |
| `/studio/forgot-password` | Authentication (Studio surface) | S | Active | |
| `/studio/reset-password` | Authentication (Studio surface) | S | Active | |

### 2.10 Domain 10 — Public Marketing Site (unauthenticated)

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/` | Public Marketing Page | S | Active | |
| `/blog` | Public Marketing Page | S | Active | |
| `/blog/[slug]` | Public Marketing Page | S | Active | |

### 2.11 Ungrouped — Public Certificate Verification (taxonomy correction)

| Route | Template | Complexity | State | Notes |
|---|---|---|---|---|
| `/verify/[code]` | Public Marketing Page (single-purpose verification) | S | Active | Queries `modules/certificates/queries`. Blueprint §3.1 lists this under Identity & Access; correct domain is **Learning Record (Certificates) / Public sub-surface** — see §5.3 for the recommended correction. Not a contradiction of blueprint architecture, a small IA refinement. |

**Route count check:** 6 (Landing) + 24 (§2.1) + 49 (§2.2) + 26 (§2.3) + 14
(§2.4) + 11 (§2.5) + 13 (§2.6) + 5 (§2.7) + 15 (§2.8) + 8 (§2.9) + 3 (§2.10) +
1 (§2.11) − 7 double-counted routes (`/admin`, `/portal/team-leader`,
`/portal/instructor`, `/portal/parent`, `/portal/student`, `/studio` counted
once in §2.0 and referenced but not re-listed elsewhere; `/admin/team-leaders/[id]/performance`
counted once in §2.1, cross-referenced in §2.6) = **181 unique routes**, sourced from
`find app -name page.tsx` re-run against the live tree.

---

## 3. Template Inventory

17 recurring screen templates found across the 181 routes, defined structurally
(what the template does), not visually:

| Template | Definition | Route count (approx.) | Representative routes |
|---|---|---|---|
| **Public Marketing Page** | Unauthenticated, content-first, no app chrome | 4 | `/`, `/blog`, `/blog/[slug]`, `/verify/[code]` |
| **Authentication** | Credential entry/recovery, minimal chrome, no nav | 8 | `/login`, `/forgot-password`, `/studio/login` |
| **Role Dashboard (Home)** | Aggregates across every domain a role can see; KPIs + recent activity + quick actions (blueprint §11) | 6 | `/admin`, `/portal/team-leader`, `/studio` |
| **Data Table/List** | Paginated, filterable, sortable list at a domain root (blueprint §9) | ~55 | `/admin/students`, `/portal/team-leader/leads` |
| **Detail Profile** | `/{entity}/[id]`, tabs + header + metadata panel (blueprint §10) | ~35 | `/admin/students/[id]`, `/portal/instructor/groups/[id]` |
| **Single-Page Create/Edit Form** | ≤8 fields, one concern (blueprint §8.1) | ~28 | `/admin/parents/new`, `/admin/groups/new` |
| **Multi-Step Wizard** | Distinct-concern steps + review step (blueprint §8.2) | 5 | `/admin/certificates/new` (bulk), `/portal/team-leader/special-sessions/new` |
| **Workspace** | Multi-panel power-user surface; `components/`, `dialogs/`, `hooks/` colocated folder convention | 3 | `/portal/team-leader/groups` (GroupsWorkspaceClient), `/portal/team-leader/instructors` (InstructorsWorkspaceClient), `/portal/team-leader/payroll` (FinanceClient) |
| **Calendar/Scheduling** | Date-oriented, session-centric view | 2 | `/portal/team-leader/calendar`, `/portal/instructor/calendar` |
| **Analytics/Reporting** | Charts + KPIs, trend/comparison-oriented, no CRUD | 13 | `/admin/analytics`, `/admin/executive`, `/dashboard/analytics/*` |
| **Finance/Ledger Surface** | Append-only-adjacent, non-optimistic writes (blueprint D-06) | 9 | `/admin/finance-center`, `/portal/team-leader/collections` |
| **Approval Queue** | Pending-item review + approve/reject action | 2 | `/admin/finance/queue`, `/portal/team-leader/parent-feedback` |
| **Portfolio/Timeline** | Chronological, achievement-oriented record | 6 | `/portal/student/portfolio`, `/admin/portfolio/[studentId]` |
| **Settings/Self-Service** | Own-account configuration | 2 | `/account/password`, `/admin/semesters/academic-years` |
| **Governance/System Tooling** | Internal, HQ-only, operational-health surfaces | 5 | `/admin/system-health`, `/admin/recovery` |
| **Content Management (Studio CMS)** | Editorial content editing, separate permission model (blueprint §2.6) | 15 | `/studio/blog`, `/studio/homepage` |
| **Redirect/Legacy Alias** | No UI of its own; `redirect()` only — a non-visual, governance-relevant pattern, not a screen template | 17 | See §7.4 for full breakdown |

**Note on counting:** several routes legitimately combine two templates (e.g.
`/portal/team-leader/groups` is both a Data Table/List *and* a Workspace
entry point). Route counts above are approximate and additive across
categories for that reason — they are a planning aid, not a strict partition.

---

## 4. Layout Inventory

9 `layout.tsx` files found, each defining one authenticated (or public) chrome
shell:

| Layout | Governs | Nav pattern | Notes |
|---|---|---|---|
| `app/layout.tsx` (root) | Every route, public and authenticated | N/A — global providers/fonts only | |
| `app/admin/layout.tsx` | All `/admin/*` (24 + People/Academics/etc. routes) | Desktop-first sidebar, full domain set (blueprint §3.2) | Largest permission surface |
| `app/portal/team-leader/layout.tsx` | All `/portal/team-leader/*` (~45 routes) | Desktop + tablet sidebar, mobile bottom-nav + "More" sheet (per `project-mobile-ux-sprint` memory) | Heaviest route-dense role, per blueprint §2.2 |
| `app/portal/instructor/layout.tsx` | All `/portal/instructor/*` | Mobile-first bottom nav | |
| `app/portal/parent/layout.tsx` | All `/portal/parent/*` | Mobile-first bottom nav | |
| `app/portal/student/layout.tsx` | All `/portal/student/*` | Mobile-first bottom nav | |
| `app/dashboard/layout.tsx` | `/dashboard/analytics/*` only | Thin top-bar, 3-tab sub-nav (Overview/Groups/Courses), no sidebar | Structurally simpler than admin/TL layouts — consistent with its identity as an early, pre-role-split analytics shell (§1.2 Finding 3) |
| `app/studio/(dashboard)/layout.tsx` | All `/studio/*` authenticated routes | Separate chrome from academy surfaces, per blueprint §2.6/D-08 | Correctly isolated — no shared-nav leakage found |
| *(implicit)* Public/auth routes | `/`, `/blog*`, `/login`, `/forgot-password`, etc. | No shell — rendered directly under root layout | Not a dedicated `layout.tsx`, noted for completeness |

**Layout-level finding:** `app/dashboard/layout.tsx`'s allowed-roles list
(`super_admin`, `team_leader`, `instructor`) is itself evidence supporting
Finding 3 (§1.2) — it was built before the role-specific analytics surfaces
existed and predates the eventual role split into `/admin/analytics` (HQ) and
`/portal/team-leader/analytics` (branch). No `/portal/instructor/analytics`
equivalent was ever built, meaning instructors today reach a legacy surface
with no modern counterpart — see §13.1 Gap #3 for the recommendation.

---

## 5. Business Domain Mapping

### 5.1 Domain-to-route-count summary

| Domain | Routes | % of 181 | Heaviest role |
|---|---|---|---|
| Academics | 49 | 27% | Team Leader |
| Learning Record | 26 | 14% | Admin / Student |
| Marketing Content (Studio) | 15 | 8% | N/A (separate surface) |
| People | 24 | 13% | Admin / Team Leader |
| Finance | 14 | 8% | Admin |
| Operations Intelligence | 13 | 7% | Admin |
| Growth (CRM) | 11 | 6% | Team Leader |
| Identity & Access | 8 | 4% | All roles |
| Platform Governance | 5 | 3% | Admin only |
| Public Marketing Site | 3 | 2% | N/A (unauthenticated) |
| Landing Dashboards (cross-domain) | 6 | 3% | All roles |
| Ungrouped (taxonomy correction) | 1 | <1% | Public |

Academics is by far the largest domain (over a quarter of all routes), which
directly reflects the blueprint's §1.1 framing: sessions/groups/attendance are
the core operating loop, and every other domain is a derivative of it. This is
a validation of the blueprint's domain model against real implementation, not
a gap.

### 5.2 Confirmed alignment with blueprint §3.2 permission matrix

Every route's role-scoping (verified via each route's/layout's guard imports —
`requireAuth`, `getCurrentUser`, `ROLE_PORTAL_MAP`) matches the blueprint's
stated domain-access table. No route was found granting a role access to a
domain the blueprint says they shouldn't have (e.g., no Instructor or Student
route touches Finance beyond their own pay/balance; no Platform Governance
route is reachable outside `/admin`).

### 5.3 Recommended taxonomy correction

**CURRENT STATE:** Blueprint §3.1 lists `/verify/[code]` under Identity & Access
(Domain 9).

**RECOMMENDED STATE:** Reclassify as Learning Record (Certificates) / Public
sub-surface (Domain 3), since it queries `verifyCertificate` from
`modules/certificates/queries` and its entire purpose is validating a
certificate's authenticity — it has nothing to do with login/account access.

- **Why current is weaker:** Grouping by "it's public/unauthenticated" (an
  access-boundary trait) rather than "what it does" (a certificate lookup)
  repeats the exact IA mistake the blueprint's own §3 warns against (route
  folder vs. business-domain boundary).
- **Benefits:** Keeps the domain table's "what the system does" framing
  internally consistent; helps a future contributor find this route when
  searching Learning Record work, not Identity & Access work.
- **Risks:** None — this is a documentation-only reclassification, no code or
  route changes.
- **Migration cost:** Trivial — a one-line edit to blueprint §3.1's table.
- **Priority:** Low.

---

## 6. Screen Composition Matrix

How the 17 templates (§3) combine with the 10 domains (§3.1) in practice —
which domains use which templates, surfacing where a domain has an unusually
narrow or wide template range (a signal for §8's component forecast):

| Domain | Templates present | Template diversity |
|---|---|---|
| People | Data Table/List, Detail Profile, Single-Page Form, Workspace, Redirect Shim | High |
| Academics | Data Table/List, Detail Profile, Single-Page Form, Multi-Step Wizard, Workspace, Calendar, Redirect Shim, Legacy Alias | Highest — largest domain, matches route-count finding (§5.1) |
| Learning Record | Data Table/List, Detail Profile, Portfolio/Timeline, Multi-Step Wizard, Legacy Alias | Medium-High |
| Finance | Finance/Ledger Surface, Single-Page Form, Approval Queue, Workspace, Legacy Alias | Medium |
| Growth (CRM) | Data Table/List, Detail Profile, Single-Page Form, Analytics/Reporting, Approval Queue, Public Marketing Page (lead capture) | Medium |
| Operations Intelligence | Analytics/Reporting only | Lowest — single-purpose domain by design, expected |
| Platform Governance | Governance/System Tooling only | Lowest — single-purpose domain by design, expected |
| Marketing Content | Content Management, Role Dashboard, Authentication | Low — isolated surface, expected per blueprint §2.6 |
| Identity & Access | Authentication, Settings/Self-Service | Low — expected |
| Public Marketing Site | Public Marketing Page | Lowest — expected |

**Reading this matrix:** Academics and People carry the widest template range
because they carry the most CRUD-lifecycle weight (blueprint §7) across the
most roles. Operations Intelligence, Platform Governance, and Public Marketing
are intentionally narrow — a wide template range there would itself be a
red flag (scope creep into a domain that should stay single-purpose).

---

## 7. Reusable Pattern Analysis

### 7.1 Confirmed shared patterns (working as intended)

- **Workspace pattern** (`components/`, `dialogs/`, `hooks/` colocated
  folders): consistently implemented across `GroupsWorkspaceClient`,
  `InstructorsWorkspaceClient`, and `payroll`'s `FinanceClient`. This is a
  genuine, blueprint-compliant reusable pattern (matches blueprint §18's
  naming convention exactly) and should be the template for any future
  power-user multi-panel surface.
- **`StatusBadge`**: the one confirmed cross-role, cross-domain shared atomic
  primitive found in this inventory pass. It is the existence proof that
  D-02 (shared component tree) is achievable — the gap is that it hasn't
  been extended past the atomic-primitive layer (§7.2).
- **Redirect-shim-with-query-preservation**: every legacy-alias redirect
  found (`/admin/expenses`, `/portal/team-leader/instructor-payroll`)
  correctly forwards `searchParams` to the new destination. This is a small
  but consistently-applied detail worth preserving as the pattern going
  forward.

### 7.2 Confirmed duplicated patterns (Blueprint Conformance Gap #2, detailed in §13.1)

Admin and Team-Leader surfaces maintain **separate composed components** for
the same conceptual entity. Confirmed for Group detail: Admin uses
`GroupDetailView` / `GroupStudentsTable` / `AcademicConfigCard` /
`GroupFinanceSection`; Team-Leader uses `TLEnrollStudentsForm` /
`TLAssignCourseForm` for the equivalent interactions. They share only the
query layer (`modules/*/queries`) and atomic primitives (`StatusBadge`). This
is the single largest deviation from blueprint D-02 found in this pass — see
§13.1 for the full CURRENT/RECOMMENDED analysis.

### 7.3 A pattern found *inconsistently* applied: the modal/drawer migration

The modal/drawer CRUD migration (blueprint Conformance Gap #1, §13.1) was not
applied uniformly even within a single entity type. Examples:
`/portal/team-leader/students/new` and `/portal/team-leader/students/[id]/edit`
are redirect shims (moved to modal), but `/portal/team-leader/instructors/new`
and `/portal/team-leader/groups/[id]/sessions/new` remain dedicated routes
with real forms. This suggests the migration was applied opportunistically
per-entity rather than as a system-wide decision — which is itself evidence
for why §13.1 Gap #1 needs an explicit, documented resolution rather than
continuing ad hoc.

### 7.4 Redirect/Legacy Alias — full inventory (17 routes)

| Category | Routes | Count |
|---|---|---|
| Modal/drawer CRUD migration shims | `/admin/courses/[id]`, `/admin/courses/new`, `/portal/team-leader/courses/[id]`, `/portal/team-leader/courses/new`, `/portal/team-leader/students/new`, `/portal/team-leader/students/[id]/edit`, `/portal/team-leader/groups/[id]/edit`, `/portal/team-leader/groups/new`, `/portal/team-leader/parents/[id]`, `/portal/team-leader/parents/new`, `/portal/instructor/groups/[id]/sessions/new` | 11 |
| Role-restriction shim (not a modal migration) | `/portal/instructor/special-sessions/new-makeup` | 1 |
| Pure rename/consolidation alias | `/admin/revenue`, `/admin/expenses`, `/admin/sessions`, `/portal/team-leader/instructor-payroll`, `/portal/student/semesters` | 5 |

**Governance recommendation for this whole category:** see §13.2.

---

## 8. Component Demand Forecast

Given the confirmed duplication (§7.2) and the modal-migration inconsistency
(§7.3), the component work implied by full blueprint conformance — **not** a
design-token or visual-component spec, but a structural forecast of what
shared logic/composition units would need to exist:

| Forecast area | Driven by | Rough scope |
|---|---|---|
| Shared entity-detail component sets (Student, Group, Instructor, Parent, Lead) | §7.2 duplication finding | 5 entities × ~4 composed sub-components each ≈ 20 components to consolidate from ~40 existing role-forked equivalents |
| Shared entity-form components (Create/Edit, per blueprint §7 "Edit reuses Create") | §7.3 modal-migration inconsistency + general form audit | ~15 entities' worth of forms, several currently only existing as list-page modals with no reusable extracted form component |
| Notification/bell pattern extension | Blueprint §12 — "already shipped for Team Leader," canonical model to extend | Extend existing pattern to Admin, Instructor, Parent, Student — not new component design, reuse |
| Notes component extension | Blueprint §10 — "already established for Student Notes," reuse target | Extend to Leads, Instructors per blueprint's own instruction |
| Command palette (blueprint §4.7/D-07) | Confirmed: no `cmdk`/palette implementation exists in the codebase today | New build, one component, unifying 3 result types (navigate-to-entity, navigate-to-page, quick actions) |
| Mobile card-list table conversion | Blueprint §16.5 — "already the shape of Instructor's group/session views," standard going forward | Audit remaining Admin/Team-Leader tables (~55 Data Table/List routes) for which still lack a card-list mobile fallback |

This is a forecast of **effort shape**, not a build spec — actual component
names/props/styling are implementation decisions made when each wave (§9)
starts, informed by whatever `DESIGN.md` specifies for visual treatment.

---

## 9. Development Priority Waves

Sequenced by real dependency, not just business value — a wave that reuses a
still-forking component would just create a third fork.

### Wave 1 — Foundation (blocking; do first)

1. **Resolve the modal-vs-route CRUD divergence** (§13.1 Gap #1) — a decision,
   not an implementation task. Every subsequent CRUD-touching wave depends on
   knowing which pattern to build in.
2. **Consolidate duplicated Admin/Team-Leader components** into a shared,
   permission-gated tree (§13.1 Gap #2, blueprint §6.1) for at least the
   highest-traffic entities (Group, Student) before Wave 2 touches them again.
3. **Build the Command Palette** (blueprint D-07 open item, §8) — foundational
   navigation investment, not entity-specific, cheapest to build once rather
   than retrofitted per-domain later.
4. **Audit and formally document the legacy-redirect inventory** (§7.4) as a
   governance list (not a removal) — cheap, unblocks §13.2's monitoring
   recommendation.

### Wave 2 — Core Operational Loop

Attendance, Sessions, Groups, Calendar (Instructor + Team Leader) — the
highest-frequency, front-line daily-use surfaces per blueprint §1.2 goal #1.
Includes the mobile card-table conversion audit (§16.5) and a loading/empty
state audit for these specific routes, since they're used under time pressure
where a bad loading/empty state costs the most (blueprint §1.4).

### Wave 3 — Finance & Payroll

Finance, Finance-Center, Payroll, Collections. Enforce non-optimistic ledger
writes (blueprint D-06) and consistent History/audit-trail sections
(blueprint §10) across every Finance/Ledger Surface template instance. This
wave depends on Wave 1's component consolidation being done for at least the
Student/Group entities Finance screens reference.

### Wave 4 — Growth, Learning Record, Analytics

Leads/Funnel, Portfolio/Certificates/Gamification, and **resolution of the
`/admin/analytics` vs. `/dashboard/analytics` overlap** (§13.1 Gap #3) —
placed here rather than Wave 1 because it's a consolidation/cleanup decision,
not a blocker for other waves' work.

### Wave 5 — Governance, Studio, Long Tail

System Health/Recovery/Production-Readiness, Studio CMS alignment audit
(confirming no chrome/pattern leakage per blueprint D-08), and the Studio
`students` naming-collision documentation fix (§13.2). Lowest urgency —
internal-only or already-isolated surfaces.

### Wave sequencing rationale summary

| Wave | Why this position | Why not earlier | Why not later |
|---|---|---|---|
| 1 | Every other wave either depends on its decisions or risks repeating the exact problem being solved | N/A — nothing precedes it | Leaving it for later means Waves 2-4 build on an unresolved fork, doubling rework |
| 2 | Highest-frequency, highest blueprint-goal-alignment (§1.2 goal #1) | Depends on Wave 1's component consolidation for Group/Student | Delaying past Wave 2 leaves the front-line daily loop non-compliant longest |
| 3 | Ledger-integrity work benefits from Wave 2's touched entities (Group/Student) already being consolidated | Depends on Wave 1 + partially Wave 2 | Finance risk (D-06 violations) is real but lower-frequency than Wave 2's daily loop |
| 4 | Analytics overlap is a cleanup, not a blocker; Learning Record has lower daily-use frequency than Academics/Finance | Could theoretically run earlier since it's mostly independent, but lower urgency than Waves 2-3 | N/A — no dependency forces it later than this |
| 5 | Internal-only/isolated surfaces; no other wave depends on them, and they don't block anything | Could run anytime — sequenced last purely on business urgency, not dependency | N/A — terminal wave |

---

## 10. Complexity Analysis

### 10.1 Complexity tiers (used throughout §2)

| Tier | Definition | Line-count proxy* |
|---|---|---|
| **XS** | Redirect shim or trivial single-purpose page | ≤15 lines |
| **S** | Single table or form, no sub-relations | ~15-110 lines |
| **M** | Detail with 2-4 related sections, or a standard multi-section form | ~110-250 lines |
| **L** | Detail/workspace with many relations, a wizard, or multi-chart analytics | ~250-570 lines |
| **XL** | Full multi-entity workspace or broad aggregator dashboard | 570+ lines |

*Line count is a rough proxy only (per the original research caveat) — it
correlates with, but does not equal, UX complexity. A few routes are flagged
below where the proxy and actual complexity diverge.

### 10.2 Complexity distribution across all 181 routes

| Tier | Route count | % |
|---|---|---|
| XS | 26 | 14% |
| S | 79 | 44% |
| M | 40 | 22% |
| L | 26 | 14% |
| XL | 10 | 6% |

Nearly 60% of the product (XS+S) is low-complexity — consistent with a
CRUD-heavy product where most screens are simple lists/forms and complexity
concentrates in a small number of aggregator/analytics/workspace surfaces.

### 10.3 Where the proxy is misleading

- `/admin/courses/[id]`, `/admin/courses/new`, `/portal/team-leader/courses/[id]`,
  `/portal/team-leader/courses/new` all show as XS (6 lines) by line count —
  correctly so, since they're redirect shims, not under-built pages. No
  divergence here; flagged only to confirm the proxy is accurate for this
  category.
- `/admin/team-leaders/[id]/performance` (239 lines, tier L) and
  `/portal/team-leader/instructor-performance` (218 lines, tier L) carry
  analytics-level complexity despite living inside a Detail-Profile-adjacent
  route path — their true complexity matches Analytics/Reporting templates
  more than typical Detail Profiles, worth remembering when estimating work
  for "detail page" tasks that touch these two specifically.
- The XL tier (10 routes) is dominated by two categories that should be
  estimated differently even though they share a tier: governance dashboards
  (`/admin/system-health`, `/admin/production-readiness`) and Studio content
  editors (`/studio/students`, `/studio/why-robocode`, `/studio/learning-journey`).
  Governance XL complexity is inherent (many independent health checks);
  Studio XL complexity is largely repetitive CMS field editing. Treat Studio
  XL routes as lower actual implementation risk than their line count implies.

---

## 11. Dependency Graph

Structural dependencies that constrain sequencing (feeds directly into §9):

```
Wave 1 decisions (modal-vs-route, component consolidation, command palette)
        │
        ├──> Wave 2 (Attendance/Sessions/Groups/Calendar)
        │         │
        │         └──> Wave 3 (Finance/Payroll) — reuses Wave 2's
        │                     consolidated Student/Group components
        │
        ├──> Wave 4 (Growth/Learning Record/Analytics overlap resolution)
        │         — independent of Wave 2/3's entity consolidation,
        │           but still needs Wave 1's palette + governance-list
        │           work as a baseline
        │
        └──> Wave 5 (Governance/Studio/long tail)
                  — least coupled; could run in parallel with Wave 4
                    if resourcing allows, since neither depends on the other
```

**Cross-domain dependencies worth naming explicitly:**

- The **Group entity** is the single most cross-referenced entity in the
  product (Academics detail, Finance via `GroupFinanceSection`, Learning
  Record via portfolio/certificate eligibility, Operations Intelligence via
  `/admin/analytics`'s `listGroupPerformance`). Its component consolidation
  (Wave 1) has the highest fan-out of any single fix — prioritize it first
  within Wave 1 if the two Wave-1 items must be sequenced against each other.
- The **Student entity** is a close second, with the added twist of the
  Studio naming collision (§7.4/§13.2) — purely a documentation risk, not a
  code dependency, but worth resolving alongside Wave 1 so it doesn't
  resurface as confusion mid-consolidation.
- **`/dashboard/analytics/*`'s resolution (Wave 4) has no downstream
  dependents** — nothing in Waves 2-3-5 reads from or links to it in a way
  that would break if it's consolidated or redirected. Safe to defer without
  blocking anything else.

---

## 12. Design System Readiness

This section states what the *structural* inventory above implies is needed
from `DESIGN.md` and the component library — not what those tokens/components
should look like (out of scope here).

| Readiness signal | Status | Implication |
|---|---|---|
| Shared atomic primitives (`StatusBadge`) | Exists, proven cross-role | Baseline for D-02 compliance already established — extend the *pattern*, don't invent a new one |
| Shared table component contract (blueprint §9) | Partially implied by consistent Data Table/List behavior across ~55 routes, not independently verified in this pass | Needs a direct audit (not done in this document) to confirm one true shared `Table` component vs. per-domain reimplementations before Wave 2 begins |
| Shared form component contract (blueprint §8) | Undermined by §7.3's finding — modal-migrated entities and dedicated-route entities likely don't share one form component today | Direct blocker for Wave 1 item 1 — cannot be resolved until the modal-vs-route decision is made |
| Workspace pattern | Proven 3x (Groups, Instructors, Payroll) | Ready to reuse as-is for any future power-user surface — no design-system gap here |
| Notification/bell pattern | Proven for Team Leader only | Needs extension, not redesign — a rollout task, not a design task |
| Command palette | Does not exist | Full net-new build — the one area in this forecast requiring new design-system surface area, not just extension |
| Mobile card-list table pattern | Proven for Instructor group/session views | Needs an audit of remaining ~55 Data Table/List routes for coverage, not a new pattern |

**Overall readiness assessment:** The design system has *proven, reusable*
patterns for tables, workspaces, badges, notifications, and mobile tables —
the gap is **consistency of application**, not absence of the pattern. This
reframes the roadmap's real risk: not "we need to invent new UI," but "we
need to finish rolling out what's already proven in 1-3 places to the other
40+ places that should use it."

---

## 13. Implementation Risks

### 13.1 Blueprint Conformance Gaps (CURRENT vs. RECOMMENDED)

#### Gap #1 — Modal/Drawer CRUD vs. Dedicated-Route CRUD

**CURRENT STATE:** 11 routes are redirect shims because Create/Edit/View
was converted to a modal-or-drawer interaction on the list page (§7.4). This is
deliberate, shipped, in-production architecture — not a bug — confirmed via
explicit code comments at each shim.

**RECOMMENDED STATE (decision required, present both options):**

- *Option A — Amend the blueprint* to formally bless modal/drawer interaction
  for simple entities (matching blueprint §8.1's own "≤8 fields, one concern"
  single-page-form threshold), keeping dedicated routes only for genuinely
  complex, multi-section entities.
  - **Why current (unresolved ambiguity) is weaker:** Right now the same
    product has two competing CRUD philosophies live simultaneously with no
    stated rule for which applies when (§7.3 shows even one entity type split
    across both). This is confusing for any future contributor.
  - **Benefits:** Codifies what's already shipped and evidently works;
    modal/drawer is objectively faster to build and use for simple entities.
  - **Risks:** Weakens the blueprint's original "never a modal beyond 2-3
    fields" language (§7) — some of the migrated entities (e.g., Course) have
    more than 2-3 fields, so the threshold would need genuine redefinition,
    not just rubber-stamping.
  - **Migration cost:** Low — mostly a documentation change; a handful of
    entities may need to move *toward* modal for consistency, or the
    threshold redefined to already cover them.
  - **Priority:** High.
- *Option B — Migrate back to dedicated routes*, treating the modal shift as
  drift to be corrected.
  - **Why current is weaker:** Same ambiguity problem as Option A's framing.
  - **Benefits:** Restores full alignment with the blueprint's original CRUD
    philosophy (§7) without amending it; dedicated routes are more
    bookmarkable, more breadcrumb-friendly (§4.4), and easier to deep-link
    from search (§4.5) and notifications (§12).
  - **Risks:** Reverses already-shipped, presumably user-tested work; real
    engineering cost to rebuild ~11 routes' worth of Create/Edit surfaces.
  - **Migration cost:** Medium-High — this is real implementation work, not
    documentation.
  - **Priority:** High (the ambiguity itself, regardless of which option
    wins, is the urgent part).

**This document takes no position on which option is correct — flagging for
explicit team decision per blueprint §20 MUST #10, since it's a genuine
architectural-philosophy question, not a research gap.**

#### Gap #2 — Component Duplication Between Admin and Team-Leader Surfaces

**CURRENT STATE:** Admin and Team-Leader maintain separate composed
components for the same entity (confirmed for Group: `GroupDetailView` /
`GroupStudentsTable` / `AcademicConfigCard` / `GroupFinanceSection` vs.
`TLEnrollStudentsForm` / `TLAssignCourseForm`). Only the query layer and
`StatusBadge` are shared.

**RECOMMENDED STATE:** Consolidate into one shared, permission-gated component
tree per blueprint §6.1/D-02 — capability checks determine which fields/actions
render, not which component file is used.

- **Why current is weaker:** Directly violates D-02, the blueprint's own
  named "single biggest long-term maintenance risk in a 5-role product." A
  fix applied to `GroupDetailView` today has no guarantee of reaching
  `TLEnrollStudentsForm`'s equivalent logic.
- **Benefits:** Eliminates drift risk; halves the surface area for future
  Group-related feature work; matches the one proven precedent already in
  the codebase (`StatusBadge`, `.ds-card`).
- **Risks:** Non-trivial refactor while the product is live — must preserve
  exact current behavior per role during migration; risk of regression in a
  high-traffic entity (Group is the most cross-referenced entity per §11).
- **Migration cost:** High — this is the largest single engineering item in
  this entire roadmap, by component count (§8 forecast: ~20 consolidated
  components from ~40 existing forks, starting with Group and Student).
- **Priority:** High — named explicitly in Wave 1 (§9) because every later
  wave that touches Group or Student compounds the duplication if this isn't
  fixed first.

#### Gap #3 — `/dashboard/analytics/*` Superseded by Role-Specific Analytics

**CURRENT STATE:** `/dashboard/analytics` (+ `/courses`, `/groups`,
`/semester/[id]`) is a live, reachable surface for `super_admin`,
`team_leader`, and `instructor` roles. Confirmed via git history and source
comparison (§1.2 Finding 3) to be an earlier build, functionally superseded
by `/admin/analytics` (HQ) and `/portal/team-leader/analytics` (branch), with
no equivalent modern surface ever built for Instructor.

**RECOMMENDED STATE:** Consolidate or redirect, per the established
legacy-alias pattern (§7.4) rather than maintaining three analytics code
paths querying overlapping data.

- **Why current is weaker:** Three separate analytics implementations sharing
  copy-pasted helper functions is exactly the drift blueprint §1.4 warns
  against ("consistency compounds; novelty costs") — a fix to at-risk-student
  logic in one surface has no guarantee of reaching the other two.
- **Benefits:** Removes a stale surface Instructors currently land on with no
  modern equivalent; reduces three query-layer call sites down to two
  (HQ-scoped and branch-scoped), consistent with the rest of the product's
  role-scoping model (blueprint §6).
- **Risks:** Instructors currently using `/dashboard/analytics` lose that
  surface entirely unless a genuine Instructor-scoped analytics view is
  built as a replacement — this is a product-scope question (does an
  Instructor need an analytics surface at all, per their persona in
  blueprint §2.3?), not just a technical cleanup.
- **Migration cost:** Medium — redirect implementation is cheap (matches the
  existing shim pattern); the open question is whether Instructor-scoped
  analytics is a real product need requiring new work, or a role that should
  simply lose this surface.
- **Priority:** Medium — flagged in Wave 4 (§9), not Wave 1, since nothing
  else depends on this resolution (§11).

### 13.2 Recurring Governance Risks (not blueprint contradictions, but ungoverned patterns)

- **Legacy-alias redirects (5 pure renames + 1 role-restriction shim, §7.4)
  have no lifecycle policy.** They function correctly today but nothing
  tracks whether external links (old bookmarks, messages sent to
  parents/students before a rename, per the explicit comment found in
  `/portal/student/semesters/page.tsx`) still depend on them.
  - **Recommendation:** Add lightweight telemetry (a hit counter or log line)
    to each redirect shim rather than removing any of them (routes cannot be
    removed per this document's constraints regardless). Review hit counts
    periodically; a shim with zero hits over a defined window is a candidate
    for eventual removal in a future, separately-scoped cleanup.
  - **Priority:** Low, long-term.
- **Studio `students` naming collision (§1.2 Finding 6).** `/studio/(dashboard)/students`
  (a marketing-showcase CMS entity) and the LMS `Student` entity (an enrolled
  learner, present across 6+ domains) share an identical name despite being
  conceptually unrelated.
  - **Recommendation:** Document the distinction explicitly (e.g., in
    `AGENTS.md`/`CLAUDE.md` or a code comment at the Studio route) so a
    future contributor — human or AI — searching the codebase for "Student"
    doesn't conflate the two. Renaming the route is out of scope for this
    document (routes are not renamed), so this is a documentation-only fix.
  - **Priority:** Low.

---

## 14. Optimization Opportunities

Opportunities that don't rise to "conformance gap" severity but would reduce
future cost:

| Opportunity | Basis | Estimated benefit |
|---|---|---|
| Extract one shared `EntityForm` contract before Wave 1's modal-vs-route decision lands | §7.3's inconsistency finding shows form logic is already fragmented regardless of the modal/route question | Whichever CRUD philosophy wins (Gap #1), a shared form contract reduces the migration cost of implementing it |
| Standardize the redirect-shim's query-string-forwarding pattern (already correct in confirmed examples, §7.1) into a shared helper | Currently reimplemented per shim (visible boilerplate duplication in `/admin/expenses` and `/portal/team-leader/instructor-payroll`) | Small, cheap win — a few lines saved × 16 shims, plus consistency |
| Audit whether `/admin/team-leaders/[id]/performance` and `/portal/team-leader/instructor-performance` (§10.3) could share an Analytics/Reporting component, since they evaluate the same underlying concept (a person's performance) from two role perspectives | Both are L-tier, both are Analytics/Reporting despite living under different domains structurally | Could fold into the Gap #2 consolidation effort rather than treated as separate work |
| Confirm (not assumed) whether the ~55 Data Table/List routes actually share one `Table` component (§12) before Wave 2 | Table behavior appears consistent by observation, but this document did not do a component-source diff for every table | Cheap to verify, prevents Wave 2 from assuming consolidation work that doesn't actually exist |

---

## 15. Final Implementation Strategy

### 15.1 Summary sequencing (restates §9 as a checklist)

1. Decide modal-vs-route CRUD philosophy (Gap #1) — **blocking decision,
   not implementation.**
2. Begin Group + Student component consolidation (Gap #2) — **highest
   fan-out, start first within Wave 1.**
3. Build the command palette (D-07).
4. Document the legacy-redirect governance list (§13.2) and add hit-count
   telemetry.
5. Execute Wave 2 (Attendance/Sessions/Groups/Calendar) once steps 1-2 are
   far enough along that Wave 2 doesn't re-fork what Wave 1 just
   consolidated.
6. Execute Wave 3 (Finance/Payroll), reusing Wave 2's consolidated entities.
7. Resolve the `/dashboard/analytics` question (Gap #3) as part of Wave 4,
   alongside Growth/Learning Record work.
8. Execute Wave 5 (Governance/Studio/long tail), including the naming-
   collision documentation fix.

### 15.2 What "done" looks like for this roadmap

- Every route in §2 has moved from its current template/state to a
  blueprint-conformant one, or has an explicitly logged, team-approved
  exception in blueprint §19 (per the blueprint's own MUST NEVER #9 — no
  quiet routing-around).
- Gaps #1-#3 (§13.1) each have a recorded decision (not necessarily this
  document's recommended option — the team's actual choice), logged as a
  new blueprint §19 entry if it changes or clarifies an existing rule.
- The component forecast in §8 has shrunk to zero net-new consolidation
  work — i.e., §7.2's duplication finding no longer applies to any entity.
- No route remains in the "Flagged — Legacy/Superseded" state shown for
  `/dashboard/analytics/*` in §2.6.

### 15.3 Explicit non-goals of this roadmap

Per this document's scope boundary: no wave in §9 includes choosing colors,
typography, component visual styling, or spacing. Any visual-design work
implied by consolidating components (Gap #2) or building the command palette
belongs to `DESIGN.md` and is out of scope here — this roadmap only
establishes *that* consolidation must happen and *in what order*, not *what
it should look like*.

---

## 16. Self-Review Checklist (against original task constraints)

- [x] Every one of the 181 existing routes classified by domain (§2),
  template (§3), and complexity (§10) — verified via a fresh `find` +
  line-count pass against the live `app/` tree, not recalled from memory.
- [x] No existing route renamed or moved — every route path in §2 matches
  the actual file path.
- [x] All 9 layout files documented (§4), including the one layout-level
  structural finding (`/dashboard` layout's role list).
- [x] All 10 business domains mapped, plus the Landing Dashboards cross-domain
  group and one taxonomy-correction item (§2.11/§5.3), with route counts
  reconciled against the 181 total (§2, route count check).
- [x] No UI, colors, typography, or component styling specified anywhere in
  this document — every template/pattern reference is structural/behavioral.
- [x] Every critique (Gaps #1-#3, §13.1) is presented as CURRENT STATE vs.
  RECOMMENDED STATE, each with rationale, benefits, risks, migration cost,
  and priority (High/Medium/Low) — no critique was silently resolved as fact
  where the underlying question was genuinely a team decision (Gap #1 in
  particular takes no position between its two options).
- [x] The previously-open `/dashboard/analytics` vs. `/admin/analytics`
  question is resolved with evidence (git history + source comparison, not
  guessed) and the finding is carried through consistently across §1.2, §2.6,
  §4, and §13.1 — not left ambiguous.
- [x] Roadmap is implementation-ready: §9's waves each name concrete routes/
  entities, §11's dependency graph states real blocking relationships, and
  §15.1 gives an ordered checklist a team could start executing directly.
