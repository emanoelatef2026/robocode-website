# Robocode LMS — Component Library Specification

**Status:** Constitution, fourth layer. `product-blueprint.md` defines *how the
product behaves*. `ux-execution-plan.md` defines *where 181 routes stand
today*. `design-system-architecture.md` defines *the operating system that
builds every screen* (layers, taxonomy categories, tokens-as-categories,
governance). This document is the **inventory and build contract** that sits
inside that operating system: it names every component the system needs,
classifies it, maps its dependencies, and sequences its construction.

**Scope boundary (restated, binding):** This document contains **no UI, no
React code, no Tailwind, no colors, no typography values, no icon choices, no
component visual styling, no Figma, no design tokens**. Every reference to a
component below is a structural/behavioral classification — what it is
responsible for, who consumes it, what it depends on, how critical it is —
never what it looks like. Visual treatment is `DESIGN.md`'s domain, exactly as
`design-system-architecture.md` §1/§5 already establishes.

**Relationship to the three constitutional documents:** This document does not
reopen, re-litigate, or contradict any decision in the blueprint's §19 Design
Decision Log, the execution plan's Gap #1–#3, or the design-system
architecture's twelve Architecture Principles (§2) or eleven-category taxonomy
(§6.1). It **extends** `design-system-architecture.md` §6 (Component
Taxonomy), §8 (Layout Architecture), and §16 (Governance) into a concrete,
named inventory — the thing §6.3 calls "a new entry within an existing
category," done exhaustively, once, so no future session has to re-derive it
per entity.

**Source data:** Every component claimed to exist below was verified directly
against the repository on 2026-07-11 (file path confirmed, not inferred).
Every component *not yet built* is explicitly marked **Predicted** and
justified against a named route/domain need from `ux-execution-plan.md` §2.
Nothing here is guessed into existence and left unmarked.

---

## 1. Component Library Vision

### 1.1 Why this library exists

`design-system-architecture.md` §1.1 already names the root cause of the
execution plan's Gap #2 (Admin/Team-Leader component duplication) and Gap #1
(modal-vs-route ambiguity): Robocode has a UX constitution but, until this
document, no **exhaustive, named inventory** of what the shared component tree
actually contains or should contain. A taxonomy of *categories* (DSA §6.1)
tells a builder where a new component belongs. It does not tell them **whether
one already exists** — and the verification pass behind this document found
that gap is real and larger than previously documented: there is no shared
`Table` component across ~55 Data Table/List routes, `Avatar` is forked twice,
`EmptyState` is forked five times, `KpiCard`/`StatCard` exist as four
unreconciled variants, and `ErrorBoundary`/`ConfirmDialog` do not exist at all
today (§17 documents each of these as a formal gap). This library exists to
close exactly that verification gap: it is the answer to "does this already
exist?" so that answer never again requires an archaeology pass through 181
routes.

### 1.2 Goals

1. **Name every reusable unit once**, so "check the Component Taxonomy for an
   existing named unit" (DSA §17.1) is answerable in seconds, not a grep
   expedition.
2. **Make duplication visibly wrong.** A builder (human or AI) who is about to
   create `TLGroupFinanceSection` next to an existing `GroupFinanceSection`
   should be able to find the existing one in this document *before* writing
   the fork — the fork then requires a conscious decision to violate a named
   rule, not an accidental one born of not knowing the original existed.
3. **Sequence construction by real dependency and real ROI** (§10, §16), not
   by whichever entity is top-of-mind this week.
4. **Give every component a lifecycle** (§11) so "is this still the current
   pattern, or a fossil kept alive by inertia" has a documented answer, the
   same discipline the execution plan applied to routes (Redirect/Legacy-Alias
   inventory, §7.4 of that document) applied here to components.
5. **Survive 5–10 years and 300+ screens** without requiring a second
   from-scratch inventory — this document is designed to be *extended*
   (new rows added to its tables) far more often than *rewritten*.

### 1.3 Relationship to the three prior documents

| Document | What it owns | What this document takes from it, unmodified |
|---|---|---|
| `product-blueprint.md` | UX behavior, permission philosophy, CRUD/form/table standards, 10 business domains | Every component's *behavioral contract* (§5, §6) is a direct instantiation of a blueprint rule — this document never invents new UX behavior, only names the component that implements behavior the blueprint already specified. |
| `ux-execution-plan.md` | Current-state route/template inventory, confirmed gaps, wave sequencing | The 181-route inventory, the 17-Template list, and the Wave 1–5 sequencing are treated as ground truth. §10 of this document is a component-level *implementation* of those same waves, not a competing sequence. |
| `design-system-architecture.md` | System Layers (§3), Component Taxonomy categories (§6.1), Layout Architecture (§8), Governance (§16), AI Development Rules (§17) | This document's hierarchy (§2), taxonomy (§3), lifecycle (§11), and quality gates (§15) are named extensions of DSA §3, §6, §16, and §18 respectively — never a parallel or competing structure. |

### 1.4 Long-term scalability commitment

At 181 routes today and a 300+-screen horizon, the arithmetic that justifies
this document is direct: the execution plan's Component Demand Forecast (§8 of
that document) estimated ~20 consolidated components would replace ~40
existing role-forked equivalents for just five entities. This document's
verification pass found the real fragmentation is broader (Table, Avatar,
EmptyState, Calendar, MetricCard families all forked, §17) — meaning the
actual consolidation opportunity, and therefore the actual long-term
maintenance saving, is larger than the execution plan alone could see without
a full component-level inventory. This document is that inventory.

---

## 2. Library Architecture

### 2.1 The hierarchy, mapped to the System Layers (DSA §3)

`design-system-architecture.md` §3 already defines the canonical eight-layer
stack (Foundation → Tokens → Primitives → Patterns → Components → Templates →
Screens → Applications) and forbids reinventing it. This document uses that
exact stack, with two layers given more precise, component-library-facing
names for the purpose of cataloging (§4–§9). No new System Layer is created;
this is a naming refinement at the Components layer only, per DSA §6.3's
allowance for category refinement without a new Foundation-level layer.

```
Foundation          (DSA §4 — categories only, unchanged, out of scope here)
   │
Tokens              (DSA §5 — five-layer token stack, unchanged, out of scope here)
   │
Primitives          (DSA §6.1 "Foundation" category — Button, Input, Icon, Badge, Checkbox, Toggle)
   │
Compositions        (small, domain-free multi-Primitive combinations — a
   │                 labeled field with error text, an icon-button, a
   │                 dismissible chip — the connective tissue between
   │                 Primitives and behavior-bearing Patterns)
   │
Patterns            (DSA §3 "Patterns" — sortable/filterable/paginated table
   │                 contract, confirm-then-destroy flow, step-validate-review
   │                 wizard shell — behavior contracts, not visual units)
   │
Business Components (DSA §6.1 "Domain Components" category — StudentCard,
   │                 GroupFinanceSection, AttendanceRow, CertificatePreview —
   │                 named, composed, entity-specific, never role-specific)
   │
Templates           (DSA §8 Layout Architecture + the 17 structural screen
   │                 types the execution plan found in production)
   │
Pages               (DSA "Screens" — one Template + real domain content +
   │                 real permission scope = one of 181, soon 300+, routes)
   │
Applications           (the 5 portals + Studio + the Public Site)
```

### 2.2 Layer responsibilities (component-library-specific)

| Layer | Responsibility | Analogous DSA layer | Who builds it |
|---|---|---|---|
| **Primitives** | Irreducible interactive units; cannot be decomposed without losing function. | DSA §6.1 Foundation category | Design System Lead (DSA §16.2) |
| **Compositions** | Groups 2–4 Primitives into a reusable structural unit with no domain awareness and no independent behavior contract of its own (a `FormField` = `Label` + `Input` + `HelperText`; an `IconButton` = `Icon` + `Button`). | Sits between DSA §6.1 Foundation and Patterns — not separately named in DSA, introduced here as a cataloging convenience only | Any engineer/agent, following §7 |
| **Patterns** | Reusable *behavior* contracts multiple Business Components share — sort/filter/paginate, confirm-then-destroy, step-validate-review, permission-gated-render. | DSA §3 Patterns | Design System Lead, reviewed (DSA §16.2) |
| **Business Components** | The actual named, composed, reusable, entity-aware building blocks screens assemble from — `StudentCard`, `GroupFinanceSection`, `CertificatePreview`. One per entity concern, never one per role (DSA D-02). | DSA §6.1 Domain Components | Any engineer/agent, following §7, §14 |
| **Templates** | The structural shape a Page takes — 17 confirmed archetypes (execution plan §3), 8 Layout Architecture archetypes (DSA §8). | DSA Templates | Any engineer/agent, extending only with Governance sign-off (DSA §16.2) |
| **Pages** | Real routes: one Template + real content + real permission scope. | DSA Screens | Any engineer/agent, freely, within the above constraints |
| **Applications** | Portal-level composition and permission boundary (Admin, Team Leader, Instructor, Parent, Student, Studio, Public Site). | DSA Applications | Rare — a product decision, not a design one |

### 2.3 Why Compositions is worth naming separately

Without a named "Compositions" step, builders either (a) treat every
multi-Primitive combination as a full Business Component — inflating the
Business Component catalog with entity-free scaffolding like "a field with a
label and an error message," which has nothing to do with Students or Groups —
or (b) inline the combination ad hoc inside every form, which is exactly the
kind of small, invisible duplication that compounds at 300 screens. Naming
Compositions gives that connective tissue exactly one home: reusable, but
explicitly *not* domain-aware, and therefore never subject to the permission-
gating rules (DSA §6.1, §17.2) that govern Business Components.

---

## 3. Component Taxonomy

This section refines DSA §6.1's eleven categories into twenty, for cataloging
precision at the scale of 300+ screens. **This is a sub-classification, not a
replacement** — every category below maps onto exactly one DSA §6.1 category
or one blueprint §3.1 business domain, and DSA's one-way composition rule
(§6.2: a category may compose from any category above it, never below) still
applies across all twenty.

| # | Category | Definition | Maps to (DSA §6.1 / blueprint §3.1) |
|---|---|---|---|
| 1 | **Foundation** | Primitives proper — Button, Input, Icon, Badge, Checkbox, Toggle, Radio, Switch. | DSA §6.1 "Foundation" |
| 2 | **Layout** | Page shells, grid containers, the 8 Layout Architecture archetypes (Detail, Table, Wizard, Dashboard, Workspace, Authentication, Application, Responsive). | DSA §6.1 "Layout" |
| 3 | **Navigation** | Sidebar, Topbar, Breadcrumb, Tab strip, Bottom Tab Bar + "More" sheet, Command Palette shell. | DSA §6.1 "Navigation" |
| 4 | **Data Entry** | Inputs, Select, multi-step form shell, file upload, rich-text/notes editor. | DSA §6.1 "Data Entry" |
| 5 | **Data Display** | Card, StatusBadge, list item, metadata panel, related-entity link card, Avatar. | DSA §6.1 "Data Display" |
| 6 | **Data Visualization** | KPI/Metric card, Chart wrapper, Sparkline, progress indicator. Chart *drawing* is `dataviz` skill's domain (DSA §6.1); this category owns *when/where* a chart belongs. | DSA §6.1 "Data Visualization" |
| 7 | **Feedback** | Toast, inline banner, field-level error, notification bell + dropdown, background-job progress. | DSA §6.1 "Feedback" |
| 8 | **Overlay** | Modal, Drawer, confirm/destructive Dialog, Popover, Command Palette surface. | DSA §6.1 "Overlay" |
| 9 | **Workspace** | Multi-panel power-user surfaces (list/detail/action-panel + colocated `components/`/`dialogs/`/`hooks/`). | DSA §6.1 "Workspace" |
| 10 | **Search** | Global search entry point + results overlay (blueprint §4.5), local in-table search (blueprint §9). Promoted to its own category here because it spans Navigation *and* Table Layout and deserves one home rather than two half-homes. | DSA §6.1 "Navigation" (search sub-concern) + blueprint §4.5 |
| 11 | **Filtering** | Filter bar, filter chip, "More filters" disclosure, column-visibility toggle. Promoted separately from Search because filtering is *local, in-page* state (blueprint §9) — a structurally distinct concern from Search's *global, cross-entity* job (blueprint §4.5), and the two must never be visually or architecturally conflated. | DSA §6.1 "Layout" (Table Layout sub-concern) |
| 12 | **Communication** | Notification bell/dropdown (system notifications, blueprint §12), parent-feedback submission surface, activity feed. Promoted separately from generic Feedback because these are *persistent, cross-session* communication records, not transient toasts. | DSA §6.1 "Feedback" (persistent sub-concern) + blueprint Domain 5 (Growth/CRM) |
| 13 | **Authentication** | Login form, password reset/forgot-password form, workspace selector (post-login routing), account self-service panel. | DSA §8 "Authentication Layout" + blueprint Domain 9 |
| 14 | **Education** | Group/Session/Attendance/Assignment-specific Business Components — `AttendanceGrid`, `AssignmentSubmissionCard`, `GroupScheduleCard`, `SpecialSessionBadge`. | DSA §6.1 "Domain Components" scoped to blueprint Domain 2 (Academics) |
| 15 | **Finance** | Ledger-adjacent Business Components — `PaymentTimeline`, `LedgerTable`, `ExpenseLineItem`, `PayrollApprovalRow`, `EnrollmentBalanceCard`. | DSA §6.1 "Domain Components" scoped to blueprint Domain 4 (Finance) |
| 16 | **CRM** | `LeadFunnelChart`, `LeadCard`, `ParentFeedbackCard`, `ConversionStageIndicator`. | DSA §6.1 "Domain Components" scoped to blueprint Domain 5 (Growth/CRM) |
| 17 | **Analytics** | `AnalyticsWidget`, `BranchPerformanceCard`, `InstructorPerformanceCard`, comparison-view components. | DSA §6.1 "Domain Components" scoped to blueprint Domain 6 (Operations Intelligence) |
| 18 | **Portfolio** | `PortfolioGallery`, `ProjectCard`, `AchievementBadge`, `PortfolioTimeline`. | DSA §6.1 "Domain Components" scoped to blueprint Domain 3 (Learning Record) |
| 19 | **Certificates** | `CertificatePreview`, `CertificateVerificationBadge`, `BulkCertificateWizardShell`, `CertificateTemplateCard`. | DSA §6.1 "Domain Components" scoped to blueprint Domain 3 (Learning Record) |
| 20 | **Utilities** | Empty state, Skeleton, Error boundary, Permission-gate wrapper, Confirm-before-destroy wrapper, Offline banner. | DSA §6.1 "Utilities" |

### 3.1 Why Education/Finance/CRM/Analytics/Portfolio/Certificates are split, not one bucket

DSA §6.1 groups all entity-specific composed units under one "Domain
Components" category. That is correct at the *system-layer* level (§2.2 above
— they all sit at the same layer, obey the same one-way composition rule).
This document splits them into six named families for **cataloging
precision only**, because at 300+ screens "search Domain Components for an
existing unit" (DSA §17.1) is only fast if Domain Components is itself
organized — and the blueprint already provides the organizing axis for free:
its own 10 business domains (§3.1). This mirrors exactly how the blueprint
organizes routes by domain rather than by route folder (blueprint D-01) —
applied here one layer down, to components instead of routes.

### 3.2 A category that is deliberately *not* split further

Gamification (badges, XP, streaks, leaderboard) is not given its own top-level
category here — it is treated as a cross-cutting *motion and feedback
concern* layered onto Portfolio and Data Display components (DSA §14.3 tier 4,
Celebratory motion is reserved for exactly this), not a business domain of its
own. The blueprint itself files gamification under Learning Record (Domain 3),
not as an eleventh domain — this document holds that line.

---

## 4. Component Discovery

Every component predicted to be needed across the full 300+-screen horizon,
organized by the twenty categories above. **Confirmed** = verified present in
the repository today (file path in §5/§17). **Predicted** = does not exist yet,
justified against a named route/domain in `ux-execution-plan.md` §2.

### 4.1 Foundation

Button, IconButton*, Input, Textarea, Select, Checkbox, Radio, Toggle/Switch,
Icon, Avatar*, Badge (generic, distinct from StatusBadge), Divider, Link,
Spinner (reserved for genuinely indeterminate waits only, per DSA §14).
(*Avatar confirmed but forked — see §17.)

### 4.2 Layout

ApplicationShell (per portal), WorkspaceLayout, DashboardLayout, WizardLayout,
AuthenticationLayout, DetailLayout, TableLayout, ResponsiveLayout
wrapper/hook, PageHeader, PageSection.

### 4.3 Navigation

Sidebar (per portal, domain-order fixed per D-09), Topbar (**Confirmed**:
`AdminTopbar`), Breadcrumb, TabStrip (secondary nav), ContextTabs (within-entity
nav, visually distinct from TabStrip per blueprint §4.3), BottomTabBar,
MoreSheet, CommandPalette shell (**Predicted** — confirmed absent, D-07).

### 4.4 Data Entry

TextField, DateField, DatePicker, TimePicker, MultiSelect, TagInput,
FileUpload, RichTextEditor, NotesEditor (**Confirmed, narrowly**:
`StudentNoteModal` — see §17 for its single-usage-site gap), MultiStepFormShell,
StepIndicator, ReviewStep, EntityForm contract (shared Create/Edit form
per blueprint §7 "Edit reuses Create").

### 4.5 Data Display

Card (**Confirmed**: `.ds-card`), StatusBadge (**Confirmed**:
`components/admin/StatusBadge.tsx`, ~30 statuses), Avatar (**Confirmed but
forked** ×2), ListItem, MetadataPanel (Detail Layout's "facts" panel),
RelatedEntityLinkCard, EntityHeader (name + StatusBadge + identity metadata,
per blueprint §10), ProfileSummary.

### 4.6 Data Visualization

MetricCard/KPICard (**Confirmed but fragmented**: `KpiCard.tsx` + 3× `StatCard`
forks — see §17), ChartWrapper (governed jointly with `dataviz` skill),
Sparkline, ProgressIndicator, TrendIndicator (up/down + magnitude, per
blueprint §11 KPI trend requirement).

### 4.7 Feedback

Toast, InlineBanner, FieldError, NotificationBell + Dropdown (**Confirmed but
scope-limited**: `components/portal/instructor/NotificationBell.tsx` —
instructor-only today, not yet the cross-role pattern blueprint §12 describes
— see §17), BackgroundJobProgressIndicator (**Predicted** — blueprint §12
requires it, no confirmed implementation found).

### 4.8 Overlay

Modal, Drawer, ConfirmDialog (**Predicted** — confirmed absent as a standalone
component, only inline confirm logic today, see §17), Popover, CommandPalette
surface (**Predicted**).

### 4.9 Workspace

WorkspaceLayout shell (**Confirmed**, proven 3×: `GroupsWorkspaceClient`,
`InstructorsWorkspaceClient`, `FinanceClient`), WorkspaceListPanel,
WorkspaceDetailPanel, WorkspaceActionPanel, WorkspaceDialogHost.

### 4.10 Search

GlobalSearchTrigger, GlobalSearchOverlay (entity-grouped results, per blueprint
§4.5), InTableSearchBox (local, distinct from Global Search per blueprint §9).

### 4.11 Filtering

FilterBar, FilterChip, MoreFiltersDisclosure, ColumnVisibilityToggle,
DateRangeFilter, StatusFilter, BranchScopeFilter.

### 4.12 Communication

NotificationBell (cross-role target state, extending §4.7's Confirmed
instance), ActivityFeed, ParentFeedbackCard, FeedbackSubmissionForm.

### 4.13 Authentication

LoginForm, ForgotPasswordForm, ResetPasswordForm, WorkspaceSelector
(post-login routing), AccountPasswordPanel.

### 4.14 Education (domain family)

AttendanceGrid, AttendanceRow, SessionCard, GroupScheduleCard,
SpecialSessionBadge, AssignmentCard, AssignmentSubmissionCard,
CalendarGrid/SchedulingView (**Confirmed but forked** ×2 — TL and Instructor
each build their own — see §17), CourseModuleTree.

### 4.15 Finance (domain family)

PaymentTimeline, LedgerTable, ExpenseLineItem, PayrollApprovalRow,
EnrollmentBalanceCard, GroupFinanceSection (**Confirmed, forked** — Admin
version exists, TL equivalent is a different component, `TLEnrollStudentsForm`
— execution plan Gap #2, restated here as a component-level finding),
CollectionsSummaryCard.

### 4.16 CRM (domain family)

LeadCard, LeadFunnelChart, ConversionStageIndicator, ParentSatisfactionCard,
BookSessionForm (public lead-capture).

### 4.17 Analytics (domain family)

AnalyticsWidget, BranchPerformanceCard, InstructorPerformanceCard,
ComparisonView, ExecutiveKpiRow.

### 4.18 Portfolio (domain family)

PortfolioGallery, ProjectCard, AchievementBadge, PortfolioTimeline,
VideoGalleryItem, GamificationLeaderboardRow, XPBar, StreakIndicator, SOTWCard.

### 4.19 Certificates (domain family)

CertificatePreview, CertificateVerificationBadge (public-facing, `/verify/[code]`),
CertificateTemplateCard, BulkCertificateWizardShell (mode selection →
recipient selection → template/content → review, per blueprint §8.2).

### 4.20 Utilities

EmptyState (**Confirmed but fragmented** — 5 forks, see §17), Skeleton
(**Confirmed**: `.ds-skeleton`), ErrorBoundary (**Predicted** — confirmed
absent, see §17), PermissionGate wrapper, ConfirmBeforeDestroyWrapper,
OfflineBanner (**Predicted**).

---

## 5. Component Specifications

Full classification for every Business-Component-and-above unit named in §4.
Primitives and Compositions (§4.1, and simple compositions like FormField/
IconButton) are intentionally not individually tabulated here — per §2.2 they
are Design-System-Lead-owned, low-count, and low-churn; a full specification
table for them belongs in the eventual Primitives implementation pass (Phase 1,
§10), not this architecture document. The table below covers every Layout,
Navigation, Pattern-bearing, Business, and Utility component named in §4.

**Column key:** Cat=Category (§3 #) · Dom=Business Domain(s) (blueprint §3.1) ·
Roles=User roles that consume it · Usage=expected screen count at 300-screen
horizon · Pri=Priority (P0 blocking / P1 high / P2 medium / P3 low) ·
Crit=Criticality if broken (Critical/High/Medium/Low) · Cx=Complexity (XS–XL,
execution plan §10.1 scale) · Reuse/Comp/Resp=Reusable/Composable/Responsive
(Y/N) · A11y=Accessibility Level (AA baseline / AA+ = AA plus explicit
non-color-alone + reduced-motion handling, per DSA §13).

### 5.1 Layout & Navigation

| Component | Cat | Dom | Roles | Usage | Pri | Crit | Cx | Reuse | Comp | Resp | A11y | Dependencies | Consumers | Growth potential |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ApplicationShell | 2 | All | All | 7 (one/portal+Studio) | P0 | Critical | L | Y | Y | Y | AA+ | Sidebar, Topbar/BottomTabBar, NotificationBell | Every Page | Grows only with a 6th portal (rare, DSA §15) |
| Sidebar | 3 | All | Admin, TL | 2 | P0 | Critical | M | Y | N | Y | AA+ | Icon, Badge | ApplicationShell | Fixed order (D-09) caps growth — new items only |
| Topbar | 3 | All | Admin, TL | 2 | P0 | High | M | Y | Y | Y | AA+ | GlobalSearchTrigger, NotificationBell | ApplicationShell | Extend to Instructor/Parent/Student (§17) |
| BottomTabBar + MoreSheet | 3 | All | Instructor, Parent, Student | 3 | P0 | Critical | M | Y | N | Y | AA+ | Icon | ApplicationShell (mobile) | Capped at 4-5 items + More (blueprint §4.1) |
| Breadcrumb | 3 | All | Admin, TL | ~90 (all >1-level-deep pages) | P1 | Medium | S | Y | N | Y | AA | Link | DetailLayout, nested Create/Edit pages | Stable — mechanical per blueprint §4.4 |
| TabStrip (secondary nav) | 3 | Academics, People, Finance | Admin, TL | ~15 (multi-entity domains) | P1 | Medium | S | Y | N | Y | AA | — | Domain root pages | Stable |
| ContextTabs (entity nav) | 3 | All entity domains | All | ~35 (Detail Profile count) | P1 | High | S | Y | N | Y | AA | — | DetailLayout | Grows with every new entity |
| CommandPalette | 3 | All | All | 1 (global overlay) | P2 | Medium | L | Y | Y | Y | AA+ | GlobalSearchOverlay, Icon | ApplicationShell | High — absorbs nav+search+quick-actions (D-07) |
| WorkspaceLayout | 2, 9 | Academics, People, Finance | TL | 3 confirmed, ~2-4 more predicted | P1 | High | XL | Y | Y | N (desktop-only, DSA §16.2) | AA | WorkspaceListPanel, WorkspaceDetailPanel, WorkspaceActionPanel, WorkspaceDialogHost | Any future power-user surface | High — proven pattern, cheap to extend |
| TableLayout | 2 | All | All (desktop) | ~55 | P0 | Critical | L | Y | Y | Y (collapses to card list) | AA+ | FilterBar, AdvancedTable, Pagination, BulkActionBar | Every Data Table/List Page | Highest-fan-out Layout — see §9 |
| DetailLayout | 2 | All | All | ~35 | P0 | Critical | L | Y | Y | Y | AA+ | EntityHeader, ContextTabs, MetadataPanel | Every Detail Profile Page | High — grows with every new entity |
| WizardLayout | 2 | Academics, Finance, Learning Record | Admin, TL, Instructor | 5 confirmed, grows slowly | P1 | Medium | M | Y | Y | Y | AA+ | StepIndicator, ReviewStep, EntityForm | Multi-Step Wizard Pages | Low-moderate — wizards are rare by design |
| DashboardLayout | 2 | Cross-domain | All | 6 | P0 | Critical | L | Y | Y | Y | AA+ | MetricCard, ChartWrapper, ActivityFeed, TaskList, QuickActions | Every Role Dashboard | Fixed shape (blueprint §11), scope grows only |
| AuthenticationLayout | 2 | Identity & Access | All (pre-auth) | 8 | P2 | High | S | Y | N | Y | AA | LoginForm, ResetPasswordForm | Auth Pages | Stable |

### 5.2 Data Entry, Overlay, Feedback

| Component | Cat | Dom | Roles | Usage | Pri | Crit | Cx | Reuse | Comp | Resp | A11y | Dependencies | Consumers | Growth potential |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EntityForm contract | 4 | All | Admin, TL, Instructor | ~28 Single-Page + ~15 modal-migrated | P0 | Critical | L | Y | Y | Y | AA+ | TextField, Select, DatePicker, FieldError | Create/Edit Pages, Overlay-modifier variants | Highest single ROI item in the whole library — see §16 |
| MultiStepFormShell | 4 | Academics, Finance, Learning Record | Admin, TL, Instructor | 5 | P1 | Medium | M | Y | Y | Y | AA+ | StepIndicator, ReviewStep | WizardLayout | Low — wizards are rare |
| NotesEditor | 4 | People, CRM | Admin, TL, Instructor | 1 confirmed, target 3+ (Students, Leads, Instructors) | P1 | Medium | M | Y | Y | Y | AA | RichTextEditor primitive | StudentNoteModal today; target: shared across entities | High — blueprint §10 explicitly names this as a reuse target |
| Modal / Drawer | 8 | All | All | ~15+ (post-Gap#1 resolution) | P0 | Critical | M | Y | Y | Y | AA+ (focus trap) | EntityForm | Any Overlay-modifier Create/Edit | High — grows directly with Gap #1's resolution |
| ConfirmDialog | 8 | All | All | Every Delete/Archive/ledger-write | P0 | Critical | S | Y | N | Y | AA+ | Button (danger variant) | Every destructive action (blueprint §8.5) | Highest-frequency Utility-adjacent component not yet built (§17) |
| Toast | 7 | All | All | Every mutating action | P0 | High | S | Y | N | Y | AA (aria-live) | — | Every Page | Stable |
| InlineBanner | 7 | All | All | Form-level errors, warnings | P1 | High | S | Y | N | Y | AA | — | Every form, every Detail Layout | Stable |
| NotificationBell + Dropdown | 7, 12 | All | All | 5 (one/authenticated portal) | P0 | High | M | Y | Y | Y | AA+ (aria-live unread count) | Icon, Badge | ApplicationShell | High — currently 1/5 portals, extend to remaining 4 |
| BackgroundJobProgressIndicator | 7 | Learning Record, Finance | Admin, TL | ~4 (bulk cert, bulk import, exports) | P2 | Medium | M | Y | N | Y | AA | — | Bulk Certificate, Import Pages | Low-moderate |

### 5.3 Data Display & Visualization

| Component | Cat | Dom | Roles | Usage | Pri | Crit | Cx | Reuse | Comp | Resp | A11y | Dependencies | Consumers | Growth potential |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Card (`.ds-card`) | 5 | All | All | Nearly universal | P0 | Critical | XS | Y | Y | Y | AA | — | Everything | Stable, foundational |
| StatusBadge | 5 | All except Marketing/Public | Admin, TL, Instructor | ~30 statuses across ~60+ screens | P0 | Critical | S | Y | N | Y | AA+ (text+color, blueprint §10) | Semantic Tokens | Nearly every List/Detail | Extend to Parent/Student portals (§17) |
| Avatar | 5 | People | All | ~40+ (every entity card/row with a person) | P1 | Medium | XS | Y | N | Y | AA (alt text) | Icon (fallback) | StudentCard, InstructorCard, LeadCard, etc. | Consolidate 2 forks first (§17) |
| EntityHeader | 5 | All | All | ~35 (Detail Profile count) | P0 | High | M | Y | Y | Y | AA+ | StatusBadge, MetadataPanel | DetailLayout | Grows with every entity |
| MetadataPanel | 5 | All | All | ~35 | P1 | High | S | Y | N | Y | AA | RelatedEntityLinkCard | DetailLayout | Stable shape, content grows |
| RelatedEntityLinkCard | 5 | All | All | ~50+ | P1 | Medium | S | Y | N | Y | AA | Avatar, StatusBadge | DetailLayout, PortfolioGallery | High |
| ListItem | 5 | All | All | Feeds, search results, notification dropdown | P2 | Medium | XS | Y | Y | Y | AA | Avatar, Icon | ActivityFeed, GlobalSearchOverlay | Stable |
| ProfileSummary | 5 | People | Admin, TL, Instructor | ~10 | P2 | Medium | S | Y | Y | Y | AA | Avatar, StatusBadge | Detail pages, cards | Moderate |
| MetricCard / KPICard | 6 | All | All | Every Dashboard (6) + every Analytics/Reporting Page (13) | P0 | Critical | S | Y | N | Y | AA+ | TrendIndicator | DashboardLayout | Consolidate 4 existing variants first (§17) |
| ChartWrapper | 6 | Finance, Analytics, CRM | Admin, TL | 13 Analytics/Reporting Pages | P1 | High | M | Y | Y | Y | AA (data-table fallback) | `dataviz` skill output | Analytics/Reporting Pages | Governed jointly with `dataviz` |
| Sparkline | 6 | Analytics | Admin, TL | ~10 | P3 | Low | S | Y | N | Y | AA | — | MetricCard variants | Low |
| ProgressIndicator | 6 | Finance, Learning Record | All | Import/export/bulk flows, XP bars | P2 | Medium | XS | Y | N | Y | AA | — | BackgroundJobProgressIndicator, XPBar | Moderate |
| TrendIndicator | 6 | Finance, Analytics | Admin, TL | Every KPI with a comparison period | P1 | Medium | XS | Y | N | Y | AA (not color-alone) | — | MetricCard | Stable |

### 5.4 Domain Families (Education, Finance, CRM, Analytics, Portfolio, Certificates)

| Component | Cat | Dom | Roles | Usage | Pri | Crit | Cx | Reuse | Comp | Resp | A11y | Dependencies | Consumers | Growth potential |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AttendanceGrid | 14 | Academics | Admin, TL, Instructor | ~5 (Attendance List/Record Pages) | P0 | Critical | L | Y | Y | Y (card-list on mobile) | AA+ | AttendanceRow, StatusBadge | Attendance Pages | Stable — ledger-adjacent, D-06 governed |
| CalendarGrid/SchedulingView | 14 | Academics | TL, Instructor | 2 confirmed (forked) | P1 | High | L | Y | Y | Y | AA+ | SessionCard | Calendar Pages | Consolidate fork first (§17) |
| GroupScheduleCard | 14 | Academics | All | ~10 | P2 | Medium | S | Y | Y | Y | AA | StatusBadge | Group Detail, Calendar | Moderate |
| AssignmentSubmissionCard | 14 | Academics | Instructor, Student | ~8 | P1 | Medium | M | Y | Y | Y | AA | StatusBadge, Avatar | Homework/Assignment Pages | Moderate |
| GroupFinanceSection | 15 | Finance, Academics | Admin, TL | 2 (currently forked per role — Gap #2) | P0 | Critical | L | Y | Y | Y | AA+ | LedgerTable, EnrollmentBalanceCard | Group Detail Pages | Consolidation is highest-fan-out item (execution plan §11) |
| LedgerTable | 15 | Finance | Admin, TL | ~9 Finance/Ledger Surface Pages | P0 | Critical | L | Y | Y | Y | AA+ | AdvancedTable pattern | Finance Pages | High — D-06 non-optimistic-write governed |
| PaymentTimeline | 15 | Finance | All (scoped) | ~5 | P1 | High | M | Y | Y | Y | AA+ | Timeline pattern | Parent/Student/Instructor payment views | Moderate |
| ExpenseLineItem | 15 | Finance | Admin | ~3 | P2 | Medium | S | Y | N | Y | AA | — | Finance-Center Pages | Low |
| PayrollApprovalRow | 15 | Finance | Admin, TL | ~2 (Approval Queue) | P1 | High | M | Y | Y | Y | AA+ | StatusBadge, ConfirmDialog | Payroll/Approval Queue Pages | Moderate |
| EnrollmentBalanceCard | 15 | Finance, People | All (scoped) | ~10 | P0 | Critical | S | Y | Y | Y | AA+ | — | Student Detail (D-03 boundary!) | Stable — must never merge with Group status (D-03) |
| LeadCard | 16 | Growth/CRM | Admin, TL | ~5 | P1 | Medium | S | Y | Y | Y | AA | StatusBadge, Avatar | Leads List/Detail | Moderate |
| LeadFunnelChart | 16 | Growth/CRM | Admin, TL | 2 (Funnel Pages) | P1 | Medium | M | Y | Y | Y | AA (data fallback) | ChartWrapper | Leads/Funnel Pages | Low-moderate |
| ParentFeedbackCard | 12, 16 | Growth/CRM | Admin, TL | 2 (Approval Queue) | P2 | Medium | S | Y | Y | Y | AA | StatusBadge | Parent Feedback Pages | Low |
| AnalyticsWidget | 17 | Ops Intelligence | Admin, TL | 13 | P1 | High | M | Y | Y | Y | AA | ChartWrapper, MetricCard | Analytics/Reporting Pages | High — consolidates 3 overlapping analytics surfaces (execution plan Gap #3) |
| BranchPerformanceCard | 17 | Ops Intelligence | Admin | ~3 | P2 | Medium | M | Y | Y | Y | AA | AnalyticsWidget | Branch Performance Pages | Low |
| InstructorPerformanceCard | 17 | Ops Intelligence, People | Admin, TL | 2 | P2 | Medium | M | Y | Y | Y | AA | AnalyticsWidget | Performance Pages | Low |
| PortfolioGallery | 18 | Learning Record | All (scoped) | 6 | P0 | High | L | Y | Y | Y | AA+ | ProjectCard, AchievementBadge | Portfolio Pages | High — primary Student surface (blueprint §2.5) |
| ProjectCard | 18 | Learning Record | All (scoped) | Within every Portfolio Page | P1 | Medium | S | Y | Y | Y | AA | Card | PortfolioGallery | Moderate |
| AchievementBadge | 18, gamification | Learning Record | Student (primary), all (view) | Within Portfolio + Leaderboard | P1 | Medium | XS | Y | N | Y | AA+ (reduced-motion fallback, DSA §13) | — | PortfolioGallery, Leaderboard | Moderate — grows with gamification catalog |
| GamificationLeaderboardRow / XPBar / StreakIndicator | 18 | Learning Record | Student (primary) | 1 Leaderboard Page + widgets elsewhere | P2 | Medium | M | Y | Y | Y | AA+ (non-motion fallback mandatory, DSA §13/§14.3) | ProgressIndicator | Leaderboard, Dashboard, Portfolio | Moderate — celebratory-motion-governed |
| CertificatePreview | 19 | Learning Record | All (scoped) | ~6 | P1 | High | M | Y | Y | Y | AA | Card | Certificate Detail/List Pages | Moderate |
| CertificateVerificationBadge | 19 | Learning Record (public sub-surface, §5.3 blueprint correction) | Public | 1 (`/verify/[code]`) | P2 | Medium | S | Y | N | Y | AA | — | Public verification page | Low |
| BulkCertificateWizardShell | 19 | Learning Record | Admin, TL | 2 | P1 | Medium | L | Y | Y | Y | AA+ | MultiStepFormShell, ReviewStep | Bulk Certificate Pages | Low — already a proven, shipped flow |

### 5.5 Search, Filtering, Utilities

| Component | Cat | Dom | Roles | Usage | Pri | Crit | Cx | Reuse | Comp | Resp | A11y | Dependencies | Consumers | Growth potential |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GlobalSearchTrigger + Overlay | 10 | All | All | 1 global instance/portal | P1 | High | M | Y | Y | Y | AA+ | Icon, ListItem | Topbar, CommandPalette | High — feeds Command Palette (D-07) |
| InTableSearchBox | 10 | All | All (desktop) | ~55 | P1 | Medium | XS | Y | N | Y | AA | — | TableLayout | Stable |
| FilterBar / FilterChip / MoreFiltersDisclosure | 11 | All | All | ~55 | P0 | High | M | Y | Y | Y | AA+ | — | TableLayout | Stable, high-reuse |
| ColumnVisibilityToggle | 11 | All | Admin, TL | Tables with >6 columns (~20 est.) | P2 | Low | S | Y | N | Y | AA | — | TableLayout | Low |
| AdvancedTable (the shared `Table` pattern) | 2, 11 | All | All (desktop) | ~55 Data Table/List Pages | P0 | Critical | XL | Y | Y | Y (collapses to card list) | AA+ | Checkbox, Pagination, InTableSearchBox, FilterBar, StatusBadge, Skeleton, EmptyState | Every Data Table/List Page | **Highest single gap in the current codebase — does not exist yet at all (§17)** |
| Pagination | 2 | All | All | Every AdvancedTable instance | P0 | High | S | Y | N | Y | AA+ | — | AdvancedTable | Stable |
| BulkActionBar | 2 | All | Admin, TL | Tables supporting bulk actions (~15 est.) | P1 | Medium | S | Y | N | Y | AA | Checkbox | AdvancedTable | Moderate |
| EmptyState | 20 | All | All | Every list/table/detail region | P0 | High | S | Y | N | Y | AA | Illustration (Foundation) | Nearly universal | Consolidate 5 forks first (§17) |
| Skeleton | 20 | All | All | Every loading region | P0 | Critical | XS | Y | N | Y | AA (not the only loading signal) | — | Every Layout | Stable, foundational |
| ErrorBoundary | 20 | All | All | Every Page (route-level) | P0 | Critical | S | Y | N | N/A | AA | InlineBanner | Every Application | **Does not exist yet — see §17** |
| PermissionGate wrapper | 20 | All | All | Every capability-gated action/field | P0 | Critical | XS | Y | N | N/A | N/A | — | Every Business Component (DSA §6.1, D-02) | The mechanism that makes D-02 hold |
| ConfirmBeforeDestroyWrapper | 20 | All | All | Every Delete/Archive action | P0 | Critical | S | Y | N | Y | AA+ | ConfirmDialog | Every destructive action | Stable once built |
| OfflineBanner | 20 | All | All (mobile-first primarily) | 1 global instance/portal | P2 | Medium | XS | Y | N | Y | AA (aria-live) | — | ApplicationShell | Low — build once |

---

## 6. Component Relationships

Dependency trees for the highest-fan-out composite components — the ones
whose consolidation or construction unlocks the most downstream Pages.

### 6.1 AdvancedTable (the single largest gap, §17)

```
AdvancedTable
 ├── depends on: Checkbox (Foundation)
 ├── depends on: Pagination (Layout)
 ├── depends on: InTableSearchBox (Search)
 ├── depends on: FilterBar → FilterChip, MoreFiltersDisclosure (Filtering)
 ├── depends on: ColumnVisibilityToggle (Filtering)
 ├── depends on: BulkActionBar (Layout)
 ├── depends on: StatusBadge (Data Display)
 ├── depends on: Skeleton (Utilities) — loading state
 ├── depends on: EmptyState (Utilities) — true-empty and filtered-empty states
 └── depends on: ResponsiveLayout contract — collapses to a card list below tablet
       breakpoint, reusing Card + RelatedEntityLinkCard, never a horizontal scroll
       (blueprint §16.5, DSA §8 Table Layout)
```
Every one of the ~55 Data Table/List Pages consumes this one component. It has
the highest fan-out of any Business-Component-and-above unit in the entire
catalog and is why it is named P0/Critical in §5.5 despite not existing yet.

### 6.2 EntityForm (the second-largest gap)

```
EntityForm
 ├── depends on: TextField, DateField, Select, MultiSelect, FileUpload (Data Entry)
 ├── depends on: FieldError (Feedback)
 ├── depends on: InlineBanner (Feedback) — submission-level failure
 ├── depends on: StepIndicator + ReviewStep (Data Entry) — when used inside
 │     MultiStepFormShell (>8 fields or multiple concerns, blueprint §8.2)
 ├── consumed by: dedicated-route Create/Edit Pages (unchanged shape)
 └── consumed by: Modal/Drawer (Overlay) — when the field-count/concern-count
       threshold favors an Overlay modifier instead of a dedicated route
       (this is the literal mechanism resolving execution plan Gap #1, DSA §8.2)
```
One `EntityForm` contract per entity, reused unmodified between Create and
Edit (blueprint §7 — "Edit reuses Create's form component") and reused
unmodified whether it renders inside a dedicated route or inside an Overlay.

### 6.3 DetailLayout

```
DetailLayout
 ├── depends on: EntityHeader → StatusBadge, Avatar (Data Display)
 ├── depends on: ContextTabs (Navigation) — entity-internal sub-views
 ├── depends on: MetadataPanel → RelatedEntityLinkCard (Data Display)
 ├── depends on: PermissionGate wrapper (Utilities) — every action button,
 │     every editable field
 ├── depends on: History/audit-trail section (Timeline pattern) — where the
 │     entity is ledger-backed (blueprint §10, D-03/D-06 boundary)
 └── depends on: domain-family Business Components as tab content
       (e.g., GroupFinanceSection for a Group's Finance tab, PortfolioGallery
       for a Student's Portfolio tab)
```

### 6.4 WorkspaceLayout

```
WorkspaceLayout
 ├── depends on: WorkspaceListPanel — reuses AdvancedTable or a compact
 │     list variant
 ├── depends on: WorkspaceDetailPanel — reuses DetailLayout's content
 │     components without its full page chrome
 ├── depends on: WorkspaceActionPanel — quick-action buttons, scoped to
 │     the selected entity
 └── depends on: WorkspaceDialogHost — renders whichever Modal/Drawer/
       ConfirmDialog the current workspace action requires
```
Already proven three times (§4.9) with the exact `components/`/`dialogs/`/
`hooks/` colocation convention — this dependency tree formalizes what those
three instances already do in practice.

### 6.5 CommandPalette

```
CommandPalette
 ├── depends on: GlobalSearchOverlay (Search) — navigate-to-entity results
 ├── depends on: Sidebar's domain/route registry (Navigation) — navigate-to-page
 │     results
 ├── depends on: role-appropriate Quick Actions list (blueprint §11) —
 │     quick-action results
 └── renders inside: Overlay category, one shell, three result sections —
       never three competing overlays (blueprint D-07, DSA §11.1)
```

### 6.6 BulkCertificateWizardShell

```
BulkCertificateWizardShell
 ├── depends on: MultiStepFormShell (Data Entry) → StepIndicator, ReviewStep
 ├── step 1 (mode selection): same/portfolio mode — Data Entry
 ├── step 2 (recipient selection): AdvancedTable (row-select mode)
 ├── step 3 (template/content): CertificateTemplateCard, EntityForm
 └── step 4 (review, mandatory per blueprint §8.2): CertificatePreview ×N
```

### 6.7 GroupFinanceSection (the Gap #2 consolidation target)

```
GroupFinanceSection  (target: ONE component, capability-gated — DSA §3.2, D-02)
 ├── depends on: LedgerTable (Finance)
 ├── depends on: EnrollmentBalanceCard (Finance) — rendered per-student,
 │     never merged with the Group's own operational StatusBadge (D-03)
 ├── depends on: PermissionGate wrapper — Admin sees full ledger + edit;
 │     TL sees branch-scoped ledger + edit; Instructor sees read-only summary
 └── CURRENT STATE (§17): forked into GroupFinanceSection (Admin) and
       TLEnrollStudentsForm/TLAssignCourseForm (Team Leader) — no shared tree
```

---

## 7. Composition Rules

### 7.1 Atomic Composition

**Definition:** A component built by directly combining Primitives with no
intervening Pattern or Business logic (a Composition, §2.2 — `FormField`,
`IconButton`, `DismissibleChip`).

**When it should exist:** Whenever the same 2–4-Primitive combination recurs
across more than one Business Component without carrying any domain awareness.
**When it should not:** If the combination needs to know *what entity* it's
displaying (a Student's Avatar+Name+StatusBadge triple is not a Composition —
it's a Business Component, `ProfileSummary`).

### 7.2 Compound Components

**Definition:** A Business Component whose sub-parts are meant to be composed
by the consumer in a fixed relationship (e.g., `DetailLayout.Header`,
`DetailLayout.Tabs`, `DetailLayout.MetadataPanel` as named sub-exports of one
`DetailLayout` unit, rather than one monolithic component with a dozen props).

**When it should exist:** When a Layout or Business Component (§2.2) has
multiple structurally-fixed regions (per blueprint §10's Detail Page Standard)
that individually need domain content injected, but whose *arrangement*
(header above tabs above metadata) must never vary per consumer — Compound
Components make the fixed arrangement impossible to violate while still
letting each region's content differ per entity.

**When it should not:** For a Business Component with a single region and no
internal structure (e.g., `StatusBadge`) — compounding a component with only
one part adds indirection with no benefit.

### 7.3 Container Components

**Definition:** A component that owns data-fetching/state logic and passes
resolved data down to purely presentational children (e.g., a
`GroupFinanceSectionContainer` that resolves the viewer's capability and the
entity's ledger data, rendering the presentational `GroupFinanceSection` with
already-resolved props).

**When it should exist:** Whenever server-side tenancy/permission scoping
(blueprint §6.1 rule 4) needs to happen before a Business Component renders —
this is the mechanical pattern that keeps "the component trusts what it
receives" (DSA §18.3) true: the Container is the only place a data-scoping
decision is made, the presentational component never re-filters.

**When it should not:** For Primitives, Compositions, and most Patterns —
these should stay stateless and receive everything via props.

### 7.4 Domain Components

Per §3.1 and §6's dependency trees — entity-specific, composed from every
layer below, created **per entity, never per role** (DSA §2.8, D-02). This is
where §17's Gap #2 (`GroupFinanceSection` vs. `TLEnrollStudentsForm`) is
formally, permanently resolved: the correct Domain Component count for "a
Group's finance section" is exactly one, for all time, regardless of how many
roles view it.

### 7.5 Shared Components

Any component consumed by more than one Application (portal). The default
assumption for every Business Component and above (DSA D-02) — a component is
*not* shared only when a genuine, documented, permission-driven reason exists
(and that reason is a capability check inside the shared component, not a
second component file, per §7.4).

### 7.6 Workspace Components

Per §4.9/§6.4 — reserved exclusively for power-user, multi-panel surfaces
matching blueprint's Progressive Disclosure escape-hatch (DSA §2.7). A
Workspace Component is never the *default* entry point for an entity (that's
DetailLayout/TableLayout) — it is the deliberate, opt-in surface for roles
that live inside one domain all day (Team Leader, per blueprint §2.2).

### 7.7 When each should exist — decision heuristic

1. Does it need domain/entity knowledge? No → Primitive or Composition.
   Yes → continue.
2. Does it define a reusable *behavior contract* (sort/filter/paginate,
   confirm-then-destroy, step-validate-review) rather than a specific
   entity's content? → Pattern.
3. Is it entity-specific content composed from Primitives/Compositions/
   Patterns? → Business Component (in its domain family, §3.1), built as a
   Compound Component if it has multiple fixed regions, wrapped in a
   Container Component if it owns data-fetching/permission-resolution.
4. Does it define a full-page structural shape? → Template/Layout.
5. Is it a multi-panel, power-user, opt-in surface? → Workspace.

---

## 8. Domain Components

Why generic Data Display/Data Entry/Layout components are **insufficient** on
their own for each of the eight domain families named in DSA §6.1 and split
in §3.1 of this document:

### 8.1 Education

A generic `Table` cannot express attendance semantics (present/absent/late/
excused/makeup are not arbitrary strings — they drive payroll calculations and
student-visibility rules per Phase XVI/XVIII memory) or the group-vs-
enrollment separation (blueprint §10.1, D-03) that must be visually enforced,
not just functionally correct. `AttendanceGrid` and `EnrollmentBalanceCard`
exist specifically to make that separation *impossible to accidentally merge*
in a new screen — a generic table would let a builder put both in one column.

### 8.2 Finance

Ledger-adjacent data has a hard behavioral constraint no generic Data Entry
or Data Display component enforces on its own: never-optimistic writes
(blueprint D-06, DSA §14.2's motion-tier prohibition). `LedgerTable` and
`PayrollApprovalRow` exist to bake that constraint into the component itself —
so no future screen can accidentally apply optimistic UI to a financial write
just because the generic `AdvancedTable` pattern happens to support it
elsewhere.

### 8.3 CRM

Lead/funnel data is inherently stage-sequenced (blueprint Domain 5) in a way
a generic list is blind to — `ConversionStageIndicator` and `LeadFunnelChart`
encode the funnel's actual stage order once, so every consuming screen shows
leads progressing through the *same* stage sequence rather than each screen
inventing its own stage vocabulary.

### 8.4 Analytics

Cross-branch/cross-role comparison (blueprint Domain 6) requires a component
that knows the difference between "my own history over time" (a Chart trend)
and "me vs. my peers" (a Comparison View, DSA §10) — collapsing both into one
generic Chart component is precisely the mistake DSA §10's decision heuristic
warns against.

### 8.5 Portfolio

Achievement/celebration content (blueprint's Learning Record domain) carries
an emotional-design requirement (DSA §14.1's "emotional payoff" motion
rationale, reserved exclusively for this domain per §14.3 tier 4) that a
generic Card cannot express safely — a generic Card used for a badge unlock
would either under-deliver the celebratory moment or, worse, leak Celebratory
motion into a Finance/Governance context if reused carelessly. A dedicated
`AchievementBadge` scopes that motion tier structurally.

### 8.6 Certificates

A certificate is simultaneously an internal administrative record (Admin/TL
view) and a public, verifiable artifact (`/verify/[code]`, blueprint §3.1
correction, §5.3). No generic Data Display component encodes "this same data
has two audiences with two different trust/verification framings" —
`CertificatePreview` and `CertificateVerificationBadge` are deliberately two
separate Business Components even though they render overlapping data,
because their consumers (internal staff vs. an anonymous public verifier) have
fundamentally different context and trust requirements.

### 8.7 Notifications (cross-cutting, Communication category)

A generic Toast cannot carry the persistence, grouping-by-domain, and
deep-linking requirements blueprint §12 places on System Notifications — this
is why `NotificationBell + Dropdown` is its own Business Component rather than
"a Toast that doesn't auto-dismiss."

### 8.8 Gamification (cross-cutting, within Portfolio family)

XP/streaks/leaderboard data requires components that are simultaneously
motion-expressive (DSA §14.1, §14.3 tier 4) and rigorously
reduced-motion-safe (DSA §13) in a way no other domain family needs — a
generic ProgressIndicator has no concept of "this number going up is a reward,
not just a status change," and would need per-instance reduced-motion
handling that a dedicated `XPBar`/`StreakIndicator` bakes in once.

---

## 9. Shared Component Analysis

Reuse estimates are grounded in `ux-execution-plan.md`'s verified route/
template counts (181 routes today, ~55 Data Table/List, ~35 Detail Profile, 6
Dashboards, 5 Wizards, 3 Workspaces, 13 Analytics/Reporting) projected to the
300+-screen horizon at the same domain proportions (execution plan §5.1).

### 9.1 Reuse ranking

| Rank | Component | Screens today (of 181) | Est. % of 300+ horizon | Rationale |
|---|---|---|---|---|
| **Critical** | AdvancedTable | ~55 | ~30% | Every Data Table/List Page across all 10 domains, every role |
| **Critical** | StatusBadge | ~60+ (List + Detail combined) | ~35% | Nearly universal status representation; only gap is Parent/Student portals (§17) |
| **Critical** | EntityForm | ~43 (28 single-page + 15 modal-migrated) | ~25% | Every Create/Edit surface, regardless of Gap #1's resolution |
| **Critical** | DetailLayout | ~35 | ~20% | Every entity detail page |
| **Critical** | Card (`.ds-card`) | Near-universal | ~90%+ | Foundational visual container beneath nearly every composed unit |
| **Critical** | Skeleton | Near-universal | ~90%+ | Every loading region, per DSA §12 rule |
| **High** | EmptyState | ~55+ | ~30% | Every list/table region + many detail sub-sections |
| **High** | FilterBar/FilterChip | ~55 | ~30% | Every Data Table/List Page |
| **High** | ConfirmDialog | Every Delete/Archive + ledger action | ~25% | Blueprint §8.5's confirmation requirement is universal |
| **High** | NotificationBell | 1/5 portals today → target 5/5 | ~3% (screen count) but touches every session for every role | Low screen-count, near-100% session-frequency — see note below |
| **High** | PermissionGate wrapper | Every capability-gated action | ~40%+ (as an invisible dependency, not a visible screen) | The mechanism underlying D-02 across the entire library |
| **Medium** | WorkspaceLayout | 3 confirmed | ~2% | High-value but intentionally rare (Progressive Disclosure escape hatch, §7.6) |
| **Medium** | ChartWrapper / AnalyticsWidget | 13 | ~7% | Concentrated in Operations Intelligence + Finance dashboards |
| **Medium** | PortfolioGallery / CertificatePreview | ~12 combined | ~7% | Concentrated in Learning Record domain |
| **Medium** | CalendarGrid | 2 confirmed, forked | ~1% | Low count, but on the highest-frequency daily-use path (blueprint §1.2 goal #1) — criticality outweighs raw count |
| **Low** | BulkCertificateWizardShell | 2 | <1% | Narrow, already-shipped, stable |
| **Low** | LeadFunnelChart | 2 | <1% | Narrow to Growth/CRM domain |
| **Low** | GovernanceWidgets (system-health specific) | 5 | ~3% | HQ-only, narrow audience, low change velocity |

**Note on frequency vs. screen-count:** `NotificationBell` and
`PermissionGate` rank High despite low *screen* counts because their actual
usage metric is *session frequency* (every authenticated session touches
both) or *invisible ubiquity* (PermissionGate is a wrapper inside dozens of
other components, not a screen of its own). Ranking by raw screen count alone
would under-value exactly the components whose correctness matters most.

### 9.2 What this ranking implies for build order

The Critical tier (§10, Phase 1–4) is small (6 components) but accounts for an
estimated 60–70% of all component-instance renders across the product at the
300-screen horizon — confirming DSA §2.2's scaling principle: invest deepest
where the product already concentrates (Academics/People, execution plan
§5.1), and the Critical tier above is exactly that concentration expressed at
the component level.

---

## 10. Implementation Order

Phases are sequenced to match `ux-execution-plan.md` §9's Wave 1–5 (this
document does not re-sequence the waves — it names which *components*,
specifically, unblock each wave).

### Phase 1 — Foundation

Primitives (§4.1), Compositions (§2.2 examples), Semantic Token wiring (DSA
§5.3, unchanged). **Why first:** every layer above depends on these; DSA §3.1
already establishes Foundation as the rarest-changing, highest-fan-out layer.
Corresponds to execution plan Wave 1's prerequisite state, not a named Wave
item itself — it's the substrate Wave 1's decisions get built on.

### Phase 2 — Navigation

Sidebar, Topbar (already Confirmed), Breadcrumb, TabStrip, ContextTabs,
BottomTabBar+MoreSheet, then CommandPalette (execution plan Wave 1 item 3,
D-07). **Why second:** Navigation is consumed by every other Layout/Template
and is the cheapest layer to get wrong expensively (a Sidebar reorder touches
every portal at once, per D-09) — stabilize it before building the
higher-traffic Table/Form layers on top of it.

### Phase 3 — Forms

EntityForm contract, MultiStepFormShell, ConfirmDialog, Modal/Drawer. **Why
third, and why before Tables:** this phase directly implements execution plan
Wave 1 item 1 (resolve modal-vs-route Gap #1) — the EntityForm contract must
exist and be stable *before* Gap #1's resolution can be executed, since
whichever option wins (dedicated route or Overlay-modifier), it reuses the
same EntityForm underneath (§6.2). Building Forms before Tables also lets
AdvancedTable's row-action Create/Edit affordances (Phase 4) target an
already-stable Overlay contract instead of guessing at one.

### Phase 4 — Tables

AdvancedTable, Pagination, FilterBar/FilterChip, ColumnVisibilityToggle,
BulkActionBar. **Why fourth:** this is the single highest-fan-out gap in the
current codebase (§6.1, §9) — ~55 Data Table/List Pages today, no shared
implementation. Sequenced after Forms because AdvancedTable's row actions
compose Modal/ConfirmDialog from Phase 3.

### Phase 5 — Workspace

WorkspaceLayout formalization (already proven 3×, §4.9) + the Group/Student
component consolidation named in execution plan Wave 1 item 2 (Gap #2). **Why
fifth:** Workspace surfaces already reuse Table/Form internals (§6.4) — they
cannot be formalized until Phases 3–4 are stable, and Gap #2's consolidation
(the highest-fan-out entity, Group, per execution plan §11) is the highest-ROI
single item in this phase.

### Phase 6 — Domain Components

Education, Finance, CRM, Analytics, Portfolio, Certificates families (§3.1,
§8) built out entity-by-entity, in the order Academics → People → Finance →
Learning Record → Growth → Operations Intelligence — mirroring execution plan
§5.1's route-count ranking (largest domains first) and Wave 2–4's sequencing
exactly. **Why sixth, not earlier:** every Domain Component in this phase
composes from Phases 1–5's Primitives/Patterns/Table/Form/Workspace layers —
building them earlier would mean building on an unstable foundation, the
precise mistake DSA §3.2 warns against.

### Phase 7 — Templates

Formal documentation/enforcement of the 8 Layout Architecture archetypes (DSA
§8) as buildable, reusable shells once every category of content they host
(Phases 1–6) is stable. **Why last:** Templates are compositions of
everything above them (§2.1) — templating before the components they host
exist would produce empty shells with no proof they actually fit real
content, inverting the dependency the whole document is built on.

### 10.1 Why this order, restated against ROI

| Phase | Blocks | Unblocked by |
|---|---|---|
| 1 Foundation | Everything | Nothing — first |
| 2 Navigation | Command Palette (D-07), every Application Shell | Phase 1 |
| 3 Forms | Gap #1 resolution, every Create/Edit surface | Phases 1-2 |
| 4 Tables | Every List/Table Page (30%+ of the product, §9) | Phase 3 (Overlay reuse) |
| 5 Workspace | Gap #2 resolution, every future power-user surface | Phases 3-4 |
| 6 Domain Components | Every entity-specific screen | Phases 1-5 |
| 7 Templates | Formal, enforceable Page-building for the remaining 200+ future routes | Phase 6 |

---

## 11. Component Lifecycle

### 11.1 States

| State | Definition | Entry criteria | Exit criteria |
|---|---|---|---|
| **Draft** | Proposed, not yet reviewed against §15's Quality Gates. | A builder identifies a genuine gap (§4 "Predicted" marker) and proposes a named unit. | Passes Quality Gates → Experimental. Rejected (existing unit could be extended instead, §7.7) → discarded, never merged. |
| **Experimental** | Built, passing Quality Gates, in use on ≤2 Pages, contract not yet proven stable. | Draft passes review. | ≥3 consuming Pages with no contract change needed → Stable. Contract needs to change → stays Experimental, iterate. |
| **Stable** | Proven contract, DSA §16.3 "API Stability" applies fully — changes are additive-only without a Breaking Change process. | ≥3 consuming Pages, contract unchanged for one full Wave (execution plan §9). | A newer pattern supersedes it → Deprecated. |
| **Deprecated** | Marked for replacement; still fully functional; new consumers should not adopt it. | A Stable component is superseded (e.g., a role-forked pair is being consolidated per Gap #2). | One full migration cycle elapses with the replacement proven (DSA §16.4) → Legacy. |
| **Legacy** | No longer the recommended pattern; kept working for existing consumers only; telemetry-tracked per the execution plan's own redirect-governance recommendation (§13.2 of that document, applied here at the component layer). | Deprecation cycle completes. | Zero remaining consumers, confirmed → Archived. |
| **Archived** | Removed from active use; code may remain for historical/rollback reference for one release cycle. | Zero consumers confirmed via a dependency check (§6's trees make this checkable). | One release cycle with no regression reports → Removal. |
| **Removal** | Deleted from the codebase entirely. | Archived state elapses cleanly. | N/A — terminal. |

### 11.2 Migration rule

Per DSA §16.5 (Breaking Changes), a component entering Deprecated state
requires: (1) a decision-log entry (this document's §17, extended, is that
log for component-level decisions — mirroring blueprint §19 and DSA §16.2's
identical discipline at their respective layers), (2) every known consumer
named (cheap today at 181 routes if the Component Taxonomy, §3–§6, has been
followed — DSA §16.5's own point, restated here), and (3) the migration
executing atomically with the deprecation, never "we'll migrate the rest
later."

### 11.3 Who moves a component between states

Same ownership model as DSA §16.1 — whoever is actively working on the
component for that session is, for that change, the Design System Lead. No
component sits in Draft or Experimental indefinitely by default neglect; a
component with no state change for an extended period during active
development on its domain is a signal to re-evaluate, not a stable outcome to
assume.

---

## 12. Accessibility Requirements

Per DSA §13 (Accessibility Architecture, unchanged, inherited in full) and
blueprint §17 — every component in this catalog must declare its answer to
each row below **at the Primitive/Pattern layer, not re-verified per Page**
(DSA §2.4). This table states the requirement categories every component
specification (§5) implicitly carries; §15's Quality Gates check for their
presence, not re-derive them.

| Concern | What every component must declare | Where enforced |
|---|---|---|
| **Keyboard** | Full Tab/Shift+Tab/Enter/Escape/Arrow operability, visible focus outline, no `outline: none` without replacement. | Primitive layer (Button, Input, custom Select) — inherited by every consumer |
| **ARIA** | Semantic HTML first; ARIA roles only for genuine gaps (custom dropdowns, tabs, dialogs, per DSA §17 restated at this layer). | Pattern layer (custom Tab/Dialog/Combobox patterns) |
| **Focus** | Always visually distinct from Hover (DSA §7.2); Modal/Drawer/Dialog traps focus until dismissed. | Overlay category components |
| **Touch** | 44×44px minimum on any mobile-first surface (Touch density, DSA §9); every hover-revealed control has a touch-visible equivalent (DSA §7.1). | Foundation Sizing category + every Data Display/Table row action |
| **Screen Readers** | Every icon-only control carries an accessible label; dynamic content (Toast, live counts, Refreshing state) uses `aria-live`. | Feedback category, Data Visualization (TrendIndicator, NotificationBell unread count) |
| **RTL** | Logical properties only (`padding-inline-start`, never `padding-left`) for any directional CSS — a Component Taxonomy-wide gate (DSA §13), not a per-file convention. | Every category with directional layout (Layout, Data Entry, Navigation especially) |
| **Localization** | Every string externalized, never hardcoded — proven infrastructure exists (`LanguageProvider`/Cairo font swap, DSA §13); no new component may regress it. | Every category with visible text |
| **Reduced Motion** | Every Motion-tier transition has a `prefers-reduced-motion`-respecting fallback that still communicates outcome — mandatory, not optional, for Celebratory-tier components (AchievementBadge, XPBar, StreakIndicator, §8.8). | Portfolio/gamification family specifically; Motion Foundation category generally |

### 12.1 Accessibility Level shorthand used in §5

- **AA** = WCAG 2.1 AA baseline (contrast, keyboard, screen-reader label) —
  the floor for every component in the catalog, no exceptions.
- **AA+** = AA baseline plus an explicit non-color-alone signal (shape/icon/
  weight change alongside any color-based state, DSA §7.2 Selected-state
  rule) and, where the component carries motion, an explicit reduced-motion
  fallback (DSA §13). Required for every Overlay, every Feedback component
  carrying `aria-live`, every StatusBadge-adjacent Data Display component, and
  every gamification/Celebratory-tier component.

---

## 13. Responsive Strategy

Inherits DSA §8 (Layout Architecture's Responsive Layout archetype), §9
(Information Density Strategy's four densities), and blueprint §16 in full —
this section states how the *component catalog specifically* adapts, not a
new responsive system.

### 13.1 Desktop

Full AdvancedTable density (Dense/Comfortable per persona, DSA §9.1),
multi-column DashboardLayout, WorkspaceLayout (desktop-only by design, §7.6).
Primary target for Admin/Team-Leader analytical Business Components
(AnalyticsWidget, LedgerTable, BranchPerformanceCard).

### 13.2 Tablet

The realistic device for Team Leader/Instructor in-branch use (blueprint
§16.3). AdvancedTable reduces visible columns via ColumnVisibilityToggle
rather than shrinking font size; Sidebar collapses to icons-with-labels-on-tap
or a condensed rail; WorkspaceLayout shifts toward Compact density (DSA §9.3)
rather than rendering at full desktop density.

### 13.3 Mobile

BottomTabBar+MoreSheet replaces Sidebar entirely (blueprint §4.1);
AdvancedTable collapses to a card list built from Card + RelatedEntityLinkCard
(blueprint §16.5, §6.1's dependency tree) — never a horizontal-scroll grid;
MultiStepFormShell renders sequential full-width blocks per step (blueprint
§16.4); every touch-actionable component enforces the Touch density's 44×44px
minimum unconditionally (DSA §9.1/§9.3 — Instructor and Student personas get
no exception, even on a tablet-width device, per blueprint §16.3).

### 13.4 Large screens

Not a persona split in the blueprint (only Desktop/Tablet/Mobile, §16.1) —
handled at the Grid Foundation category (DSA §4) as a wide-viewport
column-count ceiling (DashboardLayout and AdvancedTable cap their column
growth rather than stretching indefinitely), a component-catalog-level
clarification rather than a new tier, since DSA's Breakpoints category (§4)
is the join point and this document does not introduce a fourth persona tier
the blueprint doesn't already define.

### 13.5 How components adapt — the mechanism

Per DSA §9.2 (Density is a Token, not a component fork) and §5.5 (Application
Tokens): no component in this catalog is ever reimplemented per breakpoint or
per persona. `AdvancedTable` is one component whose row-height, column-count,
and card-collapse behavior resolve from Application/Density Tokens at the
portal boundary — this is the direct, catalog-level enforcement of DSA's
Composition over Duplication principle (§2.8) applied to responsiveness
specifically: four densities and three breakpoints must never produce twelve
`Table` components.

---

## 14. AI Rules

Direct extension of `design-system-architecture.md` §17 (AI Development
Rules), restated here with this document's catalog as the concrete artifact
those rules point at.

### MUST

1. **Search this document's §4/§5 before proposing any new component.** If a
   named unit (Confirmed or Predicted) already covers the need, extend it
   additively (DSA §16.3) — never fork it.
2. **Compose from the layer stack (§2), never skip a layer.** A Page never
   invents Layout structure; a Business Component never hardcodes a Primitive
   value; a Pattern never contains entity-specific logic.
3. **Extend existing Business Components via capability checks** (blueprint
   §6.1, DSA D-02) when a new role needs different behavior from an existing
   entity's component — never create a second, role-named component file
   (`TLGroupFinanceSection`, `AdminGroupFinanceSection` are both violations of
   the same rule that already produced Gap #2).
4. **When a genuinely new component is needed** (§4 has no Predicted entry
   and no existing entry is extensible), build it once, classify it fully per
   §5's field set, and add it to this document in the same change — per DSA
   §16.2's identical discipline at the Foundation/Components/Templates layer.
5. **Check the Component Lifecycle state (§11)** before building on top of a
   Deprecated or Legacy component — build against its replacement instead, or
   flag that no replacement yet exists.

### MUST NEVER

1. **Never build a second Business Component for the same entity to serve a
   different role.** This is the single most consequential rule in this
   document, inherited directly from DSA D-02, because it is the literal
   mechanism by which execution plan Gap #2 occurred.
2. **Never invent an 18th Template or a 21st Taxonomy category without a
   Governance-level check** (DSA §16.2, §17.3) — 17 Templates already cover
   181 routes; a genuinely novel structural need is rare and should feel rare.
3. **Never skip §5's classification when adding a component** — an
   unclassified component (no domain, no role, no dependency list) is
   invisible to the next session's "check before building" step (§17.1 of
   DSA), which defeats this document's entire purpose.
4. **Never mark a component Stable (§11.1) without at least 3 real
   consumers** — a single-consumer component is still Experimental by
   definition, regardless of how confident its author is in its contract.
5. **Never let a component fork silently exist in two Application
   (portal) contexts without either (a) a documented capability-check reason
   or (b) a logged Deprecation of one in favor of the other** (§11.2).

---

## 15. Quality Gates

Every new or modified component must pass all eight gates before merge —
direct extension of DSA §18's Quality Checklist, restated as gates specific to
component-library work (as opposed to DSA §18's Page/Screen-level checklist).

### 15.1 Architecture Review

- [ ] Placed at the correct layer (§2) and, if a Business Component, the
      correct domain family (§3.1).
- [ ] Composition direction is one-way (§6.2 of DSA, restated §7.7) — no
      lower-layer component imports a higher-layer one.

### 15.2 UX Review

- [ ] Behavior matches the blueprint rule it implements (every component's
      "Purpose" in §5 traces to a named blueprint section).
- [ ] If entity-specific, the Groups-vs-Enrollments separation (D-03) is
      preserved wherever both concepts could appear (§8.1's Education
      rationale).

### 15.3 Accessibility Review

- [ ] Passes every applicable row in §12's table.
- [ ] Accessibility Level (§12.1) matches or exceeds the level declared in
      §5's catalog entry.

### 15.4 Responsive Review

- [ ] Adapts per §13's mechanism (Density/Application Tokens), not a
      per-breakpoint fork.
- [ ] If a Table-family component, collapses to a card list below tablet
      per §13.3 — never a horizontal scroll.

### 15.5 Performance Review

- [ ] Respects the per-persona performance budget (DSA §2.5) — no heavy
      dependency added to an Instructor/Parent/Student-consumed component's
      bundle.
- [ ] Motion (if any) matches the correct tier (DSA §14.3) for its consuming
      domain — no Celebratory motion outside Portfolio/gamification, no
      motion beyond quiet state-change in Finance/Governance.

### 15.6 Composition Review

- [ ] No existing component (§4/§5) could have been extended additively
      instead (§7.7, §14 MUST #1).
- [ ] No role-specific fork was created (§14 MUST NEVER #1).

### 15.7 Documentation Review

- [ ] §5's full field set is populated for the new/changed component.
- [ ] If this is a Breaking Change (DSA §16.3), a migration plan naming every
      known consumer exists and executed atomically (§11.2).

### 15.8 Reuse Review

- [ ] The component's Reuse/Composable columns (§5) reflect its actual,
      verified consumer count — not an aspirational estimate.
- [ ] The Lifecycle state (§11.1) is accurate (not prematurely marked
      Stable, per §14 MUST NEVER #4).

---

## 16. Implementation Readiness

### 16.1 Which components unlock what

| Component | Unlocks (Templates) | Unlocks (Pages) | Unlocks (Features/Modules) |
|---|---|---|---|
| **AdvancedTable** | Data Table/List Template (all ~55 instances) | Every List Page across all 10 domains | Every future entity's List view, by construction |
| **EntityForm** | Single-Page Form + Multi-Step Wizard Templates | Every Create/Edit Page (~43+) | Resolves execution plan Gap #1 mechanically once built (§6.2) |
| **DetailLayout** | Detail Profile Template (~35 instances) | Every entity Detail Page | Every future entity's Detail view |
| **GroupFinanceSection (consolidated)** | — | Group Detail (Admin + TL) | Resolves execution plan Gap #2's single highest-fan-out case (§6.7) |
| **NotificationBell (cross-role)** | — | Every authenticated Page (persistent chrome) | Extends blueprint §12's System Notifications to 4 currently-missing portals |
| **CommandPalette** | — | Global overlay, every authenticated Page | Resolves D-07's open architectural item |
| **WorkspaceLayout (formalized)** | Workspace Template | Groups/Instructors/Payroll (proven) + any 4th future instance | Every future power-user surface, cheaply |
| **PortfolioGallery + CertificatePreview** | Portfolio/Timeline Template | ~12 Learning Record Pages | Unlocks the Student persona's primary surface (blueprint §2.5) at full quality |

### 16.2 ROI ranking

| Rank | Item | Why highest ROI |
|---|---|---|
| 1 | **AdvancedTable** | Zero shared implementation exists today (§17) against ~55 consuming Pages (~30% of the product) — the single largest gap-to-impact ratio in the entire catalog. |
| 2 | **EntityForm + Overlay resolution** | Directly resolves execution plan Gap #1 (a named, high-priority, currently-unresolved architectural ambiguity) for ~43 Pages at once. |
| 3 | **GroupFinanceSection consolidation** | Resolves execution plan Gap #2's highest-fan-out entity (Group, per execution plan §11) — the single most cross-referenced entity in the product. |
| 4 | **NotificationBell cross-role extension** | Low build cost (extending a proven pattern, not inventing one) against near-100%-of-sessions reach (§9.1 note). |
| 5 | **EmptyState/Avatar/MetricCard consolidation** | Each is cheap individually (3–5 forks to merge into 1) but compounds — three separate small consolidations that each remove a "which one do I use" decision from every future builder. |
| 6 | **CommandPalette** | Highest novelty (net-new Overlay surface, DSA §15) but explicitly sequenced after the above because nothing else depends on it (execution plan §11's dependency graph). |
| 7 | **Domain family build-out (Phase 6)** | Highest total component count, but each individual item's ROI is entity-scoped rather than product-wide — correctly sequenced last per §10. |

---

## 17. Gap Analysis

Every gap below was verified directly against the repository on 2026-07-11 —
not inferred from the prior three documents alone. Several gaps here are
**more severe** than `ux-execution-plan.md` §12 (Design System Readiness)
characterized them, because that document's own §12 explicitly flagged
several of these as "not independently verified in this pass" — this document
performed that verification.

### Gap #A — No shared `Table`/`AdvancedTable` component exists

**CURRENT STATE:** Verified: every list page builds its own table.
`GroupStudentsTable` exists as **two different files** with the identical name
under `app/admin/groups/[id]/` and `app/portal/team-leader/groups/workspace/
components/`. Additional independent implementations confirmed:
`FinanceTableClient.tsx`, `StudentOpsTable.tsx`, `LeadsTableClient.tsx`,
`OperationalTable.tsx`, `BranchPerformanceTable.tsx`. `ux-execution-plan.md`
§12 flagged this as "partially implied... not independently verified" — it is
now confirmed there is no shared table primitive at all.

**RECOMMENDED STATE:** Build `AdvancedTable` (§5.5, §6.1) as a single shared
Pattern+Business-Component pair; migrate the ~55 Data Table/List Pages onto it
incrementally, entity by entity, starting with Group (highest fan-out) and
Student (second-highest, execution plan §11).

- **Why current is weaker:** A fix to sort/filter/pagination behavior applied
  to one of these six-plus independent implementations has zero chance of
  reaching the other five — the exact drift blueprint §1.4 warns against.
- **Risk:** High if left unaddressed — every future List Page compounds the
  fragmentation rather than shrinking it.
- **Migration cost:** High — largest single component-migration effort in
  this document (Phase 4, §10), but the cost only grows the longer it's
  deferred (more independent implementations to reconcile).
- **Priority:** P0 — named first in §10's Phase 4 and ranked #1 in §16.2's
  ROI ranking.
- **Business impact:** Directly blocks the "route #200 as cheap as route #20"
  goal (blueprint §1.2 goal #5) for the largest single template category in
  the product.

### Gap #B — `EntityForm`/Overlay contract does not exist; Create/Edit logic is fragmented per entity

**CURRENT STATE:** Confirms execution plan §7.3's finding at the component
level — no shared form component exists across modal-migrated and
dedicated-route entities.

**RECOMMENDED STATE:** Build `EntityForm` (§6.2) once Gap #1's modal-vs-route
decision (execution plan §13.1) is made by the team — this document takes no
position on *which* option wins, consistent with the execution plan's own
neutrality on that question (per blueprint §20 MUST #10).

- **Why current is weaker:** Whichever option the team picks, building it
  without a shared form contract first means re-litigating field-level
  validation/error-handling logic per entity, indefinitely.
- **Risk:** Medium — the ambiguity itself (not the eventual choice) is the
  active cost, exactly as execution plan §13.1 already states.
- **Migration cost:** Medium — building EntityForm is independent of which
  Gap #1 option wins (§6.2); only the *container* (route vs. Overlay) differs.
- **Priority:** P0 — Phase 3 (§10), second in ROI ranking (§16.2).
- **Business impact:** Blocks a clean resolution of Gap #1, which the
  execution plan already rates High priority.

### Gap #C — `Avatar`, `EmptyState`, and `MetricCard`/`KpiCard`/`StatCard` are each forked multiple times

**CURRENT STATE (verified):**
- `Avatar`: 2 independent implementations (`instructors/workspace/components/
  Avatar.tsx`, `payroll/workspace/components/Avatar.tsx`).
- `EmptyState`: 5 independent implementations (`components/admin/
  EmptyState.tsx`, `_components/ui/EmptyState.tsx`, `payroll/workspace/
  components/EmptyState.tsx`, `components/ui/SectionEmptyState.tsx`,
  `components/studio/EmptyStateCard.tsx`) — though `components/admin/
  EmptyState.tsx` is confirmed reused cross-portal (imported by the
  Instructor calendar page), showing partial, inconsistent consolidation.
- `MetricCard`/KPI family: `components/admin/KpiCard.tsx` plus three separate
  `StatCard` forks (`instructors/workspace/components/`, `_components/ui/`,
  `components/studio/`).

**RECOMMENDED STATE:** Consolidate each family into one Data Display/Data
Visualization component (§5.3), capability- and content-parameterized, not
role-forked.

- **Why current is weaker:** Three separate small duplications, individually
  low-severity, compound into a real "which one do I import" decision cost
  for every future builder (human or AI) touching any card/badge/metric
  surface — precisely the drift DSA §1.1 identifies as the root problem this
  entire document exists to prevent.
- **Risk:** Low-Medium individually; Medium in aggregate (three simultaneous
  small forks signal the underlying discipline gap is systemic, not isolated).
- **Migration cost:** Low per-family, moderate in aggregate (3 separate,
  independent consolidation efforts).
- **Priority:** P1 — named as ROI rank #5 (§16.2), bundled together because
  each is cheap and their combined signal value (closing the "is this
  systemic" question) exceeds their individual value.
- **Business impact:** Low immediate user-facing impact; high long-term
  maintenance-cost impact if left to compound to 5+ forks each at the
  300-screen horizon.

### Gap #D — `ErrorBoundary` does not exist anywhere in the codebase

**CURRENT STATE (verified):** No route-level or component-level error
boundary was found anywhere in the repository.

**RECOMMENDED STATE:** Build a shared `ErrorBoundary` Utility (§5.5) and wrap
every Application's route tree with it, per blueprint §15's "500/unexpected
server error" standard (a calm, branded error state, never a raw stack
trace).

- **Why current is weaker:** Blueprint §15 already mandates this exact
  behavior; without an `ErrorBoundary` component, every Page that wants to
  comply must hand-roll the behavior individually, which is both wasted
  effort and a compliance risk (a Page that forgets to hand-roll it ships a
  raw error to a parent or student).
- **Risk:** Medium-High — a raw stack trace reaching a Parent or Student user
  is a direct, named violation of blueprint §15's universal error strategy.
- **Migration cost:** Low — this is a net-new, self-contained Utility with no
  existing consumers to migrate, only new adoption.
- **Priority:** P0 — cheap to build, closes a real compliance gap; sequence
  in Phase 1 (§10) alongside other Utilities, ahead of Phase 6's
  domain-specific work.
- **Business impact:** Directly protects blueprint §15's trust-preserving
  error strategy, which the blueprint itself frames as load-bearing for
  parent/student trust (blueprint §1.2 goal #4).

### Gap #E — `ConfirmDialog` does not exist as a standalone, reusable component

**CURRENT STATE (verified):** Confirmation logic is inline and
component-specific (e.g., inline confirm state inside
`InstructorsWorkspaceClient.tsx`) rather than a shared Overlay component.

**RECOMMENDED STATE:** Build a shared `ConfirmDialog` (§5.2, §6's dependency
trees) that every Delete/Archive/ledger-adjacent action composes, per
blueprint §8.5's exact confirmation-copy requirements (names the specific
entity, states the consequence, danger-styled primary action, no
Enter-to-confirm).

- **Why current is weaker:** Blueprint §8.5's confirmation-copy rules
  currently depend on every individual implementation independently
  remembering to follow them — a single shared component makes the rule
  impossible to violate by omission.
- **Risk:** Medium — an inconsistent or missing confirmation on a
  destructive/financial action directly contradicts blueprint §5 principle 4
  ("never reduce steps for irreversible... actions").
- **Migration cost:** Low-Medium — build once, then migrate each inline
  confirm implementation onto it opportunistically as those Pages are
  touched for other reasons (does not require a dedicated migration sweep).
- **Priority:** P0 — Phase 3 (§10), bundled with EntityForm/Modal work since
  it shares the Overlay category and dependency surface.
- **Business impact:** Closes a real, named blueprint-compliance gap
  (§8.5) with low build cost.

### Gap #F — `NotificationBell` is Instructor-portal-only, not the cross-role pattern the blueprint describes

**CURRENT STATE (verified):** `components/portal/instructor/
NotificationBell.tsx` is confirmed to exist and is used exclusively inside
`InstructorShell.tsx`. No notification bell component or usage was found
anywhere under `/portal/team-leader`, contrary to blueprint §12's framing
("the existing bell/notification-dropdown pattern, already built for Team
Leader") and this document's own memory-derived assumption prior to
verification.

**RECOMMENDED STATE:** This is flagged as a factual correction requiring
reconciliation, per blueprint §20 MUST #10 ("when in doubt... ask the user
rather than silently choosing") — it does not contradict blueprint §12's
*behavioral* requirement (the notification vocabulary itself is unchanged),
only its *current-location* claim. Two possibilities, presented neutrally:
either the Team-Leader-facing notification surface exists under a different,
unverified name this pass didn't match, or the blueprint's prior
characterization was inaccurate at time of writing and the pattern is
actually Instructor-first. Either way, the component itself (§5.2) should be
extended from its one confirmed instance to all five authenticated portals,
per blueprint §12's stated intent, regardless of which portal originated it.

- **Why this matters for this document specifically:** §5.2/§9.1 rank
  `NotificationBell` High-criticality on the assumption that a cross-role
  pattern already exists to extend — the actual verified state is one
  working instance (Instructor) to generalize, not a proven-in-two-places
  pattern. This changes the *migration cost* estimate, not the *priority*.
- **Risk:** Low — this is a documentation-accuracy issue, not a functional
  regression; the confirmed instance works correctly for its current
  audience.
- **Migration cost:** Medium — treat as extending one proven implementation
  to four more portals, not as "already proven, just wire it up elsewhere."
- **Priority:** P1.
- **Business impact:** Blueprint §12's System Notifications channel
  currently reaches one of five roles; closing this gap directly serves
  blueprint §1.2 goal #3 (Team Leader operational autonomy) and goal #4
  (Parent/Student trust), neither of which currently has this channel.

### Gap #G — Shared Notes pattern (`StudentNoteModal`) has exactly one usage site, not the "already established, reuse target" state blueprint §10 describes

**CURRENT STATE (verified):** `components/portal/instructor/
StudentNoteModal.tsx` exists with the category/severity fields blueprint §10
describes, but is used at exactly one call site
(`groups/[id]/sessions/[sid]/AttendanceForm.tsx`). A separate, simpler,
unrelated note type (`modules/students/notes/types.ts`, no severity field)
backs a different UI (`groups/[id]/students/[studentId]/NoteForm.tsx`).

**RECOMMENDED STATE:** Matches blueprint §10's own explicit instruction
("reused wherever an entity needs staff annotation — Students, Leads,
Instructors — not reinvented per entity") — this gap does not require a new
decision, only execution of an already-blueprint-mandated extension, and
reconciliation with the simpler, competing `NoteForm`/`StudentNote` type so
the product doesn't end up with two notes systems.

- **Why current is weaker:** Two different "notes" concepts (one with
  severity/category, one without) for the same conceptual need is exactly the
  kind of small, easy-to-miss duplication this document exists to surface.
- **Risk:** Low-Medium — low today (only 2 call sites total), but every new
  entity that needs notes and copies the *simpler* one instead of the
  richer, blueprint-mandated one compounds the wrong direction.
- **Migration cost:** Low — reconcile the two note concepts into one before
  extending to Leads/Instructors, rather than extending both.
- **Priority:** P1.
- **Business impact:** Directly executes an already-committed blueprint
  instruction (§10) rather than opening a new architectural question.

### Gap #H — Calendar is forked, not shared, between Team Leader and Instructor

**CURRENT STATE (verified):** `app/portal/team-leader/calendar/page.tsx` and
`app/portal/instructor/calendar/page.tsx` each build an independent, inline,
server-rendered calendar grid. No shared `Calendar`/`CalendarGrid` component
exists.

**RECOMMENDED STATE:** Build `CalendarGrid`/`SchedulingView` (§4.14, §5.4) as
one shared Education-family component, capability-gated for the TL-vs-
Instructor scope difference (blueprint §6.1).

- **Why current is weaker:** Calendar sits directly on blueprint §1.2 goal
  #1's highest-frequency daily-use path (Instructor recording attendance
  "in under 30 seconds") — a fix to the Instructor calendar's touch-target
  sizing or loading behavior currently has zero chance of reaching the Team
  Leader calendar, and vice versa.
- **Risk:** Medium — low route-count (2) but high criticality given its
  position on the front-line daily loop (§9.1's note on frequency-vs-count
  applies directly here).
- **Migration cost:** Medium — two independent implementations to reconcile
  into one capability-gated component.
- **Priority:** P1 — named in Phase 6 (§10) within the Education domain
  family, but flagged here as higher-urgency than its raw count suggests
  given blueprint §1.2's explicit goal alignment.
- **Business impact:** Directly serves blueprint §1.2 goal #1, the
  document's own stated highest-priority product goal.

### Gap #I — Command Palette confirmed absent (restates D-07, now with dependency confirmation)

**CURRENT STATE (verified):** No `cmdk` or equivalent dependency exists in
`package.json`; no source file references a command-palette implementation.

**RECOMMENDED STATE:** Unchanged from blueprint D-07/execution plan §8 — build
once, as one Overlay-category surface with three result sections (§6.5).

- **Priority:** P2 (execution plan Wave 1 item 3; this document's §10 Phase 2
  places it directly after core Navigation, ahead of Forms/Tables, since it
  has no functional dependency on either).
- **Business impact:** Restated, not changed, from the blueprint/execution
  plan's own framing — included here for completeness of this document's
  independent verification pass.

---

## 18. Future Evolution

Direct extension of `design-system-architecture.md` §15 (Future Proofing),
stated here at the component-catalog level.

### 18.1 One year

- **Full Critical-tier consolidation** (§9.1): AdvancedTable, EntityForm,
  DetailLayout, ConfirmDialog, ErrorBoundary, and the Group/Student
  component-fork resolution (Gap #B/§6.7) — this is Phases 1–5 (§10)
  completed.
- **Cross-role NotificationBell** (Gap #F) reaching all five authenticated
  portals.
- **Command Palette shipped** (D-07/Gap #I), unifying navigate-to-entity,
  navigate-to-page, and quick actions into the single overlay blueprint §4.7
  mandates.
- **Zero net-new role-forked component pairs** in any work landed during this
  year — the direct, measurable success criterion DSA §1.4 already names.

### 18.2 Three years

- **Domain family completion** (§3.1, Phase 6): Education, Finance, CRM,
  Analytics, Portfolio, Certificates families each reach the point where a
  genuinely new entity in that domain can be built entirely from existing
  Business Components plus new Screens — no new Component-layer work
  required, per DSA §15's "new modules" future-need row.
- **A second Application (portal)** becomes technically cheap to add — per
  DSA §15, a new portal reuses every Navigation/Template/Component category
  already defined, needing only a new Sidebar domain subset and, if its
  persona genuinely differs, a new Application Token set (§5.5 of DSA). This
  document's contribution: by year 3, that claim is empirically testable
  against a real second-portal build, not just architecturally asserted.
- **Dark Mode becomes achievable** once the remaining raw-hex call sites (DSA
  §5.6/§5.7) are routed through Semantic Tokens — a Theme Token swap, not a
  component rewrite, because this document's components already reference
  Semantic Tokens exclusively (§15.1 Quality Gate) by this point.

### 18.3 Five years

- **White label / multi-brand support** (DSA §5.6): a new academy partner
  brand is a new Theme Token set layered on an unchanged Foundation/Primitive/
  Semantic/Component/Business-Component/Template stack — the entire component
  catalog in §4/§5 is reusable unchanged, per DSA §15's explicit framing.
- **AI-generated Screens at scale**: by year 5, the Component Taxonomy (§3–
  §9) should be complete and stable enough that an AI agent with zero memory
  of any prior session can compose a fully compliant new Screen (blueprint
  §7's CRUD lifecycle, DSA §8's Templates, this document's Business
  Components) without inventing a single new pattern — the literal success
  criterion DSA §1.4 states for AI-agent-legibility, restated here as a
  5-year target for this document's catalog specifically.
- **Mobile native apps**: per DSA §15, a genuinely new *kind* of interface
  (native iOS/Android, as opposed to a mobile-responsive web view) would
  require new Foundation categories (native gesture/navigation idioms) but
  not a rewrite of the Business Component layer — the Domain Components
  (§8) encode business logic and content structure independent of their
  rendering surface, and are the layer most likely to survive a native-app
  migration unchanged.
- **Design Tokens maturity**: by year 5, Application Tokens (DSA §5.5) should
  be a fully realized, not merely informally-followed, layer — every
  persona's density/sizing default resolved by token, not by convention —
  which is the prerequisite this document's §13.5 (Responsive Strategy
  mechanism) already assumes and depends on.
- **Future component categories**: per §3's own note (a genuinely new
  taxonomy category is rare, DSA §6.3), the most likely 5-year candidate is a
  **real-time/collaborative** category (e.g., live-session co-presence for
  Instructor+Student during a class) — flagged here as a plausible future
  need, not a current one, so a future session evaluating it has this
  document's own precedent for how a genuinely new category gets added
  (§16.2 of DSA: Governance-level decision, documented before or alongside
  first use).

---

## Self-Review

- [x] No UI was designed — every section defines categories, classifications,
  dependency relationships, and sequencing, never a layout, color, icon, or
  rendered component.
- [x] No React code exists anywhere in this document.
- [x] No Tailwind classes exist anywhere in this document (`.ds-card` etc. are
  cited only as *evidence* of an existing Confirmed component, per the same
  convention `design-system-architecture.md` uses for citing `DESIGN.md`).
- [x] No colors were selected or named.
- [x] No icon choices were made — Iconography is referenced only as a
  Foundation category (DSA §4), never with a specific icon named.
- [x] No components were visually designed — every specification (§5) is
  behavioral/structural (purpose, dependencies, domains, roles, criticality),
  never a rendered appearance.
- [x] No Figma artifacts were created or referenced.
- [x] No design tokens were created — §5/§12/§13 reference the Semantic Token
  layer's *existence* (per DSA §5) as a requirement every component must
  honor, never a new token name or value.
- [x] Every component classified — §5's table covers every Layout,
  Navigation, Pattern-bearing, Business, and Utility component named in §4,
  with all fifteen required fields (Name, Category, Purpose/Responsibilities
  folded into table structure, Domains, Roles, Usage, Priority, Criticality,
  Complexity, Reusable, Composable, Responsive, Accessibility Level,
  Dependencies, Consumers, Growth Potential).
- [x] Every dependency mapped — §6's seven dependency trees cover the highest
  fan-out composite components; §5's Dependencies/Consumers columns cover
  every remaining catalog entry.
- [x] Every category justified — §3's twenty-category taxonomy states, for
  each row, which DSA §6.1 category or blueprint §3.1 domain it maps onto,
  and §3.1/§3.2 explain the two deliberate refinements (domain-family split,
  gamification non-split) explicitly.
- [x] Build order optimized — §10's seven phases are sequenced by verified
  dependency (§10.1's table), not arbitrary preference, and are named as
  component-level implementations of the execution plan's own Wave 1–5
  sequencing, never a competing schedule.
- [x] Ready for long-term enterprise growth — §1.4, §9.2, §16, and §18 each
  state, in measurable terms, how this catalog holds at 300+ screens and 5–10
  years without requiring a second from-scratch inventory.
- [x] Every gap in §17 was verified directly against the live repository on
  2026-07-11 (file paths cited), not inferred from the prior three documents
  alone — and where a verified fact conflicts with a prior document's
  characterization (Gap #F, the NotificationBell's actual portal), it is
  surfaced explicitly per blueprint §20 MUST #10 rather than silently
  corrected or silently ignored.

This document is optimized specifically for Robocode LMS's actual
build reality: a five-role, ten-domain, 181-routes-today-and-growing product,
built and maintained across disconnected AI agent sessions with no persistent
memory (`AGENTS.md`/`CLAUDE.md`), where "does this already exist?" must be
answerable from this file alone, in minutes, without a repository archaeology
pass — which is the exact condition every prior document in this series
identifies as the actual, ongoing risk to Robocode LMS's long-term
maintainability, and the condition this document exists to remove.
