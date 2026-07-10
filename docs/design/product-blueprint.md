# Robocode LMS — Product UX Blueprint

**Status:** Constitution. This document is the permanent UX and product-architecture
reference for Robocode LMS. It does not describe visual design (see `DESIGN.md` for
color/typography/component tokens) — it describes *how the product is structured,
how users navigate it, and how every screen must behave* so that 148+ routes feel
like one coherent product instead of 148 independent ones.

**Scope boundary:** This document governs UX architecture — information architecture,
navigation, interaction patterns, CRUD/form/table standards, states, and permission
philosophy. It does not specify colors, layouts, component code, or pixel values.
When this document and a screen disagree, this document wins unless it is formally
amended (see §19, Design Decision Log).

**Source of truth for routes:** The route inventory below reflects the actual `app/`
directory as of 2026-07-10 (181 page routes). Existing routes are not renamed or
moved by this document. Where a UX issue is identified, it is called out explicitly
with a rationale rather than silently "fixed."

---

## 1. Product Vision

### 1.1 What Robocode LMS is

Robocode LMS is the operating system for a physical robotics-education academy
network. It is not a generic school-management SaaS retrofitted for robotics — it
is purpose-built around the actual operating unit of the business: a **group** of
students, meeting in **sessions**, taught by an **instructor**, inside a **branch**,
under a **team leader's** operational ownership, funded by a **student enrollment
contract**, reported up to **HQ administrators**.

Every module in the product (attendance, payroll, certificates, portfolio, finance)
is a derivative of that core loop. The product's job is to make that loop fast to
operate at branch level and fully visible at HQ level.

### 1.2 Product goals

1. **Operational speed at the edge.** A team leader or instructor standing in a
   classroom should be able to record attendance, log a note, or resolve a
   scheduling conflict in under 30 seconds, on a phone, with poor Wi-Fi.
2. **Financial and academic truth at the center.** HQ must always be able to
   answer "how many sessions does this student have left," "is this branch
   profitable," and "did this instructor get paid correctly" — without a
   spreadsheet reconciliation.
3. **One interface, every role.** The same screens serve five roles at five
   permission levels. No role gets a bespoke rebuild; every role gets a
   permission-scoped view of the same architecture (see §6).
4. **Compounding trust.** Parents and students are direct product users, not an
   afterthought. Their portals must be as polished as the admin surfaces — trust
   with a paying parent is a growth channel, not a support cost center.
5. **A platform that survives 5 years of feature growth without a rewrite.** Every
   pattern in this document exists to make route #200 as consistent, and as cheap
   to build, as route #20 was.

### 1.3 Target users

Five roles, one product (see §2 for full personas):

| Role | Relationship to the business | Primary device |
|---|---|---|
| Administrator | HQ — owns the whole network | Desktop |
| Team Leader | Owns one or more branches operationally | Desktop + tablet |
| Instructor | Delivers sessions, front-line with students | Phone + tablet |
| Parent | Pays for and monitors their child's enrollment | Phone |
| Student | Learns, builds a portfolio, earns recognition | Phone + shared classroom device |

### 1.4 Product philosophy

- **The record is the source of truth, not the memory of the person entering it.**
  Every operational event (attendance, payment, enrollment change) is a ledger
  entry (§10, Ownership Model). The UI's job is to make entering that record
  effortless and to never let a screen show a number that contradicts the ledger.
- **Groups are delivery, enrollments are contracts.** This is the single most
  important domain rule in the product (see `supabase/ARCHITECTURE_RULES.md` §10)
  and it must be visible in the UX: moving a student between groups is a
  *scheduling* action, not a *financial* one. Screens that conflate the two
  (e.g., letting someone "delete" a student from a group and implying their
  paid sessions vanish) are a UX bug, not a feature.
- **Every screen assumes low context.** A team leader might open a student's
  detail page once a month. The screen must re-establish full context (who is
  this, what's their status, what needs attention) in under 2 seconds of reading
  — never rely on the user remembering where they left off.
- **Progressive disclosure over feature density.** The temptation in an LMS is to
  put everything on one screen because "admins need it all." Resist this. Default
  views show what 80% of visits need; the rest is one click away (§5).
- **Consistency compounds; novelty costs.** A new screen that reuses an existing
  pattern ships faster, is instantly familiar to users, and is cheaper to
  maintain. A new pattern must justify its cost against this baseline every time
  (§19).

### 1.5 Success metrics

Product-level (not engineering-level) signals that this UX architecture is working:

| Metric | What it proves |
|---|---|
| Time-to-record-attendance (instructor, mobile) | Front-line speed goal is met |
| % of team-leader tasks completed without contacting HQ | Operational autonomy at the branch |
| Parent portal weekly active rate | Trust/engagement, not just login-and-leave |
| Support tickets tagged "couldn't find X" | Navigation and IA are working |
| Time for a new engineer to ship a compliant CRUD screen | This document is actually being followed |
| # of one-off UI patterns introduced per quarter | Drift is being caught, not accumulating |

---

## 2. User Personas

Every persona below is defined by **goals** (what success looks like for them),
**needs** (what the product must supply), **daily workflow** (the loop they run),
**pain points** (what currently or typically breaks), and **permissions**
(what they can see/do — full detail in §6).

### 2.1 Administrator (HQ)

- **Who:** Network-level owner/operator. Works across all branches. Includes
  finance, ops, and executive sub-functions today served by one role.
- **Goals:** Network health at a glance; catch problems before they become
  incidents (financial drift, attendance integrity, payroll errors); make
  cross-branch comparisons; keep the system itself healthy (`/admin/system-health`,
  `/admin/system-events`, `/admin/production-readiness`, `/admin/recovery`).
- **Needs:** Aggregation across branches; drill-down from network number to the
  single row that caused it; audit trails; the ability to act on behalf of a
  branch when something is stuck.
- **Daily workflow:** Start at `/admin/executive` or `/admin/analytics` →
  scan KPIs and alerts → drill into whichever branch/entity is flagged →
  resolve or delegate → periodically sweep `/admin/finance/queue`,
  `/admin/leads/funnel`, `/admin/recovery`.
- **Pain points to design against:** Cross-branch data that doesn't roll up
  consistently; being forced to open 5 tabs to reconcile one discrepancy;
  not knowing whether a metric is "as of now" or stale (§14).
- **Permissions:** Full read/write across all branches and all modules,
  including modules no other role sees (`system-health`, `system-events`,
  `recovery`, `production-readiness`, `communications`, `staff`).

### 2.2 Team Leader (Branch Operator)

- **Who:** Runs one or more branches day-to-day. The heaviest, most
  route-dense role in the product (`/portal/team-leader/*` is ~45 routes) —
  because they own the entire operational loop for their branch(es).
- **Goals:** Keep groups full and running on schedule; keep instructors paid
  correctly and on time; keep parents happy and paying; convert leads;
  keep their own branch numbers healthy against HQ's expectations.
- **Needs:** A single operational surface per entity type (groups,
  instructors, students, parents, leads) with the same list → detail →
  action pattern every time; fast paths for the things that happen constantly
  (record attendance, create a session, move a lead); visibility into
  finance without needing HQ's full financial tooling.
- **Daily workflow:** Dashboard → today's sessions/calendar → attendance/
  assignments follow-ups → leads pipeline → periodic sweeps of
  instructor-payroll, parent-feedback, and collections.
- **Pain points to design against:** Context-switching cost between
  "workspace" tools (groups/workspace, instructors/workspace,
  payroll/workspace — multi-panel power-user surfaces) and simple list
  pages; needing to remember which of several similarly-named finance
  routes (`finance`, `finance/new`, `collections`, `instructor-payroll`,
  `payroll`) does what.
- **Permissions:** Full read/write scoped to their assigned branch(es) only.
  Cannot see other branches' data. Cannot access HQ-only modules (system
  health, recovery, staff).

### 2.3 Instructor

- **Who:** Delivers sessions in the classroom. Mobile-first by necessity —
  they are standing, not sitting at a desk, when they use this product most.
- **Goals:** Know today's schedule without hunting; record attendance and
  homework grades fast; get paid correctly and see why; build/attach to
  student portfolios during or right after class.
- **Needs:** A "what do I do right now" surface (calendar, groups, today's
  sessions); minimal-tap attendance and grading flows; a clear, trustworthy
  payments view (instructors escalate fast when pay looks wrong).
- **Daily workflow:** Open calendar or group list → walk into a session →
  record attendance → assign/grade homework → occasionally log a special
  session (makeup) → check payments after a pay period closes.
- **Pain points to design against:** Any flow that requires typing on a
  phone during a live class; unclear distinction between a regular
  session and a special/makeup session; not knowing if a submitted
  attendance record actually saved before walking away.
- **Permissions:** Read/write scoped to their own assigned groups/sessions
  only. Read-only on their own payment history. No visibility into other
  instructors' pay, other groups, or any finance/lead/branch-management data.

### 2.4 Parent

- **Who:** Pays for the enrollment, is not present in the classroom, wants
  proof that the money and time are working.
- **Goals:** Confidence that their child is progressing; transparency on
  what's been paid and what's owed; easy access to certificates/portfolio to
  show off; a channel to raise a concern.
- **Needs:** A calm, non-technical view of academic and financial status;
  no exposure to internal operational complexity (group IDs, enrollment
  contracts, ledger mechanics) — only the outcomes that matter to them.
- **Daily workflow (weekly-ish, not daily):** Check attendance/progress
  after a session → check finance balance around billing time → download a
  certificate or browse portfolio when there's something to show → submit
  feedback occasionally.
- **Pain points to design against:** Financial jargon (contracts, FIFO
  consumption, ledgers) leaking into their UI; not knowing if a missed
  session was excused or affects their balance; a portal that feels like
  the internal admin tool with fields hidden rather than a purpose-built
  parent experience.
- **Permissions:** Read-only, scoped strictly to their own child(ren).
  Write access limited to feedback submission and self-service account
  actions (password).

### 2.5 Student

- **Who:** The learner. Often a child using a shared or parent-supervised
  device. Motivation and pride matter as much as information.
- **Goals:** See their own progress, badges, and leaderboard standing; be
  proud of their portfolio; know what homework is due; feel recognized.
- **Needs:** Simple, encouraging, low-friction screens; gamified feedback
  (leaderboard, badges — see Phase XXXIII gamification system) that's
  visible without digging; zero financial or administrative clutter.
- **Daily workflow:** Check assignments → check leaderboard/portfolio →
  watch videos → view certificates when earned.
- **Pain points to design against:** Any surface that exposes finance,
  other students' private data, or instructor/admin-level complexity;
  discouraging empty states (a leaderboard or portfolio that looks broken
  when simply new).
- **Permissions:** Read/write scoped strictly to their own record.
  Assignment submission is the primary write action. No visibility into
  siblings, other students, or any financial/operational data.

### 2.6 A note on the "Studio" surface

`/studio/*` (marketing CMS: blog, homepage, gallery, partners, reviews, etc.)
is operated by marketing/content staff, not by the five academy-facing
personas above. It is included in the IA (§3) for completeness because it
shares the platform's auth and design system, but it is a **separate product
surface** with its own login (`/studio/login`) and its own content-management
permission model — not a sixth academy persona. Future work should not blend
Studio's content-editing UX patterns with the academy admin/portal patterns.

---

## 3. Information Architecture

The IA is organized around **business domains**, not the folder structure of
`app/`. Route folders (`/admin/*`, `/portal/team-leader/*`, etc.) express
*who has access* — a permission boundary. The table below expresses *what the
system does* — a business-domain boundary. Both axes matter; conflating them
is a common IA mistake (a "Finance" nav item should mean the same business
domain whether an Administrator or a Team Leader opens it, even though the
underlying route and the data scope differ).

### 3.1 The ten business domains

| # | Domain | What it owns | Representative routes |
|---|---|---|---|
| 1 | **People** | Every human record: students, parents, instructors, team leaders, HQ staff | `/admin/students`, `/admin/parents`, `/admin/instructors`, `/admin/team-leaders`, `/admin/staff`, `/portal/team-leader/students`, `/portal/team-leader/parents`, `/portal/team-leader/instructors`, `/portal/instructor/students/search` |
| 2 | **Academics** | Courses, curriculum, semesters/academic years, groups, sessions (regular + special/makeup), attendance, assignments/homework | `/admin/courses`, `/admin/semesters`, `/admin/groups`, `/admin/sessions`, `/admin/special-sessions`, `/admin/attendance`, `/admin/assignments`, `/portal/team-leader/groups`, `/portal/team-leader/calendar`, `/portal/instructor/groups`, `/portal/instructor/homework`, `/portal/student/assignments`, `/portal/parent/attendance` |
| 3 | **Learning Record** | The proof-of-learning artifacts: portfolio, certificates, gamification (leaderboard/badges/XP), videos, progress | `/admin/portfolio`, `/admin/certificates`, `/portal/student/portfolio`, `/portal/student/leaderboard`, `/portal/student/certificates`, `/portal/student/videos`, `/portal/parent/portfolio`, `/portal/parent/progress`, `/portal/instructor/portfolio` |
| 4 | **Finance** | Enrollment contracts, payments, expenses, revenue, payroll (instructor + collections) | `/admin/finance`, `/admin/finance-center`, `/admin/expenses`, `/admin/revenue`, `/admin/payroll`, `/portal/team-leader/finance`, `/portal/team-leader/collections`, `/portal/team-leader/payroll`, `/portal/team-leader/instructor-payroll`, `/portal/instructor/payments`, `/portal/parent/finance` |
| 5 | **Growth (CRM)** | Leads, funnel, conversion, parent sentiment | `/admin/leads`, `/admin/leads/funnel`, `/portal/team-leader/leads`, `/portal/team-leader/parent-feedback`, `/portal/team-leader/parent-satisfaction`, `/portal/parent/feedback`, `/book-session` |
| 6 | **Operations Intelligence** | Cross-cutting analytics, branch performance, executive reporting | `/admin/analytics`, `/admin/executive`, `/admin/branches`, `/admin/branches/[id]/performance`, `/dashboard/analytics/*`, `/portal/team-leader/analytics`, `/portal/team-leader/instructor-performance` |
| 7 | **Platform Governance** | System health, integrity, recovery tooling, internal comms — HQ-only, not a "business" domain but a required operating layer | `/admin/system-health`, `/admin/system-events`, `/admin/production-readiness`, `/admin/recovery`, `/admin/communications` |
| 8 | **Marketing Content (Studio)** | The public site's editorial content — separate surface, see §2.6 | `/studio/(dashboard)/*` (blog, homepage, gallery, faq, partners, projects, reviews, site-media, branches, students, why-robocode, accreditations, bookings, learning-journey) |
| 9 | **Identity & Access** | Authentication, workspace selection, account self-service | `/login`, `/forgot-password`, `/reset-password`, `/select-workspace`, `/account/password`, `/auth/callback`, `/studio/login`, `/verify/[code]` |
| 10 | **Public Marketing Site** | The unauthenticated storefront | `/`, `/blog`, `/blog/[slug]`, `/book-session` |

### 3.2 How a role's navigation maps to domains

No role sees all ten domains. §4 defines the nav; the mapping is:

| Domain | Admin | Team Leader | Instructor | Parent | Student |
|---|---|---|---|---|---|
| People | ✅ full | ✅ branch-scoped | ➖ own students only (search) | ➖ own child only | — |
| Academics | ✅ full | ✅ branch-scoped | ✅ own groups/sessions | 👁 own child, read-only | 👁 own record |
| Learning Record | ✅ full | ✅ branch-scoped | ✅ own groups | 👁 own child | ✅ own record, primary surface |
| Finance | ✅ full | ✅ branch-scoped (no cross-branch) | 👁 own pay only | 👁 own balance only | — |
| Growth (CRM) | ✅ full | ✅ branch-scoped | — | ➖ feedback only | — |
| Operations Intelligence | ✅ full | ✅ branch-scoped subset | ➖ own performance only | — | — |
| Platform Governance | ✅ full | — | — | — | — |
| Marketing Content | separate surface (§2.6) | — | — | — | — |
| Identity & Access | ✅ | ✅ | ✅ | ✅ | ✅ |
| Public Marketing Site | n/a (unauthenticated) | n/a | n/a | n/a | n/a |

`✅` = full domain access (scoped by tenancy) · `👁` = read-only, self/child-scoped ·
`➖` = narrow slice only, not the full domain · `—` = not exposed.

### 3.3 IA rule going forward

New routes are placed by asking **"what business domain does this belong to,"
not "which role asked for it."** A new Team Leader feature about, say, waitlist
management belongs in Academics (it's a scheduling concept), not in a
Team-Leader-only namespace conceptually — even though its route will live under
`/portal/team-leader/` for permission reasons. This keeps the ten domains stable
as the permission surface (roles, routes) grows.

---

## 4. Navigation Strategy

### 4.1 Primary navigation

One left sidebar per authenticated surface (`/admin`, `/portal/team-leader`,
`/portal/instructor`, `/portal/parent`, `/portal/student`), built from the
role's domain subset in §3.2, in this fixed order: **Home/Dashboard →
Academics → People → Learning Record → Finance → Growth → Intelligence →
Governance (Admin only) → Settings/Account.** This order is fixed across all
five roles so muscle memory transfers: a team leader who gets promoted, or an
admin who impersonates a branch view, sees the same shelf order, just with
fewer or more items on it.

Mobile-first roles (Instructor, Parent, Student) collapse this into a bottom
tab bar of the **4–5 highest-frequency items only** (per the mobile UX
pattern already established for Team Leader — see `project-mobile-ux-sprint`
memory: bottom nav + "More" sheet for the long tail). Never put more than 5
items in a bottom bar; everything else goes behind "More."

### 4.2 Secondary navigation

Within a domain that has multiple entities (e.g., Academics has Courses,
Semesters, Groups, Sessions, Attendance, Assignments), secondary navigation
is a **horizontal tab or sub-nav row directly under the page header**, not a
nested sidebar flyout. Nested sidebars hide state and cost a click to
discover; a visible tab row shows the user the full shape of the domain at
a glance.

### 4.3 Context navigation

Once inside a specific entity (a Group, a Student, an Instructor), navigation
becomes **tabs within the detail page** (see §10, Detail Page Standards) —
Overview, related records, history — never a second sidebar. Context nav
answers "what else is true about *this one thing*," which is a fundamentally
different question from primary/secondary nav ("what part of the system am I
in"), and must look visually distinct (tabs, not a nav rail) so users never
confuse the two.

### 4.4 Breadcrumb rules

Breadcrumbs are required on every page nested more than one level deep from
its domain root (i.e., any detail, edit, or nested-create page). Format:

```
{Domain} / {Entity list} / {Entity name or "New"} / {sub-resource if any}
Example: Academics / Groups / Alpha Squad — Spring 2026 / Sessions / New
```

Rules:
- The entity name (not its ID) is always shown once data has loaded; show a
  skeleton in its place while loading, never the raw UUID.
- Every crumb except the last is a link back to that list/detail page.
- Breadcrumbs are supplementary to, not a replacement for, the "Back" affordance
  users expect from a detail header (§10).
- List pages (e.g., `/admin/groups`) do not need a breadcrumb — the primary
  nav already shows where they are.

### 4.5 Search strategy

A network-wide search endpoint already exists (`/api/search`). It must power
one global search entry point per authenticated surface (keyboard shortcut
`/` or `Cmd/Ctrl+K`), scoped server-side to the user's tenancy (a team leader's
search never returns another branch's student). Search results are grouped
by entity type (Students, Groups, Instructors, Parents, Leads...) with the
matched field shown as a subtitle, and each result deep-links straight to
the detail page — never to a filtered list. In-page list filtering (§9) is a
separate, local concern and should not be conflated with global search.

### 4.6 Quick actions

Every list page's header carries at most one primary quick action (almost
always "+ New {Entity}" for roles with create permission — see §7). Anything
beyond that single primary action goes into a "..." overflow menu on the
header, not a row of equally-weighted buttons. This is a hard constraint:
**one visually primary action per page, always.**

Detail pages follow the same rule for their header actions (§10).

### 4.7 Command palette

**Not yet implemented; recommended as the next navigation investment**, not
retrofitted piecemeal. Once global search (§4.5) is live and stable, extend
it into a command palette (`Cmd/Ctrl+K`) that unifies: (a) navigate-to-entity
(same as search), (b) navigate-to-page (jump to any nav destination by name,
useful given the route count), and (c) a short list of role-appropriate quick
actions ("New Student," "Record Attendance"). Do not build three separate
overlays for these three jobs — one palette, three result sections. Logged
as an open decision in §19 (D-07).

---

## 5. UX Principles

These are permanent. Every future screen is checked against this list before
it ships.

1. **Consistency over local optimization.** A screen that's 5% more "elegant"
   by breaking an established pattern (a bespoke table, a one-off dialog
   style) costs more in user confusion and maintenance than it gains. Reuse
   wins ties.
2. **Speed for the front line, completeness for HQ.** Instructor and
   Team-Leader-in-the-moment flows (attendance, session creation) are
   optimized for taps and seconds. Admin/HQ analytical flows are optimized
   for completeness and drill-down depth. Don't apply one standard to both.
3. **Clarity over density.** If a screen needs a legend to explain itself,
   it's too dense. Prefer fewer, well-labeled data points over cramming
   every available field onto one view.
4. **Minimal clicks, but never at the cost of a confirmable action.**
   Reduce steps for reversible, low-stakes actions (filtering, viewing).
   Never reduce steps for irreversible or financially consequential ones
   (§15, error prevention) — an extra click before deleting an enrollment
   is a feature, not friction.
5. **Progressive disclosure.** Default views show the 80% case. Advanced
   filters, bulk actions, and secondary metadata are one interaction away,
   not gone — but not loaded by default either.
6. **Recognition over recall.** Users should never need to remember an ID,
   a status code, or which of five similarly named pages does what. Labels,
   breadcrumbs, and status badges (§12) exist to make every screen
   self-explanatory on sight.
7. **Accessibility is not optional polish.** Every interactive element is
   keyboard-reachable, every status has text (not just color), every image
   has alt text, every form error is announced. See §17.
8. **Mobile-first for front-line roles, desktop-first for analytical roles.**
   Instructor/Parent/Student experiences are designed at mobile width first
   and scaled up. Admin/Team-Leader analytical and bulk-management surfaces
   (tables, workspaces) are designed at desktop width first and gracefully
   degraded down (§16).
9. **Error prevention over error recovery.** Validate inline, confirm
   destructive actions, disable impossible states — don't rely on a good
   error message to clean up a preventable mistake.
10. **The system never lies about its own state.** Loading, stale, and
    error states are always visually distinct from "loaded and current"
    (§13, §14, §15). A dashboard number with no timestamp and no loading
    state is a trust bug.

---

## 6. Permission Philosophy

**One interface. Different permissions. Different available actions.**

This is the single hardest rule to hold the line on, and the most valuable.
Robocode LMS does not build a separate "Student view" React tree and a
separate "Admin view" React tree of the same conceptual page — it builds one
page whose available actions, visible fields, and data scope are computed
from the viewer's role and tenancy.

### 6.1 Principles

1. **Permission is a data-scoping and action-gating problem, not a
   layout-forking problem.** The same "Group Detail" page structure (§10)
   serves an Administrator (sees all groups, can edit/delete), a Team Leader
   (sees their branch's groups, can edit, cannot delete a group with
   history), and an Instructor (sees only their assigned group, read-only
   except attendance/homework). The header, tab structure, and card layout
   are identical. What differs is: which rows are queryable at all (server-
   side tenancy scoping — never a client-side filter of a full dataset),
   which action buttons render, and which fields are editable vs.
   read-only-display.
2. **Never duplicate a screen to remove a permission.** If a field or action
   must be hidden from a role, hide it via a capability check in the shared
   component, not by forking a `GroupDetailForAdmin.tsx` /
   `GroupDetailForTeamLeader.tsx` pair. Duplication is how five-role products
   rot: the two copies drift, and a fix applied to one is silently missing
   from the other.
3. **Absence of permission is invisible, not disabled-and-explained**, for
   entire domains (a Student never sees a "Finance" nav item, greyed out,
   with a tooltip explaining they can't access it — it simply isn't in
   their nav, per §3.2). For actions *within* a domain the user does
   partially have access to, the opposite applies: show the action
   disabled with a one-line reason (e.g., a Team Leader hovering "Delete
   Group" on a group with attendance history sees why it's blocked) —
   because in that context, the user has a right to understand the system's
   rule, not just be denied.
4. **Tenancy scoping happens server-side, always.** A Team Leader's queries
   are branch-filtered at the data layer, not by hiding rows in a client
   that already received the full dataset. This is a security requirement,
   not just a UX one — restated here because it shapes the UX contract: the
   UI can trust that anything it received, the viewer is allowed to see.
5. **Role-appropriate defaults, not role-appropriate features.** Dashboards
   (§11) differ by role in *which widgets appear and what data they're
   scoped to*, not in *what a widget fundamentally is*. A KPI card looks and
   behaves the same whether it's showing an Administrator a network number
   or a Team Leader a branch number.

### 6.2 Permission matrix (domain-level; see §3.2 for the full table)

The canonical statement of who-sees-what lives in §3.2. This section states
the *mechanism*; §3.2 states the *result*.

---

## 7. CRUD Philosophy

Every entity in the system (Student, Group, Course, Certificate, Lead, Expense...)
implements the same lifecycle vocabulary. A developer or an AI agent building
entity #40 should not have to invent CRUD behavior — it's specified here once.

| Operation | Standard behavior |
|---|---|
| **List** | Paginated table (§9) at the domain's root route (e.g., `/admin/students`). Server-side filtered to the viewer's tenancy. Default sort: most-recently-active first, unless the entity has an obvious natural order (e.g., Sessions sort by date ascending from "today"). |
| **Create** | A dedicated `/new` route (never a modal for anything beyond a 2–3 field entity). Multi-step if the entity has >8 required fields or spans distinct concerns (e.g., Student creation touching both academic and guardian/finance data) — see §8. |
| **View** | The detail page at `/{entity}/[id]` (§10). Default landing surface for every entity; "View" is never a modal for anything with more than 3 fields worth of context. |
| **Edit** | In-place edit on the detail page for simple entities (inline field editing with autosave, §8.4) or a dedicated `/edit` route for entities with complex, multi-section forms (mirrors Create's structure). Never a second, differently-laid-out form from Create — Edit reuses Create's form component, pre-filled. |
| **Delete** | Soft delete only (`deleted_at`, per `ARCHITECTURE_RULES.md` §4) for every entity with any operational or financial history. Always behind a confirmation dialog that states the consequence in plain language (§8.5, §15). Hard delete is never exposed in the UI. |
| **Archive** | For entities with a natural "no longer active but keep for record" state (Groups, Courses, Leads) distinct from delete — Archive removes the entity from active lists/dashboards without implying removal or data loss. Archived entities remain reachable via a filter toggle on the list page, never vanish. |
| **Restore** | Every Delete and Archive action has a symmetric Restore, reachable from a "Show archived/deleted" list filter. Restore is never a support-ticket-only operation once the entity type supports it in the UI. |
| **Duplicate** | Offered only where it saves real re-entry work (e.g., duplicating a Group's schedule for a new semester, duplicating a Certificate Template). Duplicate opens a pre-filled Create form — it never silently creates a second live record without user review. |
| **Export** | CSV/PDF export available on any list page that HQ or Team-Leader roles use for reporting (Finance, Attendance, Payroll, Analytics). Export always respects the current list's active filters — "export what I'm looking at," not "export everything." |
| **Import** | Reserved for genuinely bulk-entry workflows (e.g., initial student roster upload). Always: preview-before-commit, row-level validation feedback, and a dry-run option. Import is the highest-risk CRUD operation in the system and is held to the strictest error-prevention standard (§15). |
| **Bulk actions** | Enabled via row selection (§9) only for actions that are safe at scale (bulk status change, bulk export, bulk certificate generation — see the existing Bulk Certificate Generation pattern). Bulk delete is never offered for entities with financial/attendance history; bulk archive is offered instead. |

### 7.1 The consistency test

Before shipping a new entity's CRUD surface, verify: does its List, Create,
View, Edit, and Delete behave exactly as described above, using the shared
table/form/dialog primitives (§9, §8), with no bespoke pattern invented for
"this one entity is special"? If the entity genuinely needs a deviation,
document why in §19 rather than silently diverging.

---

## 8. Form Standards

### 8.1 Single-page forms

Default for any entity with ≤8 fields or one logical concern (e.g., a Lead,
a Certificate Template, an Expense line item). All fields visible at once,
grouped under clear section labels if there are more than ~5 fields.

### 8.2 Multi-step forms

Required when a Create flow spans genuinely distinct concerns that benefit
from being reasoned about separately — e.g., Student creation (identity →
guardian/contact → enrollment/finance), Bulk Certificate Generation (mode
selection → recipient selection → template/content → review), Special
Session creation (type → schedule → participants). Rules:

- Steps are shown as a numbered progress indicator, always visible, always
  clickable to jump backward (never forward past unvalidated steps).
- Each step validates before advancing; the user is never allowed to reach
  a later step with an earlier step in an invalid state.
- The final step is always a **review step** that summarizes every prior
  step's input before commit — no multi-step form submits directly from
  its last data-entry step.
- Step state persists in memory across back/forward navigation within the
  flow (never re-blank a field the user already filled when they go back
  to check something).

### 8.3 Validation

- **Inline, on blur, not on submit-only.** A required field left empty
  shows its error the moment the user leaves it, not after they've filled
  the whole form and hit submit.
- Error copy states the fix, not just the problem ("Enter a date after the
  semester start date," not "Invalid date").
- Submit is disabled while the form is in a known-invalid state for
  required fields, but never disabled silently — if disabled, a visible
  reason is shown near the submit button.
- Server-side validation errors (e.g., a uniqueness conflict only the
  database can catch) map back to the specific field, not just a generic
  banner, whenever the field is identifiable.

### 8.4 Autosave

Reserved for long-lived, low-stakes editing contexts: portfolio notes,
draft assignments, in-progress multi-step forms (step-local state). **Not**
used for financial or enrollment-contract mutations, attendance records, or
anything that maps to a ledger write (§10, ownership model) — those are
always explicit, confirmed submissions. Where autosave is used, show a
persistent, small "Saved" / "Saving…" indicator near the field — never leave
the user to wonder if their edit persisted.

### 8.5 Confirmation dialogs

Required for: Delete, Archive-with-cascading-effect, any action that changes
a financial ledger, any action that changes another user's access. Confirmation
copy always names the specific entity ("Delete Alpha Squad — Spring 2026?"
never "Are you sure?") and states the consequence in one sentence. Destructive
confirmations use a danger-styled primary action and require the user to
click, never just press Enter, to reduce accidental double-confirmation.

### 8.6 Error handling

Form-level submission failures (network, server error) show a banner at the
top of the form that preserves all entered data — a failed submit never
clears the form. See §15 for the universal error strategy this inherits from.

### 8.7 Required vs. optional fields

Mark **optional** fields explicitly (`(optional)` label suffix), not required
ones with an asterisk that the user has to learn the meaning of. In a system
with five roles and varying data-entry contexts (an Instructor filling a
Special Session request on a phone vs. an Admin filling a Course form on
desktop), explicit optional-labeling reads faster under time pressure.

### 8.8 Keyboard navigation

Tab order follows visual/reading order. Enter submits single-step forms from
any text field (except multi-line text areas). Escape closes any dialog or
step-form without submitting, always with an unsaved-changes confirmation if
data was entered. Every custom input (date pickers, selects, multi-step
progress) is fully operable without a mouse.

---

## 9. Table Standards

Tables are the single most-used surface in the admin/portal roles. One table
component contract, used everywhere:

| Concern | Standard |
|---|---|
| **Sorting** | Click a column header to sort; click again to reverse; a third click returns to default sort. Only one sort column active at a time unless the table explicitly supports a documented multi-sort (rare — justify in §19 if used). Current sort column/direction is visually indicated in the header, always. |
| **Filtering** | A filter bar above the table, not buried in a menu, for the 2–4 filters that matter most for that entity (status, branch/scope, date range). Additional filters live behind a "More filters" disclosure. Active filters are shown as removable chips, so the user always sees what's narrowing their view. |
| **Search** | A local, in-table text search box filters the *currently loaded/queried* list client-side for small tables, or triggers a server-side query for large ones — never silently limited to "first page only" results without indicating that. This is distinct from global search (§4.5). |
| **Pagination** | Default 25 rows/page for admin tables, 10 for mobile/portal tables. Always shows total count ("1–25 of 340"). Cursor or offset pagination is an implementation detail; the UX contract is: never an infinite unbounded table, always a visible total. |
| **Column visibility** | Tables with >6 columns offer a column-visibility toggle (persisted per user where feasible). The first 1–2 columns (identity: name, status) are never hideable — they're required for the row to be legible at all. |
| **Bulk selection** | A checkbox column, header checkbox for select-all-on-page, and a persistent action bar that appears only when ≥1 row is selected, showing the count and the safe bulk actions available (§7). Selection never silently spans beyond the loaded page without an explicit "select all N matching filter" action. |
| **Sticky headers** | Column headers stay pinned on scroll for any table taller than one viewport. Non-negotiable for tables that commonly exceed 25 rows (Students, Attendance, Finance). |
| **Empty state** | See §13 — never a bare "No data" with no next action. |
| **Loading state** | Skeleton rows matching the real table's column structure, never a spinner replacing the whole table region (§14). |
| **Row actions** | A trailing "..." menu per row for secondary actions (Archive, Duplicate, Export this row); the single most common action (usually "View") is the entire row being clickable, not a separate button. Never more than one always-visible action button per row beyond the "..." menu — extra buttons compete with the row-click affordance and clutter dense tables. |

### 9.1 Mobile table behavior

See §16.5 — tables collapse to a card-per-row layout below the tablet
breakpoint; they do not horizontally scroll a dense grid on a phone.

---

## 10. Detail Page Standards

Every entity's detail page (`/{entity}/[id]`) follows one philosophy so a
user who's learned the Student detail page already knows how to read the
Group, Instructor, or Lead detail page.

| Region | Standard |
|---|---|
| **Header** | Entity name/title (large), a StatusBadge (§12 conventions — always text + color, never color alone) immediately beside it, and 1–2 lines of the most identity-critical metadata (e.g., branch, enrollment date). A "Back to {list}" affordance is always present, distinct from the breadcrumb (§4.4). |
| **Actions** | Per §4.6: one primary action, rest behind "...". Primary action is the single most common next step for that entity (e.g., "Record Attendance" on a live Group, "Edit" on a Student, "Approve" on a pending Payroll run) — not always "Edit" by default; it's chosen per entity based on real usage. |
| **Tabs** | Used when the entity has genuinely distinct sub-views (Overview / Sessions / Students / History on a Group). Not used to hide what should just be sections on one scrollable Overview — tabs are for *switching context*, not for *arbitrary organization*. If a user needs two tabs open in their head at once to answer a question, they should be one page. |
| **Metadata** | A consistent "facts" panel (creation date, IDs where relevant to the role, related-entity links) — always in the same position (right rail on desktop, below header on mobile) across every entity type. |
| **History** | Where the entity has a ledger or audit trail (financial, attendance, enrollment changes), a History tab/section shows an append-only, timestamped, actor-attributed log — never an editable "notes that happen to look like history." This mirrors the ledger-table rule in `ARCHITECTURE_RULES.md` §6: if the data model doesn't allow retroactive edits, the UI must not imply it does. |
| **Related entities** | Shown as compact linked lists/cards (e.g., a Group's Students tab shows student cards linking to their own detail pages), never as a second full data table requiring its own pagination UI unless the relationship is genuinely large (>25 typical) — in which case it becomes its own tab with the full table treatment from §9. |
| **Notes** | Free-text/staff-notes surfaces (already established for Student Notes with category/severity) follow one shared notes component: authored, timestamped, attributable, sortable by severity/pinned state — reused wherever an entity needs staff annotation (Students, Leads, Instructors), not reinvented per entity. |

### 10.1 Ownership-model reflection in detail pages

Per `ARCHITECTURE_RULES.md` §10 (Groups are operational delivery,
Enrollments are financial contracts): a Student's detail page must visually
separate "which group(s) are they currently in" (operational, can change
freely) from "what is their enrollment/session-balance status" (financial,
ledger-backed). These must never be merged into one ambiguous "status" field
— this is the exact conflation the ownership model was written to prevent,
and it must hold in the UI as strictly as it holds in the schema.

---

## 11. Dashboard Philosophy

Dashboards are the landing surface for every authenticated role. They are
**"what needs my attention right now," not "every metric I might want."**

| Element | Standard |
|---|---|
| **KPIs** | 3–5 top-line numbers max, each with a clear timeframe label ("this week," "as of today") and, where meaningful, a trend indicator against the prior comparable period. More than 5 KPI cards on one dashboard is a sign the page needs sectioning, not more cards. |
| **Charts** | Used only where a trend or comparison is the point (revenue over time, attendance rate by branch) — never used to visualize a single number that a KPI card already communicates better. Follow the platform's `dataviz` design-system guidance for chart color/form (referenced, not restated here — that's a visual-design concern out of this document's scope). |
| **Recent activity** | A scoped, role-appropriate feed (e.g., a Team Leader sees recent attendance/payment/lead events for their branch) — chronological, timestamped, and each item deep-links to its source record. Never an undifferentiated firehose; cap and offer "view all" into the relevant domain's list page. |
| **Alerts** | Surfaced above the fold, visually distinct (see StatusBadge's warning/danger semantics, §12), and always actionable — an alert with no available next action is noise and should be a passive KPI instead. |
| **Tasks** | Where the role has recurring operational to-dos (Team Leader: pending payroll approvals, unresolved leads; Instructor: ungraded homework), a short task list with direct links is preferred over expecting the user to remember to check each domain. |
| **Quick actions** | 2–4 buttons for the role's most frequent creation/action flows (e.g., Team Leader: "New Session," "New Lead"). Mirrors §4.6's one-primary-action rule at the page level, not the button-row level — a dashboard is allowed a small curated action row because it *is* the hub, unlike a list page. |
| **Role-based widgets** | Widget presence and data scope follow §6 exactly — an Administrator's dashboard widget set is a superset in scope (network-wide) of a Team Leader's (branch-scoped), never a structurally different widget for the "same" concern. |

Every dashboard number carries an implicit contract: it is either clearly
live/current or clearly timestamped as of a cache/refresh point (§14). A
dashboard that cannot state its own freshness is not shippable.

---

## 12. Notifications

One shared notification vocabulary across toast/inline/system-level surfaces:

| Type | When used | Behavior |
|---|---|---|
| **Success** | An action completed as intended (record saved, payment approved). | Auto-dismissing toast, brief, non-blocking. Never required reading — the user should be able to keep working through it. |
| **Warning** | The action completed but with a caveat the user should know (e.g., "Session saved, but this instructor is double-booked"). | Toast that persists slightly longer than success, or an inline banner if the caveat affects the current page's data. |
| **Error** | An action failed. | Non-auto-dismissing (or long-duration) toast/banner with the specific cause and, where possible, the fix — never a bare "Something went wrong." See §15. |
| **Info** | Passive, non-urgent system information (e.g., "New certificate template available"). | Lowest-priority channel — the existing bell/notification-dropdown pattern (already built for Team Leader), not a toast that interrupts active work. |
| **System notifications** | Cross-cutting events relevant to a role beyond the current page (a new lead assigned, a payroll run ready for approval). | Delivered via the persistent notification bell, with unread count, grouped by domain, each deep-linking to the source record — this pattern (already shipped for Team Leader) is the canonical model to extend to other roles rather than reinventing per role. |
| **Background jobs** | Long-running operations (bulk certificate generation, bulk import, export generation). | A visible, dismissible progress indicator that survives navigation away and back (the user shouldn't have to babysit the tab) and a completion notification through the System Notifications channel above when done. |

Notification copy is always specific to the entity acted on ("Alpha Squad's
Tuesday session was cancelled," not "Update successful") — this is the same
naming discipline as confirmation dialogs (§8.5).

---

## 13. Empty States

Every empty state answers two questions: **why is this empty, and what do I
do next.** A bare "No data" is never acceptable.

| Scenario | Standard |
|---|---|
| **No data (genuinely new/unused)** | Friendly illustration or icon, one sentence explaining what will appear here, and — if the viewer has create permission — the primary create action right there in the empty state, not just on the (also-empty-looking) page header. |
| **No search/filter results** | Distinct from "no data" — states that filters are active, shows the filter chips, and offers a one-click "clear filters" action. Never visually identical to the true-empty state; a user must be able to tell "nothing exists" from "nothing matches." |
| **No permissions** | Rare in practice per §6.1 (whole domains are hidden, not shown-empty) — but where a specific sub-resource within an otherwise-accessible page is restricted, state plainly what's hidden and, if relevant, who to ask (e.g., "Financial details are managed by your Team Leader"). Never a raw 403 with no explanation. |
| **Offline** | See §15 — a distinct, dismissible banner state, not an empty list masquerading as "no data." |
| **Deleted/archived content** | When a user follows a stale link/breadcrumb to a now-deleted or archived entity, state clearly that it was removed/archived (and by inference, when possible), offer the restore action if the viewer has permission (§7), and always offer a path back to the live list. |

---

## 14. Loading States

The system must always visually distinguish **loading** from **loaded-and-
empty** from **stale-while-refreshing**.

| Pattern | Standard |
|---|---|
| **Skeletons** | The default loading treatment for any content region — tables (§9), cards, detail pages. Skeletons match the real content's shape (row count, card grid) so the layout doesn't jump on load. Already established via `.ds-skeleton`; extend, don't reinvent. |
| **Progress bars** | Reserved for operations with a knowable duration/percentage (bulk import row-by-row progress, file upload). Not used as a generic "loading" substitute for skeletons. |
| **Optimistic UI** | Used for low-risk, easily-reversible actions (toggling a filter, marking a notification read) — the UI updates immediately, reconciling silently on server confirmation and rolling back with a clear error if it fails. Never used for financial, attendance, or enrollment-ledger writes (§8.4's autosave boundary applies identically here) — those always wait for and confirm server acknowledgment before showing success. |
| **Background refresh** | For dashboards/lists that auto-refresh (e.g., a live attendance count during a session), a small, non-intrusive "updated Xs ago" indicator — refreshed data never silently replaces what the user is looking at without some visual acknowledgment (a brief highlight/pulse on changed values is sufficient; a full-page reload/flash is not acceptable). |

---

## 15. Error Handling

A universal strategy, so a user hitting an error on the Finance page and one
hitting an error on the Portfolio page get the same *quality* of response,
even though the content differs.

| Error type | Standard |
|---|---|
| **Validation** | Inline, at the field, per §8.3 — never a page-level error for a problem the user could see was wrong before submitting. |
| **Permission denied** | A dedicated, calm state (not a raw 403 page) explaining that the viewer's role doesn't include this, with a link back to somewhere useful (their dashboard). Per §6.1, this should be rare — whole domains are hidden, not gated with an error — so its appearance often signals a stale link or an IA bug worth investigating, not routine friction. |
| **404** | A dedicated not-found state distinct from permission-denied (the user needs to know "this doesn't exist" vs. "this exists but isn't yours"), with search (§4.5) and a link back to the relevant domain's list. |
| **500 / unexpected server error** | A calm, branded error state, never a raw stack trace or framework error page in production. Includes a retry action and, where the error is likely transient, auto-retry once before showing the state at all. |
| **Offline** | A persistent, dismissible-but-reappearing banner at the top of the viewport (not buried in a toast that disappears before a phone user on a spotty connection notices it) stating the app is offline and which actions are unavailable until reconnected. Data already loaded remains visible and interactable in read mode. |
| **Network timeout** | Distinguished from a hard failure — offer an explicit retry, and if the action might have partially succeeded server-side (e.g., a form submit), never let the user blindly resubmit without checking; show a "verify before retrying" state for anything ledger-adjacent. |

The unifying rule: **every error state tells the user what happened, whether
their data/action is safe, and what to do next** — never just that something
went wrong.

---

## 16. Responsive Strategy

### 16.1 Breakpoint philosophy

Three tiers, matching the persona split in §1.3: **Desktop** (primary for
Admin/Team-Leader analytical work), **Tablet** (secondary for Team
Leader/Instructor in-classroom use), **Mobile** (primary for
Instructor/Parent/Student).

### 16.2 Desktop

Full table density (§9), multi-column dashboards (§11), workspace-style
multi-panel surfaces (the established Groups/Instructors/Payroll "workspace"
pattern — components/dialogs/hooks split) are desktop-only patterns. They are
not expected to degrade gracefully to mobile; they are hidden/simplified
instead (§16.5).

### 16.3 Tablet

The realistic device for a Team Leader or Instructor standing in a branch.
Primary nav collapses to icons-with-labels-on-tap or a condensed sidebar;
tables reduce default visible columns (§9's column-visibility rules) rather
than shrinking font size to fit everything.

### 16.4 Mobile

Bottom tab bar (§4.1), single-column everything, forms become full-width
single-step-per-screen where a desktop form would show multiple sections
side-by-side (this does not contradict §8.1/8.2 — a "single-page form" can
still lay out as sequential full-width blocks on mobile; the step/no-step
decision is about form *complexity*, not viewport).

### 16.5 Tables on mobile

Tables never horizontally scroll a dense multi-column grid on a phone — below
the tablet breakpoint, every table becomes a **card list**: one card per row,
showing the 2–3 identity-critical columns (matching §9's "never-hideable"
columns) plus a tap-through to the full detail page for everything else.
This is already the shape of the Instructor's group/session mobile views and
is the standard for every other table going forward.

### 16.6 Touch interactions

Minimum 44×44px touch targets on all interactive elements in mobile-first
surfaces. Swipe gestures are additive shortcuts only (e.g., swipe-to-mark-
present on an attendance card) — every swipe action must have an equivalent
explicit tap/button path, never a swipe-only affordance.

### 16.7 Navigation on mobile

Per §4.1: bottom tab bar with 4–5 items + "More" sheet. Secondary/context
nav (§4.2/4.3) becomes a horizontally scrollable tab strip, never a dropdown
that hides the full shape of the page from the user.

---

## 17. Accessibility

Non-negotiable baseline (WCAG 2.1 AA target) across all five roles — a
parent or student on an older phone with a cracked screen and a bright
classroom is exactly the condition this baseline protects against, not an
edge case.

| Concern | Standard |
|---|---|
| **Keyboard** | Every action reachable via Tab/Shift+Tab/Enter/Escape/Arrow keys, with a visible focus outline at every stop (never `outline: none` without a replacement focus style). Modal/dialog focus is trapped within the dialog until dismissed. |
| **Contrast** | Text and meaningful icons meet 4.5:1 (body text) / 3:1 (large text, icons) contrast minimums against their background — this is a constraint on the visual design system (`DESIGN.md`), asserted here as a requirement this document depends on. |
| **Screen readers** | Every image/icon-only button has an accessible label. Dynamic content changes (toast notifications, live-updating counts) are announced via `aria-live` regions, not silently updated. |
| **ARIA** | Semantic HTML first; ARIA roles only to fill genuine gaps (custom dropdowns, tabs, dialogs) — never used to paper over non-semantic markup that should just be a `<button>` or `<table>`. |
| **Focus states** | On every interactive element, always visible, always distinct from hover state (a user tabbing through a form must be able to tell where they are without a mouse in play). |

---

## 18. Naming Convention

Consistent naming keeps a 148+ route, five-role, ten-domain product legible
to every future contributor (human or AI).

| Category | Convention | Example |
|---|---|---|
| **Pages (routes)** | kebab-case, plural for list routes, singular action words for special routes (`new`, `edit`) — matches existing convention, do not deviate. | `/admin/team-leaders`, `/admin/team-leaders/new`, `/admin/team-leaders/[id]/edit` |
| **Components** | PascalCase, named for the entity + role it belongs to when not shared (`InstructorGroupCard`), or generically named when a shared primitive (`StatusBadge`, `AdminTopbar`). | `InstructorGroupCard.tsx`, `StatusBadge.tsx` |
| **Files** | Component files match their default export name exactly. Route-scoped, non-shared subcomponents live in a `_components` (or `components/`, `dialogs/`, `hooks/` for workspace-pattern pages) folder colocated with the route, matching the existing convention already used under `team-leader/groups/workspace/`. | `app/portal/instructor/history/_components/...` |
| **Hooks** | `use{Noun}` or `use{Verb}{Noun}`, one concern per hook. | `useGroupWorkspace`, `useAttendanceGuard` |
| **Server actions** | `{verb}{Entity}Action`, always a verb-first name stating the mutation. | `editGroupAllocationRangeAction` |
| **Buttons** | Label states the action + object when ambiguous ("Record Attendance," not "Submit"); the design-system button class (`.ds-btn-*`) determines style, not the label. | "New Group," "Approve Payroll" |
| **Dialogs** | Named for their action, not their container ("Confirm Delete Group," not "Modal 3"). | `ConfirmDeleteGroupDialog` |
| **Tables** | Named for the entity they list, not the page they're on (`StudentsTable`, reused wherever a students list appears, not `AdminStudentsTable`/`TeamLeaderStudentsTable` duplicated — permission differences are handled per §6.1, not by forking the table). | `StudentsTable` |
| **Forms** | `{Entity}Form`, shared between Create and Edit per §7 ("Edit reuses Create's form component"). | `StudentForm` |

---

## 19. Design Decision Log

Permanent architectural decisions. Future sessions (human or AI) must treat
these as settled unless a new decision is logged here superseding one.

| ID | Decision | Rationale |
|---|---|---|
| D-01 | IA is organized by business domain (§3), not by route folder (`/admin` vs `/portal/*`). | Route folders express permission boundary; domains express product structure. Conflating them causes nav drift as roles gain/lose routes independently of the business logic they represent. |
| D-02 | One shared component tree per entity; permissions gate actions/fields, never fork the component (§6.1). | The alternative (role-forked components) is the single biggest long-term maintenance risk in a 5-role product — verified against the existing pattern (one `StatusBadge`, one `.ds-card` system, shared across all portals). |
| D-03 | Groups (operational) and Enrollments (financial/contractual) are never merged into one "status" concept in any UI (§10.1). | Directly enforces `ARCHITECTURE_RULES.md` §10's ownership model. A UI violation here has caused real confusion historically (see Phase XVIII partial-allocation and Phase XXXVI multi-instructor work) — this is a hard line. |
| D-04 | Soft-delete + Archive + Restore is the only delete pattern exposed in the UI (§7). Hard delete never has a UI affordance. | Matches `ARCHITECTURE_RULES.md` §3/§4 exactly — the UX layer must not offer an action the data layer forbids. |
| D-05 | Mobile tables become card lists, never horizontal-scroll grids (§16.5). | Front-line roles (Instructor) are phone-first by necessity (§1.3); a scrolling dense grid fails the "30 seconds in a classroom" goal from §1.2. |
| D-06 | Autosave/optimistic UI is banned for any ledger-adjacent write (finance, attendance, enrollment) (§8.4, §14). | These are append-only ledger tables per `ARCHITECTURE_RULES.md` §6 — the UI must never imply a write succeeded before the server confirms it, since ledger writes cannot be silently corrected. |
| D-07 | A unified command palette is a planned extension of the existing global search (§4.7), not yet built. | No `cmdk`/command-palette implementation exists in the codebase today (verified). Flagged here rather than left ambiguous so a future session doesn't build three competing overlays for navigate/search/quick-action. |
| D-08 | Studio (`/studio/*`) is documented in the IA (§3.1) but is explicitly not a sixth academy persona (§2.6). | Studio serves marketing/content operators, not the five academy-facing roles this blueprint's UX principles are tuned for. Blending its content-editing patterns into academy admin/portal screens (or vice versa) is an anti-pattern. |
| D-09 | Primary nav order is fixed across all five roles (Home → Academics → People → Learning Record → Finance → Growth → Intelligence → Governance → Settings), even where a role sees a subset (§4.1). | Preserves muscle memory across roles and across any future role-switching/impersonation UI, at the cost of a role occasionally seeing a short nav list — judged worth it. |
| D-10 | This document does not govern visual design (color, typography, spacing, component styling) — that is `DESIGN.md`'s scope. | Keeps the two documents from drifting out of sync by each owning a distinct, non-overlapping layer: this file is *structure and behavior*, `DESIGN.md` is *appearance*. |

---

## 20. Future AI Rules

Binding instructions for any future AI agent (or human) working on Robocode
LMS UX/UI.

### MUST

1. **Read this document before designing or building any new screen, form,
   table, or dashboard.** If a pattern for the thing you're building already
   exists here, use it — do not re-derive a "better" version from scratch.
2. **Place every new route in its correct business domain** (§3.1) and its
   correct permission surface (§3.2) — these are two separate decisions,
   make both explicitly.
3. **Reuse the shared component contracts** for tables (§9), forms (§8),
   detail pages (§10), and CRUD lifecycle (§7) rather than building a
   bespoke version "just for this entity."
4. **Gate by permission via capability checks within one shared component
   tree** (§6.1) — never fork a screen per role.
5. **Preserve the Groups-vs-Enrollments separation** (§10.1, D-03) in any
   screen touching students, groups, or financial status.
6. **Use soft-delete/archive/restore only** for any destructive action
   (§7, D-04) — never expose hard delete.
7. **Treat ledger-adjacent writes (finance, attendance, enrollment) as
   always-confirmed, never-optimistic** (§8.4, §14, D-06).
8. **Design mobile-first for Instructor/Parent/Student surfaces and
   desktop-first for Admin/Team-Leader analytical surfaces** (§16.1) —
   check which persona a screen serves before choosing a starting viewport.
9. **When a genuinely new pattern is needed** (this document doesn't cover
   the case), design it consistently with §5's principles, then **add it to
   this document** (extend §7–§18 as appropriate) so it's not re-invented
   next time, and log the decision in §19.
10. **When in doubt about whether a UX choice conflicts with this document,
    ask the user** rather than silently choosing — this document is meant to
    remove ambiguity, and a genuine gap is worth a real answer, not a guess.

### MUST NEVER

1. **Never invent a new business domain, rename, or move an existing route**
   without first identifying a specific, stated UX problem and documenting
   the reasoning (per the task's own instruction and D-01–D-10 as the bar
   for "this is significant enough to touch the constitution").
2. **Never fork a shared component to remove a permission** — that's a
   maintenance time-bomb explicitly ruled out in §6.1/D-02.
3. **Never add a new destructive UI action that performs a hard delete.**
4. **Never introduce a second, competing search/navigation overlay** once
   the command palette (§4.7/D-07) exists — extend the one palette.
5. **Never merge Group (operational) and Enrollment (financial) status
   into a single field or badge** — this is the most-repeated rule in this
   document because it is the most-repeatedly-relevant one (§10.1, D-03).
6. **Never ship a loading state that's indistinguishable from an empty
   state, or an empty state with no next action** (§13, §14).
7. **Never ship a generic "Something went wrong" error with no cause and
   no next step** (§15).
8. **Never pick colors, typography, or component visual style in this
   document's name** — that's `DESIGN.md`'s domain (D-10). If a UX decision
   here seems to require a visual-design choice, flag it for `DESIGN.md`
   instead of deciding it here.
9. **Never treat this document as a design proposal to debate per-screen.**
   It is the constitution; propose amendments (§19) if a real conflict is
   found, don't quietly route around it screen by screen.
