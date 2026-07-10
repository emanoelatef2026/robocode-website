# Robocode LMS — Design System Architecture

**Status:** Constitution, third layer. `product-blueprint.md` defines *how the
product behaves*. `ux-execution-plan.md` defines *where 181 routes stand today
against that behavior*. This document defines *the operating system that
builds and constrains every screen going forward* — the architecture of the
Design System itself, not its visual output.

**Scope boundary:** This document contains no colors, no typography scale, no
component code, no Tailwind, no token values. `DESIGN.md` already documents
the shipped visual language (palette, type scale, `.ds-*` classes) — this
document explains the *system* that `DESIGN.md`'s content is one instantiation
of, and the *rules* that govern how that content, and everything built from
it, evolves for the next 5 years and 300+ screens. Where this document and
`DESIGN.md` overlap in subject (e.g., tokens), this document is the layer
above: it says what categories of tokens must exist and why; `DESIGN.md` says
what today's values are.

**Relationship to the blueprint and execution plan:** Every principle here is
load-bearing against two facts already established: (1) the blueprint's own
permission philosophy (§6.1/D-02: one shared component tree, gated by
capability, never forked per role) and (2) the execution plan's finding that
this exact rule is already being violated in production (Gap #2: Admin and
Team-Leader maintain separate composed components for the same entity, e.g.
Group). This document exists so Gap #2 — and the modal-vs-route ambiguity of
Gap #1 — cannot recur once resolved, because the *system* that produces
screens will structurally prevent it, not just discourage it by convention.

---

## 1. Design System Vision

### 1.1 Why the Design System exists

Robocode LMS is not one application — it is five portals, a marketing CMS,
and a public site, sharing one identity, one backend, and (per the blueprint's
§6.1 rule) one component tree. At 181 routes today, informal consistency
("copy what the last screen did") has already produced two of the three
conformance gaps the execution plan found: a component duplicated per role,
and a CRUD pattern (modal vs. dedicated route) applied opportunistically
rather than by rule. Both gaps have the same root cause — the product has a
UX *constitution* (the blueprint) but no *build system* that makes following
it the path of least resistance. A Design System is that build system: it
turns "please stay consistent" into "the only components available to compose
with are already consistent."

At 300+ future screens, informal consistency doesn't degrade gracefully — it
compounds. Every screen built without a governing system is a screen the next
builder (human or AI) can point to as precedent for building the next one the
same divergent way. The Design System exists to make the *compliant* path the
*only convenient* path.

### 1.2 What problems it solves

1. **Duplication drift** (execution plan Gap #2). One shared, permission-gated
   component tree means a fix to how a Group's finance section renders
   reaches every role that views it, in one change, not four.
2. **Ambiguous pattern selection** (execution plan Gap #1). A documented
   Component Taxonomy (§6) and Layout Architecture (§8) mean "should this be a
   modal or a route" has one answer, derivable from the entity's field count
   and concern-count — not a per-developer judgment call re-litigated per
   entity.
3. **Onboarding cost.** A new engineer, or a new AI agent session with no
   memory of prior sessions, must be able to build a compliant screen by
   reading this document and the taxonomy it defines — not by archaeology
   through 181 existing routes to infer the pattern.
4. **Cross-role screen parity at zero extra cost.** Because Robocode serves
   five roles from one interface (blueprint §6), a system that scopes
   permission *within* a shared component is cheaper, per screen, than one
   that scopes permission *by forking* the component — this compounds
   favorably as roles are added or route counts triple.
5. **A stable substrate under a fast-moving product.** Robocode ships new
   modules constantly (gamification, payroll, special sessions — all shipped
   in the last two months per project history). A Design System absorbs that
   velocity by keeping Foundation and Primitives stable while Templates and
   Screens change weekly.

### 1.3 Long-term philosophy

**Boring is a feature.** A Design System's job is not to be creatively
interesting — Robocode already has a place for creative expression (the
marketing site's motion-forward, glowing-CTA idiom, per `DESIGN.md` §1). The
LMS platform's job is to disappear so a team leader can close forty tasks
before lunch and an eight-year-old can find their badge without asking an
adult for help. Every architectural decision below optimizes for *predictable*
over *novel*.

**The system serves the operating loop, not the org chart.** Per the
blueprint's own framing (§1.1), the real unit of the business is a group of
students in sessions, taught by an instructor, inside a branch. The Design
System's component taxonomy, density strategy, and interaction philosophy are
built around *that loop's* actual conditions — a phone in a classroom, poor
Wi-Fi, a five-year-old's motor control, a parent's five-minute weekly check-in
— not around a generic enterprise-dashboard ideal that happens to serve none
of them well.

**Architecture is inherited, not re-derived.** Every layer below (§3) inherits
constraints from the layer above it. A Screen cannot invent a spacing value
because Foundation already defines the category; a Component cannot invent a
permission-forked variant because §6.1/D-02 already forbids it. Inheritance is
what makes 300 screens as cheap as 20.

### 1.4 Success criteria

| Signal | What it proves |
|---|---|
| A new entity's full CRUD surface (List/Create/View/Edit/Delete) can be built using only existing Component Taxonomy entries (§6) | The taxonomy is actually complete enough to build with, not just to describe with |
| Zero net-new role-forked component pairs appear in new work (extends execution plan §15.2's "done" definition) | D-02 is holding under real development pressure, not just written down |
| A new screen's density, motion, and interaction states are fully determined by which persona/portal it serves (§9, §14) — no ad hoc judgment call needed | The system, not the individual builder, is making consistency decisions |
| An AI agent session with zero prior memory of this codebase can read §17 and §18 and produce a compliant screen on the first attempt | The rules are legible enough to be followed mechanically, which is the actual bar for a 5-year, AI-built system |
| Time for a genuinely new pattern to go from "needed" to "documented and reusable" (§16) stays short — days, not quarters | Governance is a fast lane, not a bottleneck that incentivizes silent workarounds |
| Accessibility baseline (§13) holds at 300 screens without a dedicated remediation project | The baseline was built into the system, not bolted onto each screen after the fact |

---

## 2. Architecture Principles

Twelve permanent principles. Each is stated, then challenged, then resolved
for Robocode specifically — a principle that isn't worth defending under
pressure isn't a principle, it's a preference.

### 2.1 Consistency

**Definition:** The same interaction, in the same context, looks and behaves
the same everywhere it appears.

**Challenge:** Consistency can calcify a genuinely bad pattern — if the first
version of a table filter was mediocre, "stay consistent" means shipping that
mediocrity 55 more times.

**Resolution:** Consistency applies to *contracts* (a table always sorts,
filters, and paginates the same way), not to *first-draft quality*. Improving
a pattern is a Governance action (§16) that updates the shared primitive once
and propagates everywhere — never a reason to let one screen quietly diverge
"because it's better here."

### 2.2 Scalability

**Definition:** The cost of building screen #300 is not higher, per screen,
than the cost of building screen #30.

**Challenge:** Scalability investments (abstraction layers, generic
components) have upfront cost that can outrun near-term need.

**Resolution:** Scale the system in the order the product actually grows:
Academics and People are already the two largest domains (execution plan §5.1
— 27% and 13% of routes) and will stay the largest as the business grows more
groups and students before it grows more business domains. Invest in
Component Taxonomy depth (§6) for those first; invest in net-new Foundation
categories (§4) only when a genuinely new *kind* of interface is needed (e.g.,
a future native mobile app, §15).

### 2.3 Predictability

**Definition:** A user who has learned one screen of a given type can predict
the layout and behavior of every other screen of that type, in any portal.

**Challenge:** Different roles have genuinely different needs — an
instructor's group view and an HQ admin's group view are not the same job to
be done.

**Resolution:** Predictability is a *structural* guarantee (header position,
action placement, tab behavior — per blueprint §10), not a *content* one. The
Detail Layout (§8) is identical in shape between a Student's own portfolio
view and an Admin's student record; what differs is which fields render and
which actions are enabled (blueprint §6.1) — never the shape.

### 2.4 Accessibility

**Definition:** Every interaction is usable by keyboard, screen reader, and
touch, at WCAG 2.1 AA contrast, regardless of role.

**Challenge:** Accessibility work is frequently the first thing cut under
deadline pressure because its cost is visible and its benefit is diffuse.

**Resolution:** Accessibility is enforced at the Primitive layer (§3), not
audited at the Screen layer. If `Button`, `Input`, and `Table` are accessible
by construction, every screen composed from them inherits that property for
free — the Quality Checklist (§18) verifies inheritance, it does not re-derive
compliance per screen. This matters more for Robocode than a typical SaaS: a
parent on an old Android phone with a cracked screen (blueprint §17) is a
description of a *real, common* Robocode user, not an edge case.

### 2.5 Performance

**Definition:** Every screen is fast enough to use on a classroom phone with
poor Wi-Fi, within the blueprint's 30-second attendance goal (§1.2).

**Challenge:** Rich data visualization and dense admin analytics (Operations
Intelligence domain, HQ's `/admin/analytics` at 988 lines) genuinely need more
payload than a front-line instructor screen does.

**Resolution:** Performance budgets are set *per persona*, not product-wide.
Instructor/Parent/Student surfaces (mobile-first, per blueprint §16.1) carry
the strictest budget — minimal JS, no heavy chart libraries, optimistic-safe
interactions only where blueprint D-06 allows. Admin/HQ analytical surfaces
accept a heavier budget because their persona (desktop, stable connection,
willing to wait 2 seconds for a network-wide rollup) tolerates it. The
Information Density Strategy (§9) and the Foundation's Motion category (§4)
both take their cues from this same per-persona split.

### 2.6 Low Cognitive Load

**Definition:** A user re-establishes full context on a screen in under two
seconds (blueprint §1.4) without needing to remember prior state.

**Challenge:** Low cognitive load can be used to justify oversimplifying
genuinely complex data (a branch's full financial picture cannot always be
one glance).

**Resolution:** Cognitive load is managed by *layering*, not *hiding* — this
is Progressive Disclosure (§2.7), a distinct principle this one delegates to.
Low Cognitive Load specifically governs *default view density*: a Team Leader
opening a Student they haven't seen in a month should understand status,
balance, and any urgent flag before scrolling — everything else earns its
place behind a tab or a click.

### 2.7 Progressive Disclosure

**Definition:** Default views show what 80% of visits need (blueprint §5.5);
depth is one interaction away, never removed.

**Challenge:** Power users (a Team Leader running Workspace surfaces daily)
resent friction that Progressive Disclosure adds for casual users.

**Resolution:** This is why the Workspace pattern (§6, already proven three
times per execution plan §7.1: Groups, Instructors, Payroll) exists as its own
Component Taxonomy category, distinct from the standard Data Table/List and
Detail templates. Progressive Disclosure governs the *default* entry point for
every entity; Workspace is the deliberate, opt-in escape hatch for roles that
live inside one domain all day. Both are first-class, neither is a
compromise.

### 2.8 Composition over Duplication

**Definition:** New capability is built by composing existing Primitives and
Patterns; a near-identical component is never hand-copied and modified.

**Challenge:** Composition sometimes requires more upfront design thought
than copy-paste, especially under deadline pressure.

**Resolution:** This is the principle execution plan Gap #2 violates today,
and it is the single most consequential principle in this document for
Robocode specifically, because the product is explicitly built and maintained
by AI agents across disconnected sessions (per `AGENTS.md`/`CLAUDE.md`) that
have no memory of "we already built this." Composition over Duplication is
enforced procedurally in §17 (AI Development Rules): before building anything,
check the Component Taxonomy (§6) for an existing composable unit; only
extend the taxonomy (§16) if a genuine gap exists.

### 2.9 API Stability

**Definition:** A Component's public contract (props/behavior it exposes to
compose with) changes rarely and never silently.

**Challenge:** Stability can freeze a component's API around an early,
imperfect design.

**Resolution:** Stability applies to the *contract*, not the *implementation*.
A Table's sort/filter/paginate contract (blueprint §9) can be
reimplemented under the hood without any consuming screen changing — this is
the entire point of a layered system (§3). Contract changes follow the
Versioning and Breaking Changes process (§16).

### 2.10 Backwards Compatibility

**Definition:** Existing screens keep working when a shared component
changes, until they are explicitly migrated.

**Challenge:** Perpetual backwards compatibility accumulates dead code paths
(the execution plan's own Redirect/Legacy-Alias inventory — 17 routes, §7.4 —
is exactly this pattern already occurring at the route layer).

**Resolution:** Backwards compatibility is time-boxed, not permanent. A
deprecated component pattern is supported through one full migration cycle
(§16) with visible deprecation signaling, then removed — mirroring the
execution plan's own recommendation for the legacy-redirect inventory (add
telemetry, review, retire on a schedule, not indefinitely).

### 2.11 Extensibility

**Definition:** A new business domain, portal, or persona can be added by
composing existing layers, without modifying Foundation.

**Challenge:** Genuinely novel needs (a future native mobile app, a franchise
white-label brand) can strain a system designed around today's five portals.

**Resolution:** Extensibility is why Foundation (§4) and Token Architecture
(§5) are defined as *category systems*, not fixed value sets — a white-label
brand or a dark theme is a new Theme Token set layered on unchanged Primitive
and Semantic tokens (§5), never a Foundation rewrite. §15 details this per
future scenario.

### 2.12 Maintainability

**Definition:** A component's owner (or an AI agent with no session memory)
can confidently change it without manually re-verifying every consumer.

**Challenge:** True maintainability requires test/type coverage and
documentation discipline that's easy to defer under delivery pressure.

**Resolution:** Maintainability is a direct function of every principle above
holding — a system with real Composition over Duplication, real API
Stability, and a real Quality Checklist (§18) is maintainable by construction.
This principle is the *outcome* the other eleven exist to produce, restated
here so it can be checked for directly: "if I change this Primitive, can I
state with confidence what breaks?" A no answer means one of the other eleven
principles has already been violated upstream.

---

## 3. System Layers

```
Foundation
   │  raw design categories (spacing, type, motion, grid...) — §4
   ▼
Tokens
   │  named, purposeful values built from Foundation categories — §5
   ▼
Primitives
   │  the smallest usable UI units (Button, Input, Icon, Badge)
   ▼
Patterns
   │  reusable interaction/behavior contracts (a sortable table,
   │  a confirm-then-destroy flow, a multi-step wizard shell)
   ▼
Components
   │  composed, named, reusable units built from Primitives + Patterns
   │  (StatusBadge, StudentCard, GroupFinanceSection) — §6
   ▼
Templates
   │  the 17 structural screen types already found in production
   │  (Data Table/List, Detail Profile, Workspace...) — §8
   ▼
Screens
   │  one template + real domain content + real permission scope
   │  = one of the 181 (soon 300+) routes
   ▼
Applications
      the 5 portals + Studio + Public Site — a scoped composition
      of screens, sharing every layer above
```

### 3.1 Layer responsibilities

| Layer | Responsibility | Who/what changes it | Change velocity |
|---|---|---|---|
| **Foundation** | Defines *which categories* of design decisions exist (spacing scale exists; its values are Token layer's job) | Design System Lead only, via Governance (§16) | Rare — changes here ripple through every layer above |
| **Tokens** | Assigns purpose to Foundation values (`--border-soft` means "the quiet card border," not just a hex) | Design System Lead, reviewed | Infrequent |
| **Primitives** | The irreducible interactive units — cannot be decomposed further without losing their function | Design System Lead, reviewed | Infrequent |
| **Patterns** | Behavior contracts that many Components share (sort/filter/paginate; confirm-then-destroy; step-validate-review) | Design System Lead, reviewed | Occasional — a new Pattern is a real architectural event |
| **Components** | Named, composed, reusable — the actual building blocks screens are assembled from | Any engineer/agent, following §17 | Regular |
| **Templates** | The structural shape a Screen takes (§8) — already-proven shapes, not invented per screen | Any engineer/agent, extending existing 17 only with Governance sign-off | Rare — 17 templates have covered 181 routes; a genuinely new 18th is a notable event |
| **Screens** | Real routes — one Template + real content + real permission scope | Any engineer/agent, freely, within the above constraints | Constant — this is where daily work happens |
| **Applications** | Portal-level composition and permission boundary | Rare — adding a 6th portal is a product decision, not a design one | Very rare |

### 3.2 Why this order, specifically

Each layer exists to absorb a *different kind* of change, so that a change at
one layer doesn't force a rewrite at another:

- A rebrand (new palette) touches Foundation/Tokens only — every Component
  above inherits it automatically, zero Screen-layer changes required.
- A new business rule (e.g., a new CRUD action type) touches Patterns —
  every Component built on the CRUD Pattern gets it without a rewrite.
- A new entity (e.g., a future "Waitlist" concept, mentioned as a live
  example in the blueprint §3.3) touches Components and Screens only —
  Foundation, Tokens, Primitives, and Patterns are all untouched, which is
  the entire point of building on a layered system instead of a flat one.

This is also the direct structural answer to execution plan Gap #2: the
duplication happened because Admin and Team-Leader built *Components*
(`GroupDetailView` vs. `TLEnrollStudentsForm`) instead of one Component gated
by a Pattern-layer permission contract. The layer system doesn't just
recommend against this — it makes "build a second Component for the same
entity" a visibly wrong move against the stack, because the correct layer for
a permission difference is a *capability check inside* the Component (per
blueprint §6.1), never a second Component.

---

## 4. Foundation Architecture

Categories only — no values. Each category exists because it answers a
distinct design question that no other category answers, and each is loaded
with a Robocode-specific reason it can't be skipped or merged with a
neighbor.

| Category | What question it answers | Why Robocode needs it as its own axis |
|---|---|---|
| **Spacing** | How much room separates two elements? | A dense HQ analytics table and a student's leaderboard card need genuinely different rhythm — spacing must scale independently of every other category so density (§9) can vary without touching typography or color. |
| **Typography** | What text styles exist, and for what role? | Robocode already runs two typographic idioms (Orbitron display / Poppins body, per `DESIGN.md` §2) plus a full Arabic/Cairo companion. Typography must be its own category so a future third idiom (e.g., a kid-friendly display face for the student portal) can be added without touching admin type. |
| **Grid** | How does content align and flow across viewport widths? | Admin/HQ tables need a wide, multi-column grid; Instructor/Parent/Student screens need a strict single-column flow (blueprint §16.4). One grid category serves both by parameterizing column count per breakpoint, not by defining two unrelated layout systems. |
| **Elevation** | What visually implies "above" vs. "flat with the page"? | Robocode already splits this by surface (flat navy-tinted shadows for admin, colored glows for marketing, per `DESIGN.md` §4) — elevation must stay a distinct category so that split is a deliberate, documented choice, not an accident of two teams never comparing notes. |
| **Radius** | How rounded are corners, and does that vary by context? | Already differentiated (`10px` admin buttons vs. `rounded-full` marketing CTAs, per `DESIGN.md` §1) — kept as its own Foundation axis so this differentiation stays intentional as new surfaces are added, rather than silently drifting toward one or the other. |
| **Opacity** | How is disabled, scrim, or overlay state visually expressed? | Disabled states must be distinguishable from low-emphasis-but-active states (blueprint §6.1 rule 3: a disabled action shows *why*, it doesn't just look faded and unexplained) — opacity alone is never sufficient and must be paired with the Interaction Architecture's Disabled contract (§7). |
| **Sizing** | What are the standard dimensions for interactive targets and containers? | The single most consequence-bearing Foundation category for Robocode's front-line roles: an Instructor's live-classroom tap target has a hard physical minimum (44×44px, blueprint §16.6) that an HQ admin's mouse-driven row action does not need. Sizing must flex by density (§9) without becoming a different component. |
| **Motion** | What timing/easing families exist for state changes? | Robocode already runs two motion philosophies (expressive/scroll-triggered marketing vs. quiet/minimal admin, per `DESIGN.md` §6) plus a third emerging need — celebratory motion for gamification (badges, XP, streaks) aimed at children. Three philosophies under one category, governed by §14. |
| **Breakpoints** | At what viewport widths does layout behavior change? | Directly inherited from blueprint §16.1's three-tier persona split (Desktop/Tablet/Mobile) — Foundation defines the breakpoint *categories* here; it is the join point between Layout Architecture (§8) and Information Density Strategy (§9). |
| **Density** | How much information is shown per unit of screen space, independent of viewport? | Distinct from Breakpoints: a Team Leader on a tablet in a branch office and an Instructor on a phone in a classroom are both "mobile-tier" by breakpoint but need different density (comfortable vs. compact/touch, §9) — density is a persona/context signal, breakpoint is a physical-viewport signal, and conflating them is a common mistake this Foundation explicitly avoids. |
| **Iconography** | What visual language represents actions and entities? | One icon set serves both a bright, encouraging student leaderboard and a serious HQ financial reconciliation screen — Robocode's icon language must read as *professional-but-approachable* everywhere, never split into a "kid" set and an "adult" set (that would itself violate Composition over Duplication, §2.8, at the icon layer). |
| **Illustrations** | What imagery fills empty/onboarding/celebratory states? | Empty states carry real emotional weight differently by persona: a Student's empty portfolio should feel like an invitation ("your first project goes here!"), an Admin's empty finance queue should feel like a calm, neutral confirmation ("nothing pending") — illustration tone is a Foundation-level decision precisely because it must vary by *who's looking*, not by *which screen*. |
| **Z-index** | What is the fixed stacking order across every overlay type? | Robocode already has, or will soon have, several concurrent overlay types competing for stack order: the Gap #1 modal/drawer CRUD pattern, the notification bell dropdown (blueprint §12), the planned Command Palette (§4.7/D-07), and the Instructor/Parent/Student "More" bottom sheet (blueprint §4.1). A single canonical z-index scale, defined once at Foundation, is the only way to guarantee a drawer never opens beneath a toast or a command palette never opens beneath a modal, product-wide. |
| **Timing** | What are the standard durations for state transitions, auto-dismiss, and debounce? | Distinct from Motion (which governs *how* something moves) — Timing governs *how long things wait*: toast auto-dismiss duration (blueprint §12), inline-validation debounce (§8.3), autosave interval (§8.4). These are UX-behavior-adjacent but visually implemented, so they belong in Foundation as the layer that both this document and the blueprint's behavioral rules can point to. |

---

## 5. Token Architecture

Categories and relationships only — no token names or values are created
here. `DESIGN.md` already instantiates much of this stack; this section
formalizes the layer model that content sits inside, and states where it must
grow to support the futures in §15.

### 5.1 The five token layers

```
Primitive Tokens  →  raw values, no meaning attached
                      (a hex, a pixel number, a duration)
       │
Semantic Tokens   →  purpose-named references to Primitives
                      ("this is the danger-state background,"
                      not "this is #FEF2F2")
       │
Component Tokens  →  a Component's specific reference to Semantic tokens
                      (Table's row-hover background = the semantic
                      "surface-hover" token, not a new value)
       │
Application Tokens →  a portal/persona-level override of Semantic tokens
                       (Instructor portal's touch-target-size token reads
                       larger than Admin's, from the same Semantic layer)
       │
Theme Tokens      →  a swappable full set of Semantic-token assignments
                      (light/dark, future white-label brand)
```

### 5.2 Primitive Tokens

Raw, meaningless-in-isolation values — a specific hex, a specific pixel
number, a specific millisecond duration. `DESIGN.md` §3–§4's hex values and
shadow/radius definitions are Primitive Tokens today. Primitive Tokens are
never referenced directly by a Screen or a Component — only by a Semantic
Token. This indirection is what makes a rebrand or a dark theme (§5.6) a
Token-layer change instead of a find-and-replace across 300 screens.

### 5.3 Semantic Tokens

Purpose-named references to Primitive Tokens. Robocode already has the
clearest possible existence proof of this layer working correctly:
`StatusBadge`'s six semantic buckets (Success/Warning/Danger/Info/
Neutral/Special, per `DESIGN.md` §3) are Semantic Tokens in practice — "reuse
one of these six buckets by meaning, don't invent a new bg/text/dot triple"
(`DESIGN.md` §3) is, word for word, the Semantic Token discipline this
architecture formalizes. The instruction going forward is not to invent a new
semantic layer — it's to recognize this one already exists and extend the
same discipline to every other Primitive Token category (spacing, motion
timing, sizing), not just color.

### 5.4 Component Tokens

A Component's internal reference to the Semantic layer, scoped to that
Component's own concerns. `.ds-card`'s border/radius/shadow values
(`DESIGN.md` §5) are Component Tokens — `.ds-card` doesn't define its own
color, it points at the Semantic `border-soft` token. This is what lets a
Semantic Token change (e.g., "soften every card border platform-wide")
propagate to every Component that references it, without touching Component
code.

### 5.5 Application Tokens

A portal- or persona-scoped override layer, sitting between Semantic and
Theme. This is the layer most explicitly justified by Robocode's specific
persona split (blueprint §1.3) rather than by generic SaaS practice: the
Instructor portal's density and sizing needs (large touch targets, in a live
classroom) are a legitimate, permanent override of Admin's defaults, not a
one-off exception. Application Tokens let that override happen once, at the
portal boundary, rather than being re-decided per component per screen.
Today this layer exists informally (the mobile-first vs. desktop-first split
documented in blueprint §16.1); formalizing it as a named token layer is
this document's contribution — it should be built out as the Component
Taxonomy (§6) matures, not retrofitted all at once.

### 5.6 Theme Tokens

A complete, swappable set of Semantic Token assignments. `DESIGN.md`'s
current palette is, in this model, the one shipped Theme. Two concrete future
Themes are already implied by Robocode's own product reality (§15 expands
both):

- **Dark Mode.** Not a cosmetic nicety here — an Instructor running a
  session with a classroom projector, or a parent checking a balance at
  night, are real Robocode usage conditions. Dark Mode is achievable *only*
  because Semantic Tokens already abstract away from raw hex (§5.3) —
  `DESIGN.md`'s existing "hex in code, not Tailwind named colors" rule (§3)
  is a half-step toward this: the next step is routing those hex values
  through Semantic Tokens so a Theme swap is a token-set swap, not a
  grep-and-replace.
- **White Label.** If Robocode licenses its LMS to franchise-model academy
  partners under their own brand (a realistic 5-year scenario for an
  education SaaS), the entire Foundation/Primitive/Semantic/Component stack
  is reusable unchanged — only a new Theme Token set (their palette, their
  wordmark) is needed. This is the single clearest business case for why
  Token Architecture must be layered now, before a rebrand or a white-label
  deal makes retrofitting it a cross-cutting emergency.

### 5.7 What must not happen

A Screen, or a one-off Component, referencing a Primitive Token directly
(a raw hex, a raw pixel value) is a Token Architecture violation — it is
invisible to a future Theme swap and is exactly the pattern `DESIGN.md` §3
already prohibits for color ("hex in code... never Tailwind named colors" is
a Primitive-Token-hygiene rule, not a Semantic one; the next evolution is
ensuring even the *permitted* hex is only ever written once, inside a
Semantic Token definition, not re-typed at every call site).

---

## 6. Component Taxonomy

Hierarchy and category definitions only — no components are created or named
beyond the ones already shipped and cited as existence proof.

### 6.1 The eleven categories

| Category | Definition | Robocode-specific role |
|---|---|---|
| **Foundation** (primitives proper) | The smallest independently meaningful interactive units — Button, Input, Icon, Badge, Checkbox, Toggle. Cannot be decomposed further without losing their function. | Every one of the 5 portals' 300+ future screens is ultimately built from a small, closed set of these — this is the layer where "one shared tree" (D-02) is cheapest to guarantee, because there are the fewest of them and they change least often. |
| **Navigation** | Sidebar, Topbar, Breadcrumb, Tab strip, Command Palette, Bottom Tab Bar, "More" sheet, Search entry point. | Directly implements blueprint §4's navigation strategy — fixed primary-nav order across roles (D-09), mobile bottom-nav-plus-More (already proven for Team Leader per the mobile-UX-sprint work), the still-unbuilt Command Palette (D-07). |
| **Data Entry** | Text/number/date inputs, Select, Multi-step form shell, File upload, Rich text/notes editor. | Must serve both a desktop Admin filling a 12-field Course form and an Instructor filling a 3-field Special Session request on a phone mid-class — one Data Entry category, scaled by Density (§9), not two different input systems. |
| **Data Display** | Card, StatusBadge, List item, Detail metadata panel, Related-entity link card. | `StatusBadge` is this category's proof of concept today — six semantic buckets, ~30 statuses mapped, reused across every domain (`DESIGN.md` §3). Every future Data Display component should be held to that same reuse bar before a new one is proposed. |
| **Data Visualization** | KPI card, Chart (trend/comparison), Sparkline, Progress/percentage indicator. | Governed jointly with the platform's `dataviz` design-system skill for chart-specific color/form guidance (out of this document's scope by design, per §5's boundary) — this category owns *when* a chart belongs on a screen (blueprint §11: only when trend/comparison is the point), the `dataviz` skill owns *how it's drawn*. |
| **Feedback** | Toast, Inline banner, Field-level error, Notification bell + dropdown, Background-job progress indicator. | Implements blueprint §12's shared notification vocabulary exactly — proven for Team Leader already; this category's job going forward is *extension*, not redesign (execution plan §8's Component Demand Forecast names this explicitly). |
| **Overlay** | Modal, Drawer, Dialog (confirm/destructive), Popover, Command Palette surface. | This category is the direct architectural resolution to execution plan Gap #1. Formalizing Overlay as its own taxonomy category — with an explicit field-count/concern-count threshold for when an entity's Create/Edit belongs here vs. in a dedicated route (Layout Architecture, §8) — turns "modal vs. route" from an ad hoc per-entity call into a rule anyone (or any AI agent) can apply consistently. |
| **Workspace** | Multi-panel, power-user surface composed of Components + Dialogs + Hooks in one colocated structure. | Already proven three times independently (Groups, Instructors, Payroll — execution plan §7.1) with a consistent file convention (`components/`, `dialogs/`, `hooks/`) that already matches blueprint §18's naming rules. This category exists to make that convention the *required* shape for any future power-user surface, not a pattern a fourth team reinvents from scratch. |
| **Layout** | Page shell, Grid container, Detail-page skeleton (header/tabs/metadata-rail), Table-page skeleton, Wizard shell. | The structural containers Templates (§8) are built from — a Layout component knows *where* things go; it holds no domain content and no permission logic, which is what keeps it reusable across all 10 business domains. |
| **Domain Components** | Entity-specific composed units built from every layer above — `StudentCard`, `GroupFinanceSection`, `AttendanceRow`, `CertificatePreview`. | The layer where execution plan Gap #2 actually occurred (`GroupDetailView` vs. `TLEnrollStudentsForm`). Domain Components are the one category where a genuinely new unit is created *per entity*, but never *per role* — one `GroupFinanceSection`, gated internally by capability check, is correct; a second one for Team Leader is the exact violation this document exists to prevent. |
| **Utilities** | Empty state, Skeleton loader, Error boundary, Permission-gate wrapper, Confirm-before-destroy wrapper. | The category that renders State Architecture (§12) uniformly. A screen never hand-rolls its own "No data yet" message — it composes the shared Empty State utility, parameterized by illustration/copy (Foundation §4), which is what guarantees blueprint §13's "never a bare no-data state" rule holds everywhere at once. |

### 6.2 Composition direction is one-way

Each category may compose from any category above it in the table, never
below: a Domain Component may use Data Entry, Data Display, and Feedback
primitives; a Foundation primitive may never import a Domain Component. This
mirrors the System Layers rule (§3.2) at the Component level and is what
keeps a change to a low-level primitive (e.g., `Button`) safely predictable
across every Domain Component built on it.

### 6.3 New category vs. new entry in an existing category

A genuinely new *category* (an 12th row in §6.1) is a rare, Governance-level
event (§16) — it implies a fundamentally new *kind* of interaction Robocode
has never needed before (e.g., a real-time collaborative editing surface). A
new *entry* within an existing category (a new Domain Component for a new
entity) is routine, expected, daily work — see §17 for the procedure.

---

## 7. Interaction Architecture

### 7.1 Interaction philosophy

Robocode's interaction model splits cleanly along the same axis as its
persona split (blueprint §1.3): **discovery-first** for desktop/mouse roles
(Admin, Team Leader analytical work) and **action-first** for touch-primary
roles (Instructor, Parent, Student). This distinction governs every state
below — a state defined only in terms of `:hover` is invisible on a touch
device, which is a hard failure for three of Robocode's five personas, not a
graceful degradation.

### 7.2 The interaction states

| State | Definition | Robocode-specific rule |
|---|---|---|
| **Hover** | Cursor rests over an element without activating it. | Desktop/mouse-role affordance only (e.g., revealing a row's "..." menu, blueprint §9). Never the *only* way to reveal an available action — every hover-revealed control must have a touch-visible equivalent (an always-visible icon, or a tap-to-reveal state), because three of five Robocode roles never hover. |
| **Focus** | An element has received keyboard or programmatic focus. | Always visually distinct from hover (blueprint §17) — a user tabbing through a form must locate themselves without a mouse. Never `outline: none` without a replacement per blueprint §17. |
| **Pressed** | An element is being actively clicked or tapped, mid-interaction. | The primary *touch* feedback signal, since hover doesn't exist on touch — pressed state must be immediate and visible enough to confirm a tap registered before a network round-trip completes, critical for an Instructor mid-class who cannot afford to wonder if a tap landed. |
| **Selected** | An element is chosen/active among peers (a selected table row, a selected tab, a selected filter chip). | Must be distinguishable by more than color alone (blueprint §17 contrast rule extends here) — a shape, icon, or weight change accompanies any color-based selected state. |
| **Dragging** | An element is being repositioned via drag interaction. | Reserved for genuinely spatial/ordering tasks (e.g., a future curriculum-module reordering surface) — never the *only* path to reorder; a keyboard-operable move-up/move-down alternative is required per blueprint §17's "every custom input fully operable without a mouse." |
| **Disabled** | An action is unavailable in the current context. | Per blueprint §6.1 rule 3: within a domain the user partially has access to, disabled is never silent — a one-line reason renders alongside it (e.g., "Delete Group" disabled with "has attendance history"). Whole-domain absence (a Student never seeing Finance) is invisible, not disabled — this state is reserved for partial, explainable restriction only. |
| **Loading** | Content or an action's result is being fetched/processed. | Always a Skeleton (§12), never a spinner replacing a whole region (blueprint §9/§14) — the shape of the eventual content is telegraphed, not hidden. |
| **Empty** | A region has legitimately no content to show. | Never bare — always paired with the Utilities category's Empty State component (§6), which answers "why" and "what next" per blueprint §13. |
| **Success** | An action completed as intended. | Auto-dismissing, non-blocking (blueprint §12) — the user keeps working through it, never forced to acknowledge a routine success. |
| **Warning** | An action completed with a caveat, or a state needs attention without being an error. | Persists longer than Success; escalates to an inline banner if it affects currently-visible data (blueprint §12). |
| **Danger** | An irreversible or high-consequence action is pending or has failed. | Always paired with an explicit confirmation naming the specific entity (blueprint §8.5) — danger styling alone is never sufficient confirmation for a destructive action. |
| **Keyboard** | The full set of keyboard-only interaction paths. | Every Primitive and Pattern is fully operable without a pointer (blueprint §8.8, §17) — this is a Primitive-layer requirement (§6.1), not a per-screen audit item, precisely so the Quality Checklist (§18) can verify it by construction rather than by manual testing every screen. |
| **Touch** | The full set of touch-only interaction paths. | Minimum 44×44px targets (blueprint §16.6) on every mobile-first surface; swipe gestures are always additive, never the sole path to an action (blueprint §16.6) — both are Sizing (§4) and Interaction Architecture requirements simultaneously. |
| **Mouse** | Pointer-and-click interaction on desktop surfaces. | The default assumption for Admin/Team-Leader analytical Density (§9) — hover-driven discovery (§7.1) is safe to lean on here specifically because these are the two roles guaranteed to be on desktop (blueprint §1.3). |

---

## 8. Layout Architecture

Eight layout archetypes, each the structural home for one or more of the 17
Templates the execution plan already found in production (§3 of that
document). Defined by responsibility only — no visual design.

| Layout | Responsibility | Maps to (execution plan Template) |
|---|---|---|
| **Application Layout** | The persistent chrome shell for one authenticated surface — sidebar/topbar/bottom-nav per portal, per blueprint §4.1. Owns primary navigation only; owns no domain content. | The 9 `layout.tsx` shells already in production |
| **Workspace Layout** | A multi-panel container for power-user surfaces — list/detail/action-panel composition, colocated `components/`/`dialogs/`/`hooks/`. | Workspace (Groups, Instructors, Payroll) |
| **Dashboard Layout** | KPI row + recent activity + tasks + quick actions, per blueprint §11's fixed element set — role-scoped content, fixed structural shape. | Role Dashboard (Home) |
| **Wizard Layout** | Numbered, always-visible, backward-navigable step progression ending in a mandatory review step, per blueprint §8.2. | Multi-Step Wizard |
| **Authentication Layout** | Minimal chrome, no primary nav, credential-entry-focused. | Authentication |
| **Detail Layout** | Header (name + StatusBadge + identity metadata) + one-primary-action + optional tabs + metadata rail, per blueprint §10. | Detail Profile |
| **Table Layout** | Filter bar + sortable/paginated table + bulk-action bar, per blueprint §9. | Data Table/List |
| **Responsive Layout** | The breakpoint-driven behavior contract governing how every other Layout above collapses — table-to-card-list (blueprint §16.5), sidebar-to-bottom-nav (§4.1), multi-column-to-single-column forms (§16.4). | Cross-cutting — applies to every Template above |

### 8.1 Two Templates deliberately left outside this table

**Calendar/Scheduling** and **Portfolio/Timeline** (execution plan §3) are
chronological-data archetypes, not structural containers — they compose
Detail Layout or Table Layout internals with a Data Presentation choice
(§10: Calendar, Timeline) rather than defining a new Layout shape. This is a
deliberate taxonomy decision, not an omission: it keeps Layout Architecture
answering "where do things go" and leaves "how is this specific data best
read" to §10, avoiding the two questions being conflated the way the
blueprint itself warns against for navigation (§4.3: primary/secondary nav
answers a different question than context nav, and must look different).

### 8.2 Overlay is a Layout modifier, not a ninth Layout

Per §6's Overlay Component category, Create/Edit/View can render *inside* a
Modal or Drawer overlay instead of occupying a full route. This is
represented as a modifier on Table Layout or Detail Layout (an overlay
carries the same Wizard or Form internals it would on a dedicated route), not
as its own Layout archetype — because the underlying content structure is
identical either way; only its container changes. This is the precise
mechanism that resolves execution plan Gap #1: the *threshold* for choosing
overlay-modifier vs. dedicated-route (field count, concern count, per
blueprint §8.1/§8.2's existing ≤8-fields/one-concern rule) is a Governance
decision (§16) to make once, and every future entity applies it mechanically
rather than re-deciding it.

---

## 9. Information Density Strategy

### 9.1 The four densities

| Density | When used | Sizing/spacing character |
|---|---|---|
| **Dense** | HQ/Admin analytical surfaces with large row counts (Attendance at 559 lines, Analytics at 988 lines) | Maximum information per viewport; smallest comfortable touch/click target (mouse-only context permits this) |
| **Comfortable** | Default Admin/Team-Leader operational surfaces (most Data Table/List and Detail Profile screens) | The baseline — legible, unhurried, still desktop/tablet-oriented |
| **Compact** | Mobile-portal list/feed surfaces (Parent, Student browsing) | Tighter vertical rhythm than Comfortable, but still pointer-agnostic — these roles browse more than they act |
| **Touch** | Any surface an Instructor operates *during* a live session, and any primary action surface for Parent/Student | Enforces the 44×44px minimum (blueprint §16.6) unconditionally — this density exists specifically to protect the blueprint's 30-second-attendance goal (§1.2) from ever being compromised by a visually denser default |

### 9.2 Density is a token, not a component fork

Per the Application Token layer (§5.5), density is resolved once at the
portal/surface boundary and flows down through Component Tokens — a `Table`
Component is not reimplemented per density, its row-height and padding
Component Tokens simply resolve differently depending on which Application
Token context it renders in. This directly protects Composition over
Duplication (§2.8): four densities must never produce four `Table`
components.

### 9.3 Density-to-breakpoint-to-persona mapping

| Persona | Primary device | Default density |
|---|---|---|
| Administrator | Desktop | Dense (analytical surfaces) / Comfortable (CRUD surfaces) |
| Team Leader | Desktop + tablet | Comfortable, shifting to Compact on tablet-width Workspace views |
| Instructor | Phone + tablet | Touch, always — no exceptions, even on tablet (blueprint §16.3's "reduce columns, don't shrink font" applies here) |
| Parent | Phone | Compact for browsing, Touch for any actionable surface (feedback submission, password reset) |
| Student | Phone + shared classroom device | Touch, always — the persona least tolerant of small targets (blueprint §1.3, §2.5) |

This table is the direct architectural implementation of blueprint §16.1's
three-tier philosophy, made explicit as a fourth, orthogonal axis (density)
rather than conflated with breakpoint (§4's Density/Breakpoint distinction).

---

## 10. Data Presentation Philosophy

| Presentation | Appropriate when | Not appropriate when |
|---|---|---|
| **Tables** | Row-comparable, sortable/filterable data at meaningful volume (Students, Attendance, Finance) — the default for Admin/Team-Leader bulk data per blueprint §9 | The viewer is on a phone (collapses to Cards instead, blueprint §16.5) or the data has no comparable columns |
| **Cards** | Mobile table-collapse target (blueprint §16.5); also the native format for browsable, visually-led content (gamification student cards, portfolio project cards) | Data that genuinely needs cross-row comparison at a glance — a card grid hides that |
| **Lists** | Simple, low-metadata sequences — notification feeds, activity feeds (blueprint §11), search results (blueprint §4.5) | Anything the user needs to sort, filter, or compare across multiple attributes — that's a Table |
| **Trees** | Genuinely hierarchical data with parent-child structure — course/module curriculum structure is Robocode's clearest use case | Flat entity lists that only *feel* hierarchical by naming convention (e.g., Groups are not a tree of Branches — that's a filtered list, per the blueprint's own ownership-model rule, §10.1) |
| **Timelines** | Chronological, append-only, achievement- or event-oriented records — Portfolio/Timeline template, attendance history, a Group's audit History section (blueprint §10) | Data with no inherent time axis |
| **Calendars** | Date/session-oriented scheduling views — Team Leader and Instructor Calendar templates | Any list that happens to contain a date field but isn't fundamentally about *when* |
| **Charts** | A trend or comparison is the actual point (revenue over time, attendance rate by branch, per blueprint §11) — governed jointly with the `dataviz` skill | A single number is the point — that's a KPI/Metric, a chart there is decoration that competes with clarity (blueprint §11 explicit rule) |
| **Metrics (KPIs)** | 3–5 top-line numbers, each timeframe-labeled, per blueprint §11 | More than 5 on one dashboard — that's a sign the page needs sectioning (blueprint §11), not more cards |
| **Activity Feeds** | Scoped, role-appropriate, chronological, deep-linking recent-event streams (blueprint §11) | An undifferentiated firehose — always capped with a "view all" into the relevant domain's list (blueprint §11) |
| **Comparison Views** | Explicitly comparing peer entities — branch performance, instructor performance (blueprint's Operations Intelligence domain) | Comparing an entity against its own history — that's a Timeline or a Chart trend line, not a Comparison View |

### 10.1 Decision heuristic

Ask, in order: (1) Does this need cross-row comparison? → Table (desktop) /
Card (mobile). (2) Is time the primary axis? → Timeline or Calendar,
depending on whether the unit is an event-in-sequence or a
date-on-a-schedule. (3) Is a trend or a peer-comparison the point? → Chart or
Comparison View. (4) Is it a single important number? → Metric, never a
chart. This heuristic exists so a new entity's "how should its data be shown"
question has a mechanical answer (§17), not a fresh design debate per entity.

---

## 11. Navigation Architecture

| Element | Architectural role | Governing rule |
|---|---|---|
| **Sidebar** | Primary nav, one per authenticated portal, fixed domain order across all five roles | Blueprint D-09 — order never varies by role, only which items are present |
| **Topbar** | Persistent cross-page chrome — search entry point, notification bell, account menu | Already proven (`AdminTopbar`, execution plan §2.1) — extend, don't reinvent, per §6's Feedback category note |
| **Breadcrumb** | Supplementary path context on any page nested >1 level from domain root | Blueprint §4.4 — never a substitute for the Detail Layout's "Back" affordance, always additive to it |
| **Tabs** | Secondary nav (horizontal row under page header, domain-shape visibility) and Context nav (within-entity, visually distinct from Tabs-as-secondary-nav) | Blueprint §4.2/§4.3 — the two must never be visually identical, since they answer different questions ("what part of the system" vs. "what else is true about this one thing") |
| **Command Palette** | The unifying `Cmd/Ctrl+K` surface for navigate-to-entity, navigate-to-page, and quick actions | Not yet built (D-07) — architected here as one Overlay-category surface with three result sections, specifically so it is never retrofitted as three competing overlays later (blueprint §4.7's explicit warning) |
| **Search** | Global, tenancy-scoped, entity-grouped, deep-links to detail pages only | Blueprint §4.5 — architecturally distinct from in-table filtering (§9's Table Layout), which is local and never conflated with this |
| **Workspace Navigation** | Internal list/detail/action-panel switching within a Workspace Layout (§8) | Scoped entirely inside one Workspace instance — never leaks into or competes with portal-level Sidebar navigation |
| **Quick Actions** | The dashboard's small, curated 2–4 button action row (blueprint §11) | The one place blueprint §4.6's "one primary action" rule is deliberately relaxed, because the dashboard *is* the hub — this exception is intentional and singular, not precedent for relaxing it elsewhere |
| **Context Navigation** | Detail-page tabs answering "what else is true about this entity" | Blueprint §4.3 — implemented via the Detail Layout (§8), never a second sidebar |

### 11.1 Why these nine don't compete

Each answers a structurally different question — "where am I in the product"
(Sidebar), "how did I get to this specific record" (Breadcrumb), "what
sibling views exist here" (Tabs), "take me anywhere, right now" (Command
Palette/Search), "what do I usually do next" (Quick Actions). The
architectural discipline is ensuring no future addition duplicates a question
one of these nine already answers — this is precisely the failure mode D-07
warns against (three separate overlays for what should be one palette with
three sections), generalized to the whole Navigation category.

---

## 12. State Architecture

| State | Definition | Rendered via (Component Taxonomy §6) | Blueprint anchor |
|---|---|---|---|
| **Loading** | Content is being fetched for the first time | Skeleton (Utilities) | §14 |
| **Skeleton** | The specific loading treatment matching real content's shape | Utilities, parameterized per Layout (§8) | §14 |
| **Refreshing** | Previously-loaded content is being silently updated | Small "updated Xs ago" indicator + brief highlight/pulse, never a full reload flash | §14 |
| **Empty** | Legitimately no data | Utilities Empty State, distinct copy for true-empty vs. filtered-empty | §13 |
| **Error** | An action or fetch failed | Feedback category (banner/toast) + Utilities Error Boundary | §15 |
| **Offline** | No network connectivity | Persistent, dismissible-but-reappearing banner; loaded data stays visible/interactable | §15 |
| **Permission** | Viewer lacks access to a specific sub-resource (rare, per blueprint §6.1) | Utilities, calm/explanatory, never a raw 403 | §15 |
| **Deleted** | Entity was soft-deleted | Detail Layout renders a "removed" state with restore path if permitted | §13, §7 (D-04) |
| **Archived** | Entity is inactive-but-retained | List filter toggle surfaces it; never vanishes | §7 |
| **Draft** | Entity or form content not yet committed | Distinct StatusBadge bucket (Neutral, per `DESIGN.md` §3) | §12 |
| **Pending** | Awaiting approval/action (payroll run, lead) | Warning-bucket StatusBadge + Approval Queue Template | §11, §12 |
| **Completed** | Terminal, successful state | Success-bucket StatusBadge | §12 |

### 12.1 The one rule this section exists to enforce

Every state above is rendered through exactly one shared Component (Utilities
or Feedback, §6) — never hand-rolled per screen. This is what makes
blueprint §13/§14/§15's behavioral guarantees ("never a bare no-data state,"
"loading is always visually distinct from empty," "every error states what
happened and what to do next") true *by construction* across 300 future
screens, rather than something re-verified screen by screen. The Quality
Checklist (§18) checks for *use of the shared primitive*, not for manual
re-verification of each rule's intent — that verification already happened
once, when the primitive was built.

---

## 13. Accessibility Architecture

| Concern | Architectural requirement | Robocode-specific weight |
|---|---|---|
| **Keyboard** | Every Primitive (§6.1) is Tab/Shift+Tab/Enter/Escape/Arrow operable with a visible focus outline, by construction — not audited per screen | An HQ admin doing bulk data entry, or a power-user Team Leader living in a Workspace, is meaningfully faster on keyboard — this is a productivity requirement for the heaviest-usage roles, not solely a compliance one |
| **Screen Readers** | Every icon-only control carries an accessible label at the Primitive layer; dynamic content (toasts, live counts) uses `aria-live` | Parents and students are the roles most likely to include assistive-technology users unfamiliar with the product's internal logic — the accessible label is often their *only* description of what a control does |
| **Focus** | Always visible, always distinct from hover (§7.2) — a Primitive-layer, not Screen-layer, guarantee | Same rationale as Keyboard above |
| **Contrast** | 4.5:1 body text / 3:1 large text and icons, enforced at the Token layer (§5) so no Component can be built with a non-compliant Semantic Token pairing | Directly named in this task's constraint: young students and parents on older, dimmer, sometimes cracked-screen phones in bright classrooms are Robocode's *typical* condition, not its edge case — contrast here is a usability requirement first, a compliance requirement second |
| **Reduced Motion** | Every Motion-category (§4/§14) transition has a `prefers-reduced-motion`-respecting reduced or instant alternative, defined once per motion tier, not per animation | Gamification's celebratory motion (badge unlock, XP gain, streak animation, §14) is aimed squarely at children and must never be the *only* form the reward signal takes — a reduced-motion student still needs to feel that they earned something, via a non-motion cue (color, sound-optional badge state, copy) |
| **Touch** | 44×44px minimum enforced via the Touch density token (§9), not a per-screen check | Same rationale as §7.2/§9 — this is the architectural guarantee behind blueprint's 30-second classroom goal |
| **Localization** | Every Component's text is externalized, never hardcoded — a Foundation-layer requirement given Robocode already ships Arabic | Already proven infrastructure (`LanguageProvider`, Cairo font swap per `DESIGN.md` §7) — the architectural requirement going forward is that no *new* Component regresses this by hardcoding English strings |
| **RTL Support** | Logical properties (`padding-inline-start`, not `padding-left`) required at the Component layer for any directional CSS, per `DESIGN.md` §7's existing rule, formalized here as a Component Taxonomy-wide requirement, not a per-file convention | Robocode already treats RTL as first-class (blueprint doesn't scope this as future work — it's live); this document's contribution is making the *rule* ("logical properties, always") a taxonomy-level gate any new Component must pass, not a style-guide suggestion to remember |

---

## 14. Motion Philosophy

No animation values are defined here — only when motion exists, when it must
not, and how it's governed.

### 14.1 Why motion exists

Motion communicates three things Robocode genuinely needs communicated: (1)
**causality** — this action caused that change (a saved row highlighting
briefly, blueprint §14's "brief highlight/pulse on changed values"); (2)
**spatial continuity** — where did this new panel come from, and where does
it return to (a drawer sliding from the edge it will return to); (3)
**emotional payoff** — for the one persona motion is allowed to be
expressive for: a student unlocking a badge or climbing the leaderboard
deserves a moment of delight, because that delight is the entire mechanism
by which gamification (blueprint's Learning Record domain) retains a
child's engagement.

### 14.2 When motion must never exist

Any ledger-adjacent, financial, or bulk-analytical surface (Finance,
Payroll, Attendance ledgers, HQ Analytics) uses the *quiet* motion tier only
— state-change transitions on borders/shadows, nothing that could be
mistaken for the data itself changing meaning. `DESIGN.md` §6 already states
this instinct ("Admin surfaces: minimal motion... No scroll-triggered
animation in the LMS"); this document elevates it to an architectural rule:
a screen in the Finance/Ledger Surface or Governance/System Tooling Template
(§8) is categorically forbidden from using the Celebratory motion tier
(§14.3), full stop — an HQ admin reconciling a discrepancy must never wonder
whether a number visually "bounced" because it changed or because a
designer wanted delight there.

### 14.3 Motion hierarchy

Four tiers, least to most expressive, each gated to specific Template/portal
combinations:

1. **State-change (quiet)** — border/shadow/opacity transitions on
   hover/focus/pressed. Used everywhere, including Finance/Governance.
2. **Component transitions** — drawer slides, dropdown reveals, tab
   switches. Used on all Admin/Team-Leader/Instructor surfaces; never used
   to imply data has changed meaning (that's tier 1's job).
3. **Page-level transitions** — used sparingly, primarily on
   Instructor/Parent/Student mobile navigation (a screen genuinely replacing
   another), never on Admin/HQ route changes where instant response is more
   valuable than transition polish (§2.5's per-persona performance budget
   directly governs this choice).
4. **Celebratory** — badge unlocks, XP gain, streak milestones, certificate
   reveal. Reserved exclusively for the Learning Record domain's
   student-facing surfaces. Never used in Admin, Finance, or Governance
   contexts, and always paired with a Reduced-Motion-safe non-motion
   alternative (§13).

### 14.4 Interaction feedback

Every user-initiated action gets an immediate Pressed-state response (§7.2)
independent of network latency — motion here is a *confirmation the tap
registered*, distinct from the eventual Success/Error feedback (§7.2, §12)
once the server responds. This distinction matters specifically for
Instructor classroom use: the tap-confirmed feeling must be instant even on
poor Wi-Fi, while the save-confirmed feeling can lag slightly behind it.

### 14.5 Page transitions

Reserved for tier 3 above — full-page transitions are a *mobile portal*
concept, not an Admin/HQ one, because a Next.js server-rendered route change
on a desktop admin table benefits far more from being instant than from
being pretty (this echoes §2.5's performance-budget split directly).

### 14.6 Micro-interactions

Checkbox ticks, toggle flips, badge-count increments, star/heart fills —
tier 1 or 2 depending on context, always brief (Timing, §4), always
optional-feeling rather than blocking the next interaction.

### 14.7 Performance constraints

Motion must degrade gracefully on the lowest-common-denominator device
Robocode actually serves: an older Android phone on classroom Wi-Fi. This
means: no motion blocks interactivity (a user can always interrupt an
in-progress animation by taking the next action), no motion is implemented
in a way that requires downloading a heavy animation library on
Instructor/Parent/Student bundles (their performance budget, §2.5, is the
strictest in the system), and every tier-4 Celebratory animation has a
cheap, instant fallback that still communicates the outcome for a
low-powered device or a reduced-motion preference (§13).

---

## 15. Future Proofing

| Future need | How the architecture already absorbs it | What would have to change |
|---|---|---|
| **New modules** (e.g., a future Waitlist concept, blueprint §3.3) | New Domain Components (§6) + Screens (§3), composed from existing Foundation/Primitives/Patterns | Nothing below the Component layer — this is the entire point of the layer system (§3.2) |
| **New portals** (e.g., a Sales/Marketing-ops portal beyond today's five) | A new Application Layout (§8) instance, reusing every Navigation (§11), Template (§8), and Component (§6) category already defined; only its Sidebar's domain subset (blueprint §3.2) is new | A new Application Token set (§5.5) if the portal's persona genuinely needs a different density/sizing default — still no Foundation change |
| **White label** (franchise-model academy partners under their own brand) | A new Theme Token set (§5.6) layered on unchanged Foundation/Primitive/Semantic/Component layers | Migrating `DESIGN.md`'s remaining raw-hex call sites fully into the Semantic Token layer (§5.7) — the one piece of technical debt this future scenario would actually expose |
| **Dark Mode** | Same mechanism as White Label — a second Theme Token set; genuinely useful for Instructors in projector-dimmed classrooms and evening-use Parents/Students, not just a preference toggle | Same Semantic-Token-completeness prerequisite as above |
| **Internationalization** (languages beyond English/Arabic) | Plugs into the already-proven `LanguageProvider`/logical-properties infrastructure (§13) — a new language is a new translation set and, if RTL/LTR-agnostic, zero layout changes | A font-swap rule (per Arabic/Cairo's existing pattern, `DESIGN.md` §2) if the new language's script isn't Latin-compatible with the existing type Foundation (§4) |
| **AI-generated screens** | §17 exists specifically so this is safe by default — an AI agent (any future session, with no memory of this one) composing strictly from Templates (§8) and the Component Taxonomy (§6) cannot produce an off-system screen, because the system's vocabulary is the only vocabulary available to compose with | Ongoing discipline: §17's rules must stay current as the taxonomy grows, or a future AI session has stale guidance to follow |
| **Future components** | The extension protocol in §16.3/§17 — propose against the existing taxonomy first, extend only on a genuine gap, log the decision | Nothing structural — this is a process guarantee, not a technical one |

---

## 16. Governance

### 16.1 Ownership

The Design System is owned by a **Design System Lead** function — in
practice, whoever is actively working session-to-session on Robocode LMS
(human or AI agent) inherits this responsibility for the duration of their
work, and is bound by the rules in this document exactly as the blueprint
binds every session to its own rules (blueprint §20). There is no scenario
in which "no one owns this" is an acceptable state — every session touching
a shared Component, Pattern, or Foundation category is, for that session,
the Design System Lead for that change.

### 16.2 How changes happen

| Layer touched | Process |
|---|---|
| Foundation, Tokens, Primitives, Patterns | Requires an explicit decision entry (mirroring blueprint §19's Design Decision Log format: decision + rationale) before implementation. These layers have the highest fan-out; an undocumented change here is the single highest-risk action in this entire system. |
| Components, Templates | Requires checking the existing Component Taxonomy (§6) / Template inventory (§8) first (§17's procedure). A genuinely new entry is documented in this file's relevant section at time of creation — not after the fact, not "when someone gets around to it." |
| Screens | No Governance process required beyond the Quality Checklist (§18) — this is the intentionally fast lane, since Screens are where daily product work happens and over-gating it would push builders toward silently routing around the system instead of using it. |

### 16.3 Versioning

Not semantic-versioned as a package (Robocode's Design System is not
consumed externally) — instead, every Pattern/Component contract change is
classified as **additive** (new optional prop/behavior, safe everywhere,
implemented directly) or **breaking** (changes existing behavior/removes a
prop, requires the process in §16.5). This binary classification is the
right-sized version discipline for a single-codebase, continuously-deployed
system — a formal semver scheme would add ceremony without adding safety
here.

### 16.4 Deprecation

A Component, Pattern, or Template being replaced is marked deprecated (a
code comment plus a decision-log entry, per §16.2) and continues to work
through one full migration cycle. This directly extends the execution plan's
own recommendation for the legacy-redirect inventory (§13.2 of that
document: add telemetry, review periodically, retire on a schedule) —
applied here at the Design System layer instead of the route layer. No
deprecated pattern is silently removed while any Screen still references it.

### 16.5 Breaking changes

Require: (1) an explicit decision-log entry stating what breaks and why the
break is worth it, (2) a scoped migration plan naming every known consumer
(cheap at 181 routes, still tractable at 300 if the Component Taxonomy §6
has been followed — this is a second-order argument for why Composition
over Duplication, §2.8, must hold: an un-consolidated, forked component
tree makes "every known consumer" an unanswerable question), and (3) the
migration executing before or atomically with the breaking change landing
— never a "we'll fix the other consumers later" merge.

### 16.6 Review process

Every change at the Foundation/Tokens/Primitives/Patterns/Components/
Templates layers is checked against the Quality Checklist (§18) before
merge. This is the same discipline the blueprint applies to UX decisions
(§20 MUST #9: design new patterns consistently, then document them) applied
to the Design System's own artifacts.

### 16.7 Approval

For a single-maintainer or AI-agent-driven development model (Robocode's
actual current state, per `AGENTS.md`/`CLAUDE.md`), "approval" means: the
change was checked against §18's checklist, the relevant section of this
document was updated in the same change if a new pattern was introduced, and
— for breaking changes specifically — the human user was informed before the
change landed (this mirrors the general system-level guidance already
governing this codebase: destructive or hard-to-reverse actions are
surfaced for confirmation, not silently executed).

---

## 17. AI Development Rules

Robocode LMS is built and maintained substantially by AI agents across
disconnected sessions with no persistent memory of prior work (per
`AGENTS.md`/`CLAUDE.md`). This makes the following rules load-bearing in a
way they would not be for a stable human team — a rule violated once by a
human is usually caught by that human's own memory of the codebase; a rule
violated once by an AI agent with no memory of the last session is a rule
the *next* agent has no way to know was ever established, unless it's
written down here.

### 17.1 Before building anything

1. **Check the Component Taxonomy (§6) for an existing category and, within
   it, an existing named unit that already does this job**, or is one
   capability-check away from doing it (per blueprint §6.1). Building a new
   unit when an existing one could be extended is the single most common way
   this system rots (this is exactly how execution plan Gap #2 happened).
2. **Check the Template inventory (§8) for an existing structural shape**
   before inventing a new page layout. 17 templates already cover 181
   routes — a genuinely 18th-template need is rare and itself a signal to
   pause and verify, not proceed.
3. **Check whether the entity/screen touches a domain already covered by an
   existing Pattern** (CRUD lifecycle, confirm-then-destroy, multi-step
   wizard) before writing bespoke interaction logic.

### 17.2 Building Components

- A new Component is placed in exactly one Component Taxonomy category
  (§6.1). If it doesn't cleanly fit one, that's a signal to reconsider its
  scope before building it, not to force-fit it.
- A new Component references Semantic Tokens (§5.3), never raw Primitive
  values, and never a role-specific fork of an existing Component's
  responsibility (§2.8, D-02).
- A new Component that needs to behave differently per role does so via an
  internal capability check (blueprint §6.1), never via a second Component
  file.

### 17.3 Building Templates

- Extending the 17-Template inventory (§8) is a Governance-level action
  (§16.2) — propose the new Template's structural definition, confirm no
  existing Template already covers the case with minor variation, then
  document it in this file before or alongside first use.

### 17.4 Building Pages (Screens)

- A Screen is exactly one Template (§8) + real domain content + real
  permission scope (blueprint §6, §3.1/§3.2 for domain and permission
  placement). No Screen invents layout structure that isn't already a named
  Layout Architecture archetype (§8).
- Domain placement and permission-surface placement are two separate,
  explicit decisions for every new route (blueprint §3.3) — never inferred
  from "which folder felt right."

### 17.5 Building Features

- A feature spanning multiple Screens reuses the same Domain Component
  (§6.1) across every Screen it touches — a feature is never an excuse to
  duplicate a Component "just for this feature's specific need." If the
  existing Component genuinely can't serve the new need, extend its
  contract (additive, §16.3) rather than forking it.

### 17.6 Building Dashboards

- Follow blueprint §11's fixed element set (KPIs, Charts, Recent Activity,
  Alerts, Tasks, Quick Actions) exactly — a Role Dashboard Layout (§8) is
  never restructured per role; only its content/scope varies (blueprint
  §6.1 rule 5).

### 17.7 Reviewing existing code

- When asked to review or modify an existing screen, check it against the
  Quality Checklist (§18) as the baseline — flag, don't silently fix,
  anything that deviates from an established pattern unless the fix is the
  explicit task at hand (mirrors the general operating principle already
  governing this codebase: don't take unrequested destructive or
  broad-scope action).

### 17.8 Refactoring

- A refactor that consolidates a duplicated pattern (e.g., resolving
  execution plan Gap #2) is a Breaking Change process (§16.5) if it changes
  any Component's contract — even when the end result is more consistent
  with this document, the migration must be planned and every consumer
  accounted for, not landed as a silent behind-the-scenes swap.

### 17.9 The one rule underneath all the others

**Never invent a new pattern when an existing one, possibly with a small,
additive extension, already does the job.** Novelty in this system is not
free — it is the single largest tax this document exists to prevent Robocode
LMS from paying, at 300 screens, across however many disconnected AI
sessions build them. When a genuinely new pattern is truly needed, build it
once, well, and add it to this document (per blueprint §20 MUST #9's
identical instruction at the UX layer) — so the *next* session inherits it
instead of re-deriving it.

---

## 18. Quality Checklist

The gate every new or modified Component, Template, Screen, or Feature must
pass before merge.

### 18.1 Layer discipline

- [ ] Placed at the correct System Layer (§3) — a Screen doesn't contain
      Component-layer logic that belongs in a shared Component; a Component
      doesn't hardcode Foundation-layer values.
- [ ] References Semantic Tokens (§5.3), never raw Primitive values, for
      every color/spacing/motion/sizing decision.
- [ ] Fits an existing Component Taxonomy category (§6.1) or Template
      archetype (§8) — if it doesn't, a Governance decision (§16.2) exists
      documenting why a new one was warranted.

### 18.2 Reuse discipline

- [ ] No new component was created where an existing one, possibly extended
      additively, would have served (§2.8, §17.1).
- [ ] No role-specific fork of a shared Component exists — permission
      differences are capability checks inside one component (blueprint
      §6.1, D-02).
- [ ] If this change resolves a previously duplicated pattern, it followed
      the Breaking Change process (§16.5), not a silent swap.

### 18.3 Permission and data

- [ ] Tenancy/permission scoping happens server-side (blueprint §6.1 rule
      4) — the component trusts what it receives, it doesn't re-filter a
      full dataset client-side.
- [ ] Whole-domain absence is invisible (not shown-disabled); partial,
      in-domain restriction is shown-disabled with a stated reason
      (blueprint §6.1 rule 3, §7.2 Disabled state).
- [ ] Groups (operational) and Enrollments (financial) are never merged
      into one status concept, if this screen touches either (blueprint
      §10.1, D-03 — the most-repeated rule in the blueprint for a reason).

### 18.4 States

- [ ] Loading renders as a shape-matching Skeleton, never a spinner over
      the whole region (§12, blueprint §14).
- [ ] Empty is never bare — states why and offers a next action, and is
      visually distinct from a filtered-empty state (§12, blueprint §13).
- [ ] Error names what happened, whether data is safe, and what to do next
      — never a bare "something went wrong" (§12, blueprint §15).
- [ ] Every destructive or ledger-adjacent action is confirmed, names the
      specific entity, and is never optimistic (§12, blueprint §8.4/§8.5,
      D-06).

### 18.5 Interaction and accessibility

- [ ] Every interactive element is keyboard-reachable with a visible focus
      state, distinct from hover (§7.2, §13, blueprint §17).
- [ ] Every hover-revealed affordance has a touch-visible equivalent
      (§7.1).
- [ ] Touch targets meet 44×44px minimum on any mobile-first surface (§9,
      §13, blueprint §16.6).
- [ ] Contrast meets 4.5:1 body / 3:1 large-text-and-icon minimums, via
      Semantic Token pairing (§13).
- [ ] Any motion respects `prefers-reduced-motion` with a non-motion
      fallback that still communicates the outcome (§13, §14.3 tier 4 in
      particular).

### 18.6 Density and responsiveness

- [ ] Density (§9) matches the persona/portal this screen serves — not an
      arbitrary or copy-pasted choice.
- [ ] Tables collapse to card lists below the tablet breakpoint, never
      horizontal-scroll a dense grid on a phone (§8, §10, blueprint §16.5).
- [ ] The correct Layout Architecture archetype (§8) was used for this
      screen's structural shape.

### 18.7 Motion

- [ ] Motion tier (§14.3) matches this screen's domain — no Celebratory
      motion outside Learning Record student-facing surfaces; no motion
      beyond quiet state-change on Finance/Governance surfaces (§14.2).
- [ ] No motion blocks interactivity or requires a heavy dependency on a
      mobile-first persona's bundle (§14.7).

### 18.8 Documentation

- [ ] If this change introduced a genuinely new pattern (new Component
      category, new Template, new Foundation category), it was documented
      in the relevant section of this file, not left implicit in code
      (§16.2, §17.9).
- [ ] If this change is a Breaking Change (§16.3), a decision-log entry and
      migration plan exist and were executed, not deferred (§16.5).

---

## Self-Review

- [x] No UI was designed — every section defines categories, responsibilities,
  and relationships, never a specific layout, color, or component render.
- [x] No colors were selected — §5 and §13 discuss the *existence* of color
  token layers and contrast requirements, never a hex value; existing values
  are only cited as evidence from `DESIGN.md`, never restated as new.
- [x] No tokens were created — §5 defines the five-layer token *architecture*
  and cites `StatusBadge`'s six buckets as proof the Semantic layer already
  works, without naming or defining a single new token.
- [x] No components were implemented — §6 defines an eleven-category taxonomy
  and cites `StatusBadge`, the Workspace pattern, and `.ds-card` as existing
  proof points; no new component's props, structure, or code appear anywhere.
- [x] No Tailwind classes exist anywhere in this document.
- [x] No React code exists anywhere in this document.
- [x] Every decision scales to 300+ screens — the layer model (§3), taxonomy
  (§6), and Governance process (§16) are explicitly built so a new entity or
  screen composes from existing layers rather than requiring a new one, and
  §1.4's success criteria are stated in terms that hold at 20 screens or 300.
- [x] Every decision supports 5+ years of growth — §15 traces five concrete
  future scenarios (new modules, new portals, white label, dark mode, i18n,
  AI-generated screens, new components) directly to the architecture already
  defined in §3–§6, with no scenario requiring a foundational rewrite.

This document is optimized specifically for Robocode LMS as an educational
SaaS platform, not a generic admin-dashboard system: the Density Strategy
(§9) and Interaction Architecture (§7) are built around the 44×44px,
touch-primary, classroom-Wi-Fi reality of Instructors and Students, not a
desktop-only assumption; the Motion Philosophy (§14) explicitly reserves
expressive, celebratory motion for gamification aimed at children while
keeping every financial and governance surface deliberately quiet; the Token
Architecture's Dark Mode case (§5.6) is grounded in a real Robocode
condition (a projector-dimmed classroom) rather than a generic feature
request; and the AI Development Rules (§17) are written for the specific,
already-true fact that this codebase is built across disconnected AI agent
sessions with no persistent memory — which is the actual condition this
entire document exists to make safe.
