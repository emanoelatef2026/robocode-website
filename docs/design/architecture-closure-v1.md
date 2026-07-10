# Robocode LMS — Architecture Closure v1

**Status:** Closure. This document does not replace `product-blueprint.md`,
`ux-execution-plan.md`, `design-system-architecture.md`, or
`component-library-specification.md`. It **finalizes** them: it resolves every
Critical and High issue named in `architecture-audit-report.md`, answers the
seven decision areas the audit found open, and declares whether architecture
is frozen. After this document, no further architectural documentation is
required before implementation begins. Amendments to the four prior documents
happen only as append-only entries logged in §7 of this document (the same
append-only discipline the blueprint's own §19 and the DSA's own §16.2
already use) — no prior document's text is rewritten.

**Authority:** Where this document states a decision, it is binding and
supersedes any "flagged for team decision," "open item," or ambiguous
language in the four prior documents on that specific point. Everything the
four documents already state without ambiguity remains untouched and in
force.

**Board composition (per task framing):** Reviewed against Principal Product,
UX, Design System, Frontend, Staff Engineering, and Accessibility concerns —
the same lens the audit applied.

---

## 1. Method

Every Critical and High issue in `architecture-audit-report.md` §11 (Risk
Register) is closed below in §2–§3, using: Issue ID · Problem · Root Cause ·
Decision · Justification · Consequences · Implementation Guidance · Owner ·
Priority · Verification Method · Status. Medium/Low issues are closed with
the same rigor at lighter weight in §4, so nothing from the audit is left
open. §5 answers the seven Required Decisions as permanent, standalone
rulings (cross-referencing §2–§4 where a decision and an issue are the same
thing viewed from two angles). §6 is the AI onboarding fix. §7 is the
amendment log against the three prior constitutional documents. §8 is
cross-document validation. §9 is the implementation-readiness verdict. §10 is
the Freeze Certificate.

---

## 2. Critical Issues — Closed

### CLS-C1 — Offline-write architecture for the attendance/ledger path

**Problem:** Blueprint §1.2 goal #1 requires attendance recordable in under 30
seconds "with poor Wi-Fi." Blueprint D-06 forbids treating any ledger-adjacent
write (attendance, finance, enrollment) as optimistic. No document specifies
what happens when a write is *initiated* offline or mid-flight loses
connectivity. (Audit §6.1, Risk Register Critical #1.)

**Root Cause:** The Offline state defined in blueprint §13/§15 and DSA §12
only covers *reads* ("data already loaded remains visible"). Nobody extended
it to writes, because D-06's "never optimistic" rule was read as "therefore
offline writes are out of scope" rather than "therefore offline writes need a
non-optimistic queuing model."

**Decision:** Offline writes are **queued, never faked**. A write made
without connectivity (or that loses connectivity mid-flight) enters a
**Pending Sync** state — a state distinct from both "Saved" and "Failed,"
rendered honestly, never presented as success. This does not violate D-06:
optimistic means *pretending the server confirmed something it hasn't*;
queuing means *telling the truth that confirmation is still pending*. The two
are not the same thing, and the audit's apparent D-06-vs-offline contradiction
dissolves once that distinction is named.

- **Which operations are allowed to queue offline:** Any single ledger-write
  the user can complete without needing to read server-authoritative data
  first (e.g., "mark this student Present") — the input itself doesn't depend
  on a live round trip.
- **Which operations require a live connection before the user can even
  attempt them:** Anything requiring a fresh server read to be safe (e.g., an
  enrollment-balance-affecting action that must see the current balance
  before proceeding) — these show a "requires connection" state, not a queue
  option.
- **Conflict resolution philosophy:** The server is the sole arbiter of
  acceptance. Every queued write carries a client-generated idempotency key
  (so a retried submission is never double-applied) and an
  "as-of" version/timestamp of whatever state the user last saw. If the
  server's current state has diverged in a way that makes the queued write
  unsafe to apply blindly (see CLS-H-adjacent concurrency decision, §5
  Decision 1 cross-ref and §4 CLS-M3), the write is rejected back to the user
  as a surfaced, actionable conflict — never silently merged, never silently
  dropped, never silently overwritten.
- **Queue strategy:** A local, persistent, per-device queue, FIFO per entity,
  visible to the user via a "Pending Sync (n)" indicator (extends the
  Feedback/BackgroundJobProgressIndicator category already named in
  `component-library-specification.md` §4.7) — never a silent background
  queue the user can't see or inspect.
- **Synchronization philosophy:** Automatic retry with backoff the moment
  connectivity returns; no user action required to trigger a sync attempt,
  but the user can always see it happening.
- **Recovery strategy:** A queued write that ultimately fails (validation
  error, rejected conflict, expired session) surfaces as a named, actionable
  item requiring explicit user review — it never quietly disappears from the
  queue.

This is a philosophy, not an implementation: no queue library, storage
mechanism, or retry algorithm is chosen here — that is Phase 1/2
implementation work, sequenced against `component-library-specification.md`
§10.

**Justification:** This is the only model consistent with both named
constraints simultaneously — the 30-second classroom goal (which requires
*some* tolerance for bad connectivity) and D-06 (which forbids lying about
confirmation). It also matches the product's own philosophy already stated in
blueprint §1.4 ("the record is the source of truth, not the memory of the
person entering it") — a Pending Sync item is exactly that: an honest,
visible record of an attempt, not a memory the app pretends already landed.

**Consequences:** `AttendanceGrid` (component-library-spec §5.4, P0) must be
built with a Pending Sync state as a first-class UI state from day one, not
retrofitted. Every other Finance/Ledger Surface component inherits the same
state contract.

**Implementation Guidance:** Add "Pending Sync" as a named state in
`design-system-architecture.md` §12 (State Architecture) and as a required
row in every ledger-adjacent Business Component's specification. No further
architectural decision is required before building it.

**Owner:** Whoever builds `AttendanceGrid` (Education domain family, Phase 6)
and the Finance domain family (Phase 6) — this is a Pattern-layer
responsibility (DSA §16.2), reusable across both.

**Priority:** Critical — blocks the product's own stated top goal.

**Verification Method:** A screen composed of `AttendanceGrid` must
demonstrably show Pending Sync, Saved, and Failed as three visually distinct
states (Quality Checklist §18.4 gains a fourth bullet: "ledger-adjacent writes
have a Pending Sync state distinct from both Saved and Failed").

**Status:** RESOLVED — architecture decided; implementation pending (Phase 6,
per existing sequencing, no re-sequencing required since this is a state
addition, not a new component).

---

### CLS-C2 — Tenancy-scoping enforcement mechanism named

**Problem:** Blueprint §6.1 rule 4 mandates server-side tenancy scoping and
states "the UI can trust that anything it received, the viewer is allowed to
see," repeated as a gate in DSA §18.3 and component-spec §15.2 — but no
document names the actual mechanism, and none of the four cross-reference
`CLAUDE.md`'s own binding RLS mandate. (Audit §6.3, Risk Register Critical
#2.)

**Root Cause:** The four design documents were authored as a UX/design-system
series and never cross-checked against the codebase's own governance
document (`CLAUDE.md`), which already names RLS as mandatory for every new
table. Two true, non-conflicting rules existed in two different documents
that never referenced each other.

**Decision:** Tenancy/permission scoping is a **two-layer, defense-in-depth**
model, named permanently as follows:

1. **Primary layer — Server Actions / Route Handlers.** Every data read or
   write for an authenticated surface is scoped by an explicit tenancy filter
   (branch_id for Team Leader, own-record id for Instructor/Parent/Student)
   applied in the Server Action itself, using the service-role Supabase
   client server-side only (per `CLAUDE.md`'s existing rule). This is the
   layer that determines *what a screen receives* — a Team Leader's query
   never runs without a branch filter attached.
2. **Secondary layer — Row-Level Security.** Every table has RLS enabled with
   at least one explicit policy (per `CLAUDE.md`'s existing, unchanged
   mandate) as the non-bypassable safety net: even a bug in a Server Action's
   filter logic cannot leak a cross-tenant row, because the database itself
   refuses to return it.

The UI-facing rule ("the component trusts what it receives," blueprint §6.1
rule 4, DSA §18.3) refers to the *output of both layers combined* — a
Business Component is never responsible for re-filtering a dataset it
received; that responsibility belongs entirely to the two layers above it,
never to the Component layer.

**Justification:** This resolves the audit's finding without inventing a new
mechanism — it simply names the one `CLAUDE.md` already mandates and states
explicitly how it composes with the UX layer's existing trust assumption.
Defense-in-depth (not "either/or") is the correct model because Server
Actions optimize for correct UX (a Team Leader's query returning zero rows
for another branch, not a 403) while RLS optimizes for security (a
provable, non-bypassable guarantee).

**Consequences:** Every new table's migration must include RLS + an explicit
policy in the same migration (already required by `CLAUDE.md` — this closure
adds no new obligation, it removes the ambiguity about *why* that rule
exists and *how* it relates to the UX layer's stated trust assumption).
`get_advisors` must be run after every migration per `CLAUDE.md` — reaffirmed
here as the mechanical verification step for this exact decision.

**Implementation Guidance:** No new construction required — this is a naming
and cross-referencing closure. Component authors building any Business
Component that renders scoped data can now cite this section (or
`CLAUDE.md`'s Governance section directly) as the enforcement mechanism
instead of leaving it implicit.

**Owner:** Every Server Action author (primary layer); the migration author
(secondary layer, per existing `CLAUDE.md` Governance rules).

**Priority:** Critical — security-relevant.

**Verification Method:** `get_advisors` run after every migration (already
mandated); a new Quality Checklist bullet in DSA §18.3: "this screen's data
was scoped by a Server Action with an explicit tenancy filter, and the
underlying table has RLS enabled with a policy — cite both, not just one."

**Status:** RESOLVED — mechanism named, no implementation gap remains (RLS
mandate was already enforced by `CLAUDE.md`; this closure only removes the
cross-document ambiguity the audit found).

---

### CLS-C3 — Children's-data erasure vs. no-hard-delete-in-UI

**Problem:** Blueprint D-04 bans hard delete from the UI, absolutely, with no
exception stated. The Student persona is frequently a child. Data-subject
erasure regimes (COPPA and equivalents) typically require a genuine deletion
capability on a parent's request. No document reconciles the two. (Audit
§6.4, Risk Register Critical #3.)

**Root Cause:** D-04 was written as a blanket architectural rule
(soft-delete/archive/restore only) intended to protect ledger and
operational-history integrity from routine, accidental, or malicious data
loss. It was never intended to — and does not need to — cover the distinct,
rare case of a lawful erasure request. The rule and the exception were never
separated in writing, so the rule read as absolute when it was only ever
meant to govern *routine* CRUD delete.

**Decision:** D-04 is **amended with one narrow, explicit exception**,
logged as a new Design Decision Log entry (§7, D-11): a **Data Erasure
Request** workflow exists as a distinct, HQ-Admin-only, deliberately
high-friction Platform Governance action — never a delete button on a
student record, never self-service, never reachable from any routine List or
Detail page.

- Erasure requests are actioned only by an Administrator, only after a
  verified request (from a parent, for a minor; from the data subject
  directly, for an adult Parent/Instructor/Team Leader record), and require
  an explicit, logged justification at time of action.
- Execution anonymizes personally identifying fields (name, contact details,
  free-text notes referencing the individual) while preserving
  non-identifying aggregate records the business has a legitimate,
  separately-justified reason to retain (e.g., an anonymized attendance count
  or payment total needed for financial reconciliation under accounting
  retention rules) — this is **anonymization of a ledger row**, not deletion
  of the ledger row itself, which is what keeps this consistent with
  D-04/D-06's ledger-integrity principle rather than violating it.
- This workflow is never exposed as "Delete" on any Student/Parent/
  Instructor/Team Leader/Staff record — it is a separate surface
  (Platform Governance domain, alongside `/admin/recovery`), and its
  existence does not create a precedent for any other entity to grow a
  parallel hard-delete path.

**Justification:** This is the minimum change that closes a real legal
exposure without weakening D-04's actual purpose (preventing routine,
accidental, or casual data loss). Separating "routine delete" from "lawful
erasure request" as two structurally different actions — one instant and
reversible, one deliberate and irreversible-by-design — is the same
separation-of-concerns discipline the blueprint already applies to
Groups-vs-Enrollments (D-03); this is that same discipline applied to
Delete-vs-Erasure.

**Consequences:** A new Platform Governance route/action is required
(implementation, not architecture). No existing screen changes. D-04's text
in the blueprint stays as-is for every routine case; this closure's D-11
entry is the sole, logged exception.

**Implementation Guidance:** Build as a Governance-domain feature after
Phase 1–5 foundational work; not on the Wave 1–5 critical path since it
blocks no other work, but should not be indefinitely deferred given its
regulatory nature.

**Owner:** Administrator persona; Platform Governance domain; legal/business
stakeholder input required on jurisdiction-specific retention windows (this
closure states the *architectural* shape, not the specific retention period
— that number is a legal/business decision outside this board's scope, per
§5 Decision 3 below).

**Priority:** Critical — regulatory exposure, should not wait for a
convenient sprint.

**Verification Method:** A Data Erasure Request workflow exists, is
Admin-only, is logged, and produces an audit trail entry distinct from a
routine soft-delete's `deleted_at` timestamp.

**Status:** RESOLVED — architecture decided (D-11 logged in §7); build
scheduled as a near-term Platform Governance feature, not blocking Phase 1–5.

---

### CLS-C4 — Enforcement tooling behind the Quality Checklist, and the naming-convention loophole that produced Gap #2

**Problem:** Two compounding findings, closed together because they share one
root cause. First (audit §4.2/§6.5): the Quality Checklist (DSA §18) and
Quality Gates (component-spec §15) are self-attested markdown checkboxes with
no CI/lint backing — nothing mechanically prevents a future
`TLGroupFinanceSectionV2.tsx` from being created next to
`GroupFinanceSection.tsx`. Second (audit §1.2): the blueprint's own naming
convention (§18) blesses role-prefixed component names
(`InstructorGroupCard`, `AdminTopbar`) as a canonical example in the same
document that calls role-forked components (`GroupDetailView` vs.
`TLEnrollStudentsForm`) the project's single biggest violation — with no
stated test distinguishing the two, meaning the root cause of the project's
own worst-named violation (Gap #2) is still textually present and
uncorrected.

**Root Cause:** Both findings share one cause: the system has *written
rules* but no *mechanical test* a builder (human or AI) can apply in the
moment of deciding "is this a legitimate role-specific component or a
forbidden fork?" — and no automated check that would catch the wrong answer
after the fact.

**Decision:** Two closures, one mechanism each.

**(a) The mechanical fork test (closes audit §1.2 permanently):**

> **Test:** Remove every permission difference between the two roles viewing
> the candidate component. Does the component still need to be a separate
> file?
>
> - **No** (the only difference was which fields/actions are visible or
>   editable) → it is **one shared, capability-gated Business Component**.
>   A second file is a **forbidden fork**, full stop — this is exactly what
>   `GroupDetailView` vs. `TLEnrollStudentsForm` was: same entity (a Group's
>   students), same job (enroll/manage), differing only in what each role
>   could see/do.
> - **Yes** (the component's fundamental structural job differs regardless of
>   permission — e.g., a portal's persistent chrome Topbar vs. an entity
>   Detail page) → a distinct component is legitimate, **provided it still
>   composes from the same underlying Primitives/Patterns/Business
>   Components beneath it** and is never itself a second implementation of
>   an entity's List/Detail/Form job.

Applying this test retroactively: `AdminTopbar` passes (a Topbar is a
structurally distinct navigation-chrome job, not a permission-gated variant
of some other role's Topbar; DSA §11 already treats Topbar as "extend, don't
reinvent" for the *other* roles, meaning the eventual shape is one Topbar
concept applied per portal, not four independent Topbars). `InstructorGroupCard`
is legitimate **only if** it is a structurally distinct compact/glanceable
card used in the Instructor's own list context — not a permission-reduced
fork of a Group Detail page that should instead be one capability-gated
`GroupCard`. Blueprint §18's naming-convention row is amended (§7, D-12) to
state this test explicitly rather than leaving the two examples
unreconciled.

**(b) Enforcement tooling (closes audit §4.2/§6.5):**

The Quality Checklist/Gates remain markdown-based for judgment calls (they
inherently require reading intent), but three concrete, CI-checkable
backstops are now **architecturally required** (implementation of each is a
near-term backlog item, not designed here):

1. **Component Registry Diff Check.** A generated manifest (e.g.
   `docs/design/component-registry.json`) enumerating every Business
   Component export under `app/**/components/**` and equivalents, regenerated
   by a script and diffed in CI against
   `component-library-specification.md` §4/§5's catalog. A PR introducing a
   Business-Component-shaped export not present in the catalog fails CI —
   this operationalizes "search the catalog before building" (component-spec
   §17.1) from a self-attested step into a checked one.
2. **Entity-name collision lint.** A CI check (custom ESLint rule or a
   simple script) that flags two files across `app/admin/**` and
   `app/portal/**` sharing the same base component name for the same
   entity concern (the exact `GroupStudentsTable` ×2 pattern the audit
   found) — this is the direct, mechanical backstop for CLS-C4(a)'s "No"
   branch.
3. **Documentation-paired-PR check.** A PR that adds a new file under a
   Business-Component path must also touch
   `component-library-specification.md` in the same PR (component-spec
   §17 MUST #4's existing rule, now CI-enforced rather than
   self-attested).

**Justification:** (a) gives every future session — human or AI, with no
memory of Gap #2 — a test they can run in seconds, closing the exact
loophole the audit traced Gap #2 back to. (b) is the minimum tooling that
converts "please stay consistent" into "the inconsistent path doesn't
compile" — the audit's own diagnosis of why Gap #2 happened once already
under a less-documented process, and why more documentation alone (a fourth
layer of documents) doesn't fix it without a mechanical backstop.

**Consequences:** Blueprint §18's naming-convention table gains the test
above as an explicit sub-rule (§7, D-12). CI configuration work is required
(implementation) but is not itself an architectural decision — the shape of
each check is specified precisely enough that implementation should not
require a new design conversation.

**Implementation Guidance:** Sequence as: near-term backlog, ideally
alongside or before Phase 1 (Foundation) so it's in place before the bulk of
component-library-spec's Phase 1–7 build begins — a registry check is far
cheaper to introduce before 20+ new components land than after.

**Owner:** Whoever owns CI configuration for the repository (per
`CLAUDE.md`'s existing CI-must-be-green requirement, extended with these
three checks).

**Priority:** Critical — this is the mechanism that determines whether Gap
#2 recurs a third time.

**Verification Method:** All three checks exist, run in CI, and are
demonstrated to fail on a deliberately reintroduced Gap #2-shaped duplicate
(a one-time smoke test at implementation time).

**Status:** RESOLVED — mechanical test (a) is decided and binding
immediately, no implementation required. Enforcement tooling (b) is
architecturally specified; CI implementation is a near-term, non-blocking
backlog item.

---

## 3. High Issues — Closed

### CLS-H1 — Gap #1 (modal-vs-route CRUD) threshold, decided

**Problem:** Three documents (execution plan §13.1 Gap #1, DSA §8.2, and
component-spec §6.2) each describe the *mechanism* by which this will one day
be resolved (a field-count/concern-count threshold) without ever stating the
number, and without recording that a decision was made. 11 shipped routes and
~15 modal-migrated entities depend on this being closed. (Audit §6.2, Risk
Register High #1.)

**Root Cause:** Every document deferred to "a Governance decision to make
once" (DSA §8.2's own words) — but no document in the series was positioned
to actually make it, because each treated it as the next document's job.

**Decision:** **Option A** (per execution plan §13.1's framing) is adopted:
the blueprint's modal/drawer prohibition is formally relaxed for simple
entities, with a concrete threshold, superseding blueprint §7's "never a
modal for anything beyond a 2-3 field entity" language (logged as blueprint
amendment §7, D-13):

| Field count / concern count | Required pattern |
|---|---|
| ≤5 fields, one logical concern | **Overlay (Modal/Drawer) is the default.** A dedicated route is optional, not required, and should only be chosen if the entity specifically benefits from deep-linking/bookmarking (e.g., it's commonly shared via a direct link). |
| 6–8 fields, one logical concern | **Either pattern is acceptable**, but Overlay is preferred for consistency with already-shipped work unless the entity has a specific reason to need a dedicated route. |
| >8 fields, OR spans genuinely distinct concerns | **Dedicated route required**, using the Multi-Step Wizard pattern (blueprint §8.2) — Overlay is never used for this tier. |

This is the same ≤8-field ceiling blueprint §8.1 already uses for
single-page vs. multi-step forms — the closure adds the missing second axis
(Overlay vs. dedicated route) rather than inventing a new number space.

**Justification:** Option A is chosen over Option B (migrate back to
dedicated routes) because 11 routes have already shipped this way, the
approach is lower migration cost, and reversing shipped, presumably
user-validated work has no stated benefit beyond textual purity — the
execution plan itself notes Option A's benefit ("codifies what's already
shipped and evidently works") outweighs Option B's cost (reversing real
engineering work) once a concrete threshold exists to make the "already
shipped" pattern principled rather than ad hoc.

**Consequences:** Every already-migrated entity is reconciled against this
number, not re-litigated per entity. `EntityForm` (component-spec §5.2, P0)
is built once, consumed identically by both dedicated-route and
Overlay-modifier contexts (component-spec §6.2), per the existing DSA §8.2
mechanism — the closure supplies the missing number that mechanism needed.

**Implementation Guidance:** No further decision required. `EntityForm`
build order is unaffected (component-spec §10 Phase 3).

**Owner:** Whoever builds `EntityForm` and reconciles the ~11 already-shipped
modal-migrated routes plus the entities noted as inconsistently migrated in
execution plan §7.3 (`instructors/new`, `groups/[id]/sessions/new`) against
this table.

**Priority:** High — every Create/Edit surface (~43 Pages) was blocked on
this.

**Verification Method:** Every Create/Edit Page's pattern choice is
traceable to this table, not to per-developer judgment; the Quality
Checklist (DSA §18.1) gains a bullet: "Overlay-vs-route choice matches the
field/concern threshold in Architecture Closure v1 §3 CLS-H1, not an ad hoc
call."

**Status:** RESOLVED.

---

### CLS-H2 — Governance ownership across memoryless AI sessions

**Problem:** DSA §16.1 assigns Design System Lead responsibility to "whoever
is actively working... (human or AI agent)" — given the system's own premise
that AI sessions have no memory across sessions, this names no one
accountable across time for the highest-risk layer of decisions (Foundation/
Tokens/Primitives/Patterns). (Audit §6.9, Risk Register High #2 — the
audit's own candidate for root cause underneath several other findings.)

**Root Cause:** "Whoever is working right now" is a valid rule for *who
executes* a change in the moment (and remains so — reaffirmed below), but it
was never paired with a rule for *who is accountable* across sessions when no
single session persists. The two roles (executor vs. accountable owner) were
conflated into one sentence in DSA §16.1.

**Decision:** Ownership is split into two roles that were previously
conflated:

1. **Executing steward (unchanged):** Whoever is actively working on
   Robocode LMS in a given session — human or AI — is the Design System Lead
   *for that session's changes*, exactly as DSA §16.1 already states. This
   remains correct and is not weakened.
2. **Accountable owner (new, closes the gap):** The repository's human
   principal (the project owner directing this work) is the standing,
   cross-session accountable owner of record for every Foundation/Tokens/
   Primitives/Patterns-layer decision and every blueprint §19/DSA §16.2-level
   Decision Log entry. No AI session — however thorough — is the accountable
   owner across time, because none persists across time; this is a factual
   constraint, not a trust judgment, and matches the general operating
   principle already governing this codebase (breaking/hard-to-reverse
   changes are surfaced for human confirmation before landing, per DSA
   §16.7's existing approval language, now made the explicit backbone of
   this closure's ownership model rather than an implicit aside).

**Justification:** This resolves the audit's precise diagnosis — "the
documents name the risk precisely and then assign it to no one" — by naming
someone, without inventing a governance board or process that doesn't fit a
single-maintainer/AI-driven project. It reuses the approval language DSA
§16.7 already had (breaking changes get human awareness before landing) and
simply generalizes it to the standing-ownership question the audit found
missing.

**Consequences:** Every Foundation/Tokens/Primitives/Patterns-layer change,
and every new blueprint §19/DSA §16.2 Decision Log entry, requires the human
principal's awareness before landing — this is a reaffirmation and
generalization of DSA §16.7's existing rule, not a new process.

**Implementation Guidance:** No implementation required — this is a
governance/RACI clarification. See §5 Decision 5 for the fuller elaboration
of change control and versioning built on this same split.

**Owner:** The repository's human principal (accountable owner, standing);
each session's active worker (executing steward, per-change).

**Priority:** High — root cause underneath several other findings, per the
audit's own framing.

**Verification Method:** Every Foundation/Pattern-layer PR or Decision Log
entry can answer "who is the accountable owner of record" without needing to
ask "which session wrote this."

**Status:** RESOLVED.

---

### CLS-H3 — White-label scalability claim corrected

**Problem:** DSA §5.6/§15 and component-spec §18.3 assert white-label
franchising is achievable via "a new Theme Token set... the entire
Foundation/Primitive/Semantic/Component stack is reusable unchanged." This
treats a materially different problem — separate business tenants requiring
data isolation, per-tenant billing, and a tenancy model beyond today's
branch-scoping — as a purely visual rebrand. (Audit §3.1, Risk Register High
#3.)

**Root Cause:** The Token Architecture layer (DSA §5) is genuinely correct
about *visual* rebranding being a Theme Token exercise. The error was scope
creep: the same paragraph extended that correct, narrow claim to cover the
much larger *business/data* problem of multi-tenancy without noticing the
jump.

**Decision:** White-label franchising is **split into two independent
claims**, and the corrected version is logged as a DSA amendment (§7, D-14):

1. **Visual rebrand** (a franchise partner's palette/wordmark on an
   otherwise-identical product): **remains correctly described** as a Theme
   Token set swap — no correction needed to this part of the claim.
2. **Multi-tenant business isolation** (separate franchise partners' student/
   parent/finance/lead data, billing, and compliance boundaries): **is
   explicitly out of scope of the current architecture** and requires its
   own future Architecture Audit-and-Closure cycle if and when the business
   pursues franchising. Today's tenancy model is branch-scoping under one
   organization (blueprint §6.1 rule 4), not organization-level multi-tenancy
   — the two are architecturally different problems, and this closure states
   plainly that the current system does not solve the second one.

**Justification:** This corrects the audit's named risk (a future team
budgeting a rebrand sprint for what is actually a re-architecture) without
requiring any current work — the correction is entirely textual/expectational,
which is the appropriate weight for a scenario that is "Low probability
(only if the business pursues franchising)" per the audit's own risk rating.

**Consequences:** No current build is blocked or changed. Any future
franchising initiative starts from an honest premise instead of a
misleadingly cheap one.

**Implementation Guidance:** None required now. If franchising is pursued,
that initiative's first deliverable should be its own audit-and-closure pair
addressing data-tenancy isolation, per-tenant billing, and compliance —
scoped separately from this document.

**Owner:** Deferred to a future initiative; no current owner needed.

**Priority:** High to correct the *claim* (cheap, textual); Low to act on
the *underlying need* (only triggered if franchising is pursued).

**Verification Method:** DSA §5.6/§15 and component-spec §18.3 are read
alongside this closure's D-14 amendment before anyone scopes a white-label
initiative.

**Status:** RESOLVED (claim corrected; underlying multi-tenancy work
explicitly and permanently out of current scope, not silently deferred).

---

### CLS-H4 — Calendar fork (Gap #H) re-sequenced

**Problem:** Team Leader and Instructor calendars are independently built
with zero shared code, sitting directly on the product's stated #1 goal
(30-second attendance recording), yet sequenced into Phase 6 — the last
component-build phase — purely because it belongs to the Education domain
family, which is sequenced by domain size rather than by criticality. The
audit found the documents themselves acknowledge this tension without acting
on it. (Audit §5.2, Risk Register High #4.)

**Root Cause:** Component-spec §10's phase sequencing is organized primarily
by *structural dependency* (a Domain Component can't be built before the
Table/Form/Workspace layers it composes from are stable) and secondarily by
*domain size* (execution plan §5.1's route-count ranking). Calendar has no
hard structural dependency forcing it into Phase 6 — it was placed there by
the size-ranking heuristic alone, which doesn't account for
frequency-weighted criticality the way §9.1's own "note on frequency vs.
screen-count" already argues it should for `NotificationBell`/
`PermissionGate`.

**Decision:** `CalendarGrid`/`SchedulingView` consolidation is **pulled
forward and built immediately after Phase 4 (Tables)**, in parallel with or
just ahead of Phase 5 (Workspace) — not held for Phase 6. This is a sequencing
change only; the component's specification (component-spec §5.4, §8.1) is
unchanged. Justification for why this is safe to move: Calendar's only true
dependency is `SessionCard` (a small, independently buildable Education
Business Component) plus the already-stable Table/Overlay layers from Phases
3–4 — it does not require Workspace or the rest of the Education family to
exist first, so nothing is broken by building it earlier.

**Justification:** This directly applies the audit's own reasoning (§9.1's
frequency-vs-count principle, and the Risk Register's explicit "front-line
UX drift compounds daily" note) rather than leaving an acknowledged tension
unresolved a second time. The cost of building it slightly out of
domain-size order is low (one component, one dependency); the cost of
leaving two independently-drifting calendar implementations live through
four more phases is the exact daily-compounding risk the audit flagged.

**Consequences:** Component-spec §10's Phase 6 no longer includes Calendar
consolidation as one of its later items — it is a Phase 4/5 deliverable
instead. No other phase's sequencing changes.

**Implementation Guidance:** Build `SessionCard` and `CalendarGrid`/
`SchedulingView` (capability-gated for the TL-vs-Instructor scope
difference, per blueprint §6.1) immediately following Phase 4, ahead of the
remaining Education-family Domain Components.

**Owner:** Whoever executes Phase 4/5 of the component-library build.

**Priority:** High — front-line daily-use surface.

**Verification Method:** One `CalendarGrid` component, capability-gated, is
consumed by both `/portal/team-leader/calendar` and
`/portal/instructor/calendar` before the remainder of Phase 6 begins.

**Status:** RESOLVED (re-sequenced; component-spec §10 amended per §7, D-15).

---

## 4. Additional Resolved Items (Medium/Low, closed at lighter weight)

| ID | Issue (audit ref) | Decision | Owner | Priority | Status |
|---|---|---|---|---|---|
| CLS-M1 | Finance has no currency/precision/timezone contract (§5.1) | Currency is represented in integer minor units (cents) everywhere; rounding uses round-half-to-even at the point of any ledger write, applied by one shared money-math utility, never re-implemented per component; multi-currency is explicitly **out of scope** for the current architecture (single-currency network assumption) and flagged as a future requirement only if the branch network expands cross-border; every "today"/"this week" framing (attendance, sessions, dashboards) uses the **branch's** local timezone, stored per branch — never server time or viewer time, since these are physically local events. | Finance domain component authors (`LedgerTable`, `PaymentTimeline`, `EnrollmentBalanceCard`) | High (blocks Finance P0 build) | RESOLVED |
| CLS-M2 | Native mobile app scalability claim rests on an unstated tech assumption (§3.2) | "Native mobile app" in DSA §3.2/§15 means **React Native** (code-shareable with the existing React component logic) wherever it appears. A true Swift/Kotlin-native app is explicitly a **separate future initiative** requiring new Foundation categories and a rendering-layer rewrite — only the Business Component layer's business logic (not its UI) would be expected to survive that scenario, corrected from DSA §15's unqualified claim. Logged as DSA amendment (§7, D-16). | Deferred — no current owner | Medium | RESOLVED (claim corrected) |
| CLS-M3 | No concurrency/conflict model for multi-actor ledger writes (§6.7) | Every ledger-adjacent write requires an optimistic-concurrency check (a version/`updated_at` compare-and-swap at the Server Action layer). A conflicting concurrent write is **rejected back to the user** with a "this record changed since you loaded it — review and retry" error — never silently last-write-wins, never silently merged. This is the same mechanism CLS-C1's offline-conflict handling uses; named once, applied to both the offline and the concurrent-multi-actor case. | Server Action authors for Group/Attendance/Enrollment writes | Medium | RESOLVED |
| CLS-M4 | No disaster-recovery/RPO-RTO architecture behind `/admin/recovery` (§6.6) | `/admin/recovery` is scoped to **application-level** recovery actions (un-cancel a session, restore a soft-deleted record) — it is explicitly **not** a full database disaster-recovery console. Full-database RPO/RTO is an infrastructure/ops concern owned by whoever administers the Supabase project (point-in-time recovery is the platform-level baseline mechanism), not a UX/UI architecture concern. This boundary was previously unstated; it is now explicit so `/admin/recovery`'s scope is unambiguous. | Infrastructure/ops (outside this document's UX/component scope) | Medium | RESOLVED (scope boundary clarified) |
| CLS-M5 | No abuse/rate-limiting model for `/verify/[code]` and `/book-session` (§6.8) | Both routes require baseline per-IP rate-limiting at the edge/middleware layer. `/verify/[code]` additionally must use non-sequential, non-guessable certificate codes (confirmed as an architectural requirement, not merely a suggestion) — a certificate code is never an incrementing ID. | Platform Governance | Medium | RESOLVED |
| CLS-L1 | Route count self-contradiction, 148 vs. 181, within the blueprint itself (§1.1) | Corrected via amendment, not file edit (§7, D-17) — blueprint line 6's "148+" is superseded; 181 (per execution plan's live re-verification) is authoritative, per Decision 7 (§5) below. | — | Low | RESOLVED |
| CLS-L2 | `/verify/[code]` mis-grouped under Identity & Access instead of Learning Record (§2/§5.3 of execution plan) | Applied via amendment (§7, D-18): blueprint §3.1 Domain 9/3 table is corrected to move `/verify/[code]` to Domain 3 (Learning Record, public sub-surface), per the execution plan's own already-argued recommendation. | — | Low | RESOLVED |
| CLS-L3 | Cross-document verification-date drift, 2026-07-10 vs. 2026-07-11 (§1.3) | No material drift occurred in the one-day gap (confirmed by the execution plan's own re-verification producing the same 181 figure the day after). 2026-07-11 is declared the canonical as-of date for the full four-document set as of this closure; future re-verification passes replace this date wholesale, not incrementally. | — | Low | RESOLVED |

Audit §4.1 ("the P0 component tier is entirely unbuilt") is **not** treated
as an open issue requiring a decision here — it is an accurate factual
snapshot already correctly reflected in component-library-spec §9–§10's
phased build plan (Phases 1–7). No architectural decision was missing; the
work simply had not started. This closure changes nothing about that
sequencing except CLS-H4's Calendar pull-forward.

---

## 5. Required Decisions — Permanent Rulings

### Decision 1 — Offline-First Strategy

Fully specified in **CLS-C1** above. Summary for reference: read-tolerant,
write-honest (never optimistic, always visibly queued); ledger-adjacent
writes queue locally with an idempotency key and surface a distinct
"Pending Sync" state; conflicts are server-arbitrated and rejected-to-user,
never silently resolved (shared mechanism with **CLS-M3**); sync is
automatic on reconnect and always visible; failed queued writes surface as
actionable items, never silently drop.

### Decision 2 — Authorization Architecture

Fully specified in **CLS-C2** above. Summary for reference: two-layer
defense-in-depth (Server Action tenancy filter as the primary,
UX-shaping layer; RLS as the non-bypassable secondary layer, per
`CLAUDE.md`'s existing mandate); permission evaluation happens via
capability-check functions evaluated server-side and passed to components as
already-resolved booleans (component never re-derives); tenant isolation
today means branch-scoping under one organization, not multi-tenant SaaS
isolation (see **CLS-H3**); security ownership is joint between Server
Action authors and migration authors; UX reflects security exactly as
blueprint §6.1 rules 3–4 already state (whole-domain absence invisible,
partial restriction shown-disabled-with-reason) — reaffirmed, not changed.

### Decision 3 — Data Lifecycle

Fully specified in **CLS-C3** above for the erasure question. Completing the
remaining sub-points required by the task:

- **Soft Delete:** `deleted_at` timestamp, the default and only routine
  delete pattern (blueprint D-04, unchanged).
- **Archive:** A distinct `is_archived`-style state for entities with a
  natural inactive-but-retained lifecycle stage (Groups, Courses, Leads),
  never conflated with delete (blueprint §7, unchanged).
- **Restore:** Symmetric to both Delete and Archive, reachable from a
  list-page filter toggle (blueprint §7, unchanged).
- **Legal deletion:** The Data Erasure Request workflow (**CLS-C3**) —
  anonymization of PII fields, preservation of legitimately-retained
  anonymized aggregate records, Admin-only, logged, never a UI delete
  button.
- **Child data:** Erasure requests concerning a minor are actioned only
  through a verified parent request routed to an Administrator — never
  self-service from a student or parent portal directly, given the
  sensitivity and the need for identity verification this board is not
  positioned to design the mechanics of (that verification process is a
  business/legal decision, not an architecture one — flagged, not designed,
  consistent with this document's scope boundary).
- **Retention policy:** This board sets the *shape* (financial/ledger
  anonymized-aggregate retention for accounting purposes; personal data
  retained only as long as operationally needed or until a lawful erasure
  request) but explicitly does **not** set specific retention-period numbers
  (e.g., "7 years") — that is a jurisdiction- and business-specific legal
  determination outside this board's competence and outside this document's
  scope. Flagged as a required near-term business decision, not left
  unstated.
- **Privacy ownership:** The Administrator/HQ role is the sole owner of
  privacy-compliance actions; no other role can initiate a legal erasure
  under any circumstance.

### Decision 4 — Component Ownership

Fully specified in **CLS-C4(a)** above (the mechanical fork test). Restated
in the four-part structure the task requests:

- **Shared Components:** The default assumption for every Business Component
  and above (DSA D-02, unchanged) — a component is not shared only when the
  CLS-C4(a) test's "Yes" branch applies and a documented, permission-driven
  reason exists.
- **Role Wrappers:** A thin **Container Component** (component-spec §7.3)
  that resolves tenancy/capability server-side and passes already-resolved
  props to exactly one shared presentational component. A Role Wrapper never
  contains its own copy of the presentational rendering logic — if it does,
  it has silently become a forbidden fork wearing a wrapper's name.
- **Role-specific Views:** Permitted only when the CLS-C4(a) test's "Yes"
  branch applies — a genuinely different structural job (a portal's Topbar,
  a mobile BottomTabBar vs. a desktop Sidebar), never a permission-reduced
  variant of the same entity's List/Detail/Form.
- **Forbidden Component Forks:** Any second file implementing the same
  entity's same job, differing only by which fields/actions a role can see —
  named, permanently, as the single most consequential rule in this entire
  document series (inherited from DSA D-02, now with the mechanical test
  that makes it checkable rather than aspirational).
- **Allowed Composition:** Container → Presentational → Patterns/Primitives,
  one-way, per DSA §6.2/component-spec §2.1 (unchanged).
- **Required Composition:** Every entity gets exactly one presentational
  Business Component tree per List/Detail/Form job, internally capability-
  gated, consumed by as many Role Wrappers as there are roles that need
  differently-scoped data for it.

Blueprint §18's naming-convention table is amended (§7, D-12) to carry the
CLS-C4(a) test explicitly, closing the `InstructorGroupCard`/`AdminTopbar`
vs. `GroupDetailView`/`TLEnrollStudentsForm` ambiguity the audit found in the
document's own canonical example.

### Decision 5 — Architecture Ownership

Fully specified in **CLS-H2** above (the executing-steward/accountable-owner
split). Completing the remaining sub-points:

- **Who owns architecture:** The repository's human principal is the
  standing accountable owner (CLS-H2); the actively-working session is the
  executing steward for its own changes (DSA §16.1, unchanged).
- **How future architectural changes happen:** Screens/Pages remain the fast
  lane, no approval required beyond the Quality Checklist (DSA §16.2,
  unchanged). Components/Templates are self-checked and logged in the same
  change (unchanged). Foundation/Tokens/Primitives/Patterns and any
  blueprint §19/DSA §16.2 Decision Log entry require the human principal's
  awareness before landing (CLS-H2, generalizing DSA §16.7's existing
  breaking-change rule to the full high-risk layer set).
- **Approval workflow:** As above — tiered by layer, not uniform across the
  whole system, exactly as DSA §16.2 already establishes; this closure adds
  only the accountable-owner name that tier was missing.
- **Versioning:** This document is **Architecture v1.0** — see §10's Freeze
  Certificate. Future amendments are additive Decision Log entries appended
  to whichever of the four constitutional documents they touch, following
  the exact append-only discipline blueprint §19 and DSA §16.2 already use.
  This closure document itself is never silently rewritten; a future
  Architecture Closure v2 would supersede it explicitly if a wholesale
  re-review is ever warranted.
- **Change control:** No document in the five-document set (four
  constitutional + this closure) is edited in place by a future session
  without a logged, superseding Decision Log entry — matching blueprint §20
  MUST NEVER #9's existing "never quietly route around it" rule, now applied
  to the whole document series, not just the blueprint alone.
- **AI responsibilities:** Read this closure plus the four constitutional
  documents before any architecturally-significant work; apply the
  mechanical tests/thresholds this closure sets (CLS-H1's field-count table,
  CLS-C4(a)'s fork test, etc.) without re-litigating them each session; log
  any genuinely new pattern per DSA §17.9's existing rule.
- **Human responsibilities:** Final arbiter on any Foundation/Pattern-layer
  change or Decision Log entry (CLS-H2); sole source of the business/legal
  judgment calls this board explicitly declined to make (retention-period
  numbers in Decision 3; whether/when to pursue white-label per CLS-H3).

### Decision 6 — Quality Enforcement

Fully specified in **CLS-C4(b)** above. Restated against the task's specific
sub-points:

- **CI responsibilities:** `tsc --noEmit`, `vitest run`, `eslint .`, and
  `next build` remain the baseline (`CLAUDE.md`, unchanged), extended with
  the three new checks named in CLS-C4(b): Component Registry Diff,
  entity-name collision lint, documentation-paired-PR check.
- **Linting:** Existing ESLint config plus the entity-name collision rule
  (CLS-C4(b) item 2) and a raw-hex-outside-token-files check (extending
  `DESIGN.md` §3's existing rule from a style convention into a lint rule).
- **Architecture validation:** DSA §18's Quality Checklist and component-spec
  §15's Quality Gates remain the judgment-requiring layer; the Component
  Registry Diff (CLS-C4(b) item 1) is their mechanical backstop for the one
  checklist item ("no new component was created where an existing one would
  serve") that was previously unenforceable by a machine.
- **Component validation:** Registry Diff + collision lint, as above.
- **Design validation:** Token-usage lint (raw hex outside Semantic Token
  definitions fails CI), per DSA §5.7's existing rule, now enforced rather
  than merely stated.
- **Documentation validation:** Documentation-paired-PR check (CLS-C4(b)
  item 3) — a new Business Component without a matching catalog entry in
  the same PR fails.
- **Pull Request requirements:** Every PR touching shared
  Components/Templates/Patterns must (1) pass the extended CI suite above,
  (2) reference which Quality Checklist items apply, (3) for
  Foundation/Pattern-layer changes, carry evidence the human principal was
  made aware before merge (CLS-H2/Decision 5).

### Decision 7 — Single Source of Truth

| Topic | Authoritative document | Why |
|---|---|---|
| Current route count | `ux-execution-plan.md` §2 (**181**, re-verifiable via `find app -name page.tsx`) | It is explicitly designed to be re-run against the live tree, unlike the blueprint's static count. Blueprint's "148+" is superseded (§7, D-17). |
| Current portals | `product-blueprint.md` §1.3/§2 (5 academy portals + Studio, separate, per §2.6/D-08) | The blueprint owns persona/portal *definition*; the execution plan maps routes into portals already defined there, it doesn't redefine them. |
| Current layouts | `ux-execution-plan.md` §4 (9 `layout.tsx` files) | Same reasoning as route count — a living, re-verifiable inventory. |
| Current business domains | `product-blueprint.md` §3.1 (10 domains) | The blueprint owns domain *definition* (D-01); the execution plan classifies routes against domains already fixed there. |
| Current templates | `ux-execution-plan.md` §3 (17 templates, current-state inventory) for *what exists in production*; `design-system-architecture.md` §8 (8 Layout Architecture archetypes) for *the structural layer they map to* — **these are two different, complementary axes, not a contradiction** (DSA §8 explains the mapping explicitly). | Neither document duplicates the other's job: one counts screen *types found*, the other defines the structural *containers* those types are built from. |
| Current architecture version | This document, **v1.0**, dated 2026-07-11 | Declared canonical as of this closure (§10 Freeze Certificate). |

---

## 6. AI Onboarding Path (closes audit §3.3)

The audit found DSA §1.4's stated success criterion — "an AI agent session
with zero prior memory can read §17 and §18 and produce a compliant
screen" — does not match the documents' own cross-referencing density (the
audit itself needed all four documents in full to assess one question).
That claim in DSA §1.4 is corrected, not deleted: the accurate version is
that a compliant screen requires reading **this closure document** plus the
two DSA sections it already named, because this closure is the single
navigational entry point that resolves every cross-document ambiguity DSA
§17/§18 would otherwise have silently assumed was settled elsewhere. The
practical reading order for any future memoryless session, going forward, is:

1. **This document** (`architecture-closure-v1.md`) — the decisions, the
   mechanical tests (CLS-C4(a) fork test, CLS-H1 threshold table), and the
   single source of truth per topic (Decision 7).
2. **`design-system-architecture.md` §17–§18** (AI Development Rules, Quality
   Checklist) — the procedural how-to, now consistent with this closure's
   decisions.
3. **`component-library-specification.md` §4/§5** (Component Discovery/
   Specifications) — "does this already exist" lookup, per that document's
   own stated purpose.
4. The blueprint and execution plan **only as needed**, for behavioral detail
   this closure and DSA §17/§18 reference but don't restate.

This is logged as a DSA §1.4 amendment (§7, D-19).

---

## 7. Amendment Log (append-only; no prior document rewritten)

Following the exact precedent of blueprint §19 and DSA §16.2 — every entry
below is additive and supersedes only the specific line it names. The
underlying files are not edited by this closure; a future editing pass may
fold these into the source files' own decision logs, but until then, this
log is authoritative for the corrections it names.

| ID | Amends | Supersedes | New ruling |
|---|---|---|---|
| D-11 | `product-blueprint.md` D-04 | The absolute "hard delete never exposed in the UI" reading | A narrow Data Erasure Request exception exists — CLS-C3. |
| D-12 | `product-blueprint.md` §18 naming-convention table | The unreconciled `InstructorGroupCard`/`AdminTopbar` vs. `GroupDetailView`/`TLEnrollStudentsForm` examples | The mechanical fork test — CLS-C4(a). |
| D-13 | `product-blueprint.md` §7 Create row ("never a modal beyond 2-3 fields") | The unstated Gap #1 threshold | The ≤5 / 6–8 / >8 field table — CLS-H1. |
| D-14 | `design-system-architecture.md` §5.6/§15, `component-library-specification.md` §18.3 | The unqualified "white-label is just a Theme Token swap" claim | Split into visual-rebrand (unchanged, correct) vs. multi-tenancy (out of scope, future initiative) — CLS-H3. |
| D-15 | `component-library-specification.md` §10 Phase 6 | Calendar consolidation's placement in Phase 6 | Pulled forward to immediately follow Phase 4 — CLS-H4. |
| D-16 | `design-system-architecture.md` §3.2/§15 "native mobile app" rows | The unstated native-vs-React-Native assumption | "Native" means React Native; true native is a separate future initiative — CLS-M2. |
| D-17 | `product-blueprint.md` line 6 ("148+ routes") | The self-contradiction with line 15-16's 181 figure | 181 is authoritative, per Decision 7 — CLS-L1. |
| D-18 | `product-blueprint.md` §3.1 Domain 9 table | `/verify/[code]`'s placement under Identity & Access | Reclassified to Domain 3 (Learning Record, public sub-surface), per execution plan §5.3 — CLS-L2. |
| D-19 | `design-system-architecture.md` §1.4 | The "read §17/§18 alone" success criterion | Corrected reading path via this closure — §6 above. |

---

## 8. Cross-Document Validation

With the above closed, the four constitutional documents were re-checked
against each other for any contradiction this closure might have missed or
introduced:

- **Product Blueprint ↔ UX Execution Plan:** Consistent. The execution
  plan's Gap #1/#2/#3 findings are now each closed (CLS-H1, CLS-C4, and
  execution plan §13.1 Gap #3 — the `/dashboard/analytics` consolidation —
  which was already correctly scoped to Wave 4 with no architectural
  ambiguity and required no closure action beyond noting it here as
  correctly sequenced, not a gap).
- **Product Blueprint ↔ Design System Architecture:** Consistent. D-02's
  "one shared component tree" now has the CLS-C4(a) mechanical test it
  previously lacked; D-04's absolute delete rule now has its one logged
  exception (D-11) rather than an unaddressed silent conflict with erasure
  rights.
- **Design System Architecture ↔ Component Library Specification:** Consistent.
  The component-spec's Phase sequencing (§10) is unchanged except for CLS-H4's
  Calendar pull-forward, which the component-spec's own dependency reasoning
  (§10.1) supports rather than contradicts.
- **All four ↔ `CLAUDE.md`/`AGENTS.md`:** Now explicitly cross-referenced for
  the first time (CLS-C2) — no remaining contradiction between the design
  series' UX-trust assumption and the codebase's own RLS mandate.

**No contradictions remain.** Every issue the audit traced to a genuine
cross-document inconsistency (rather than a merely-undocumented gap) is
closed above.

---

## 9. Implementation Readiness

**Is the architecture now frozen? YES.**

This answer is scoped precisely, per the audit's own distinction between
"is the planning good" and "is the project ready to start implementation"
(audit §10): **freezing architecture means the decision-space is closed, not
that every component is already built.** Every blocking decision the audit's
§10 verdict cited as a reason to answer NO is now closed:

- The offline/latency contradiction with the product's #1 goal — closed
  (CLS-C1).
- The tenancy-scoping mechanism's cross-check against `CLAUDE.md` — closed
  (CLS-C2).
- The children's-data erasure conflict — closed (CLS-C3).
- The enforcement-tooling gap and its root-cause naming loophole — closed
  (CLS-C4).
- Gap #1's threshold — closed (CLS-H1).

What remains is **execution**, already correctly sequenced in
`component-library-specification.md` §10 Phases 1–7 (with CLS-H4's one
re-sequencing applied): building `AdvancedTable`, `EntityForm`,
`DetailLayout`, `ConfirmDialog`, `ErrorBoundary`, and the Group/Student
consolidation. None of that work requires a further architectural decision —
it requires building against decisions that are now made. Phase 1 may begin
immediately.

---

## 10. Architecture Freeze Certificate

> **ROBOCODE LMS — ARCHITECTURE FREEZE CERTIFICATE**
>
> **Architecture Version:** v1.0
> **Date:** 2026-07-11
> **Approved Documents (frozen as of this date, as amended per §7 above):**
> 1. `docs/design/product-blueprint.md`
> 2. `docs/design/ux-execution-plan.md`
> 3. `docs/design/design-system-architecture.md`
> 4. `docs/design/component-library-specification.md`
> 5. `docs/design/architecture-closure-v1.md` (this document)
>
> **Frozen Scope:** UX architecture, information architecture, navigation,
> CRUD/form/table/detail/dashboard standards, permission philosophy,
> component taxonomy, token architecture, layout architecture, component
> catalog and build sequencing, offline-write strategy, authorization
> architecture, data lifecycle (including the erasure exception), component
> ownership rules (including the mechanical fork test), governance ownership,
> quality enforcement requirements, and the single-source-of-truth mapping in
> Decision 7 above.
>
> **Explicitly NOT Frozen / Out of Scope (named, not silently omitted):**
> visual design values (`DESIGN.md`'s domain, unchanged); specific data
> retention-period numbers (Decision 3, a pending legal/business
> determination); multi-tenant white-label architecture (CLS-H3, deferred to
> a future initiative); true native-mobile (Swift/Kotlin) architecture
> (CLS-M2, deferred); CI tooling implementation details for the checks named
> in Decision 6 (specified architecturally, not yet built).
>
> **Future Change Process:** Any change to a Screen/Page requires no
> approval beyond the existing Quality Checklist. Any change to a
> Component/Template requires the Component Registry Diff check (once built)
> plus a same-PR documentation update. Any change to Foundation/Tokens/
> Primitives/Patterns, or any new Design Decision Log entry in any of the
> five documents above, requires an explicit, logged, superseding entry
> (never a silent edit) and the standing accountable owner's (§5 Decision 5)
> awareness before landing.
>
> **Implementation Authorization:** Implementation of
> `component-library-specification.md` §10 Phase 1 (Foundation) is
> **authorized to begin immediately**. No further architectural sign-off is
> required for Phases 1–7 as currently sequenced (including the CLS-H4
> Calendar re-sequencing applied above).

---

## Self-Review

- [x] Every Critical issue resolved (CLS-C1–C4).
- [x] Every High issue resolved (CLS-H1–H4).
- [x] Every Medium/Low issue from the audit closed at appropriate weight
  (CLS-M1–M5, CLS-L1–L3), so nothing from `architecture-audit-report.md` §11
  is left open.
- [x] All seven Required Decisions answered as permanent rulings (§5),
  cross-referencing rather than duplicating the Critical/High closures they
  overlap with.
- [x] No new contradictions introduced — §8 re-validated all four documents
  against each other and against `CLAUDE.md`/`AGENTS.md` after applying
  every decision above.
- [x] No prior document was rewritten — every correction is an append-only
  amendment logged in §7, exactly matching the append-only precedent
  `product-blueprint.md` §19 and `design-system-architecture.md` §16.2
  already established for themselves.
- [x] No new features, no visual design, no code, and no UI were introduced
  anywhere in this document — every decision is architectural/behavioral,
  consistent with the scope boundary every one of the four prior documents
  already holds itself to.
- [x] Architecture is implementation-ready (§9): Phase 1 may begin without
  further architectural sign-off.
