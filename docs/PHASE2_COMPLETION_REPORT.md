# Phase 2 Completion Report — Graduation Workflow

**Date:** 2026-07-14
**Scope:** The Graduation Wizard — the end-of-semester operational workflow that
turns a Completed cohort into its next academic cycle, activating the
previously-dormant `student_enrollments.renewal_of` and `groups.series_id`
columns (Phase 0) for the first time. Reuses everything from Phase 0/0.5/
Priority 0/Phase 1 — no schema redesign, no new `groups.status` enum values.
**Status:** ✅ Complete. Quality gate green (tsc/eslint/build/vitest). Production
acceptance QA (66/66) passed against a live Postgres instance — see §10a.
Full sign-off record: `docs/PHASE2_ACCEPTANCE_REPORT.md`.

---

## 1. Architecture summary

A resumable, 7-step wizard (Cohort Summary → Validation → Student Decisions →
Next Cohort → Enrollment Preview → **Review & Confirm** → Commit), launched
from a Completed cohort's Actions menu. The one write — creating the next
cohort, chaining `renewal_of`, and transitioning the old cohort's roster — is
a single atomic Postgres RPC, `commit_cohort_graduation()`, modeled on the
existing `cancel_schedule_with_cascade()` transactional pattern
(migration `0099`) rather than the sequential, non-atomic `.insert()` chains
every other enrollment path in this codebase uses.

Three deliberate architectural boundaries, all confirmed with the user before
implementation:

1. **No financial accounts are ever created by this workflow.** Continuing/
   repeating/transferring students get a new, unbilled `student_enrollments`
   row; real pricing is set afterward via the existing Enrollment & Contract
   flow — matching the existing "student added without a contract yet" shape
   already used elsewhere in this codebase (`applyStudentChanges`).
2. **No heuristic pre-selection of student decisions.** Every student starts
   at "No Decision." A recommendation is computed and displayed, but never
   auto-applied — the operator must explicitly decide for every active
   student, enforced at three independent layers (UI exit gate, Server
   Action pre-flight, and a DB-level coverage guard inside the RPC itself).
3. **No course/instructor/schedule configuration is ever attempted
   automatically**, not even best-effort. The next cohort is always created
   bare and immediately surfaced as **"Draft – Setup Required"**, both on the
   Step 7 result screen and persistently in the Groups workspace list, with
   a guided path to the existing Edit Group flow to finish configuring it.

The wizard is also **resumable**: progress can be saved and picked up later,
scoped one draft per (cohort, user) pair so two team leads working the same
cohort never silently clobber each other's decisions — each sees the other's
draft as a non-blocking notice, and a draft whose cohort gets graduated by
someone else is automatically marked stale rather than allowed to walk into a
doomed commit.

Finally, the commit is protected by a genuine **idempotency key**: the wizard
generates a `request_id` on entering the Review & Confirm step, and a retried
commit carrying that same key after the original already succeeded returns
the original result instead of erroring — safe against double-clicks,
browser retries, and network retries of the same logical request.

## 2. Database changes

- **`groups`** gains 4 columns: `graduated_at`, `graduated_to_group_id`,
  `graduated_from_group_id` (mirrored reverse pointer, set on the new
  cohort), `graduation_request_id` (the idempotency replay key).
- **`cohort_graduation_decisions`** (new table) — insert-only, one row per
  student per graduation: `old_group_id`, `new_group_id`, `student_id`,
  `decision`, `old_enrollment_id`, `new_enrollment_id`, `performed_by`. RLS:
  read-only, gated by `graduate_cohort`; writes only via the RPC.
- **`cohort_graduation_drafts`** (new table) — resumable wizard state:
  `step`, `new_group_draft` (JSONB), `decisions` (JSONB), `request_id`,
  `status` (`in_progress`/`committed`/`discarded`/`stale`),
  `committed_group_id`, `created_by`/`updated_by`. A partial unique index on
  `(old_group_id, created_by) WHERE status='in_progress'` enforces one
  active draft per cohort **per user**. RLS: read gated by `graduate_cohort`
  for the whole cohort (so "another draft exists" can be surfaced); write
  gated to the owning row (`created_by`).
- **`commit_cohort_graduation(p_payload, p_performed_by, p_request_id,
  p_draft_id)`** — the one atomic write. `SECURITY DEFINER`, single
  transaction, `RAISE EXCEPTION` rolls back everything on any failure.
  Deliberately does **not** write `group_courses`/`group_instructors`/
  `schedules`/`student_financial_accounts`. Guards, in order: request-id
  not-null, row lock (`FOR UPDATE`), replay check (same `request_id` after
  success → returns original result), stage guards (not found / already
  graduated / not Completed), coverage guard (every active student must
  have a decision). Per decision: transitions the old `group_students` row;
  for continue/repeat/transfer, inserts a new `student_enrollments` row
  (`renewal_of` chained) and a new `group_students` row in the target
  cohort; always inserts a `cohort_graduation_decisions` row. Closes with
  the idempotency latch, optional draft closure, and an audit log write —
  all inside the same transaction.
- **`graduate_cohort`** permission, seeded to `team_leader` + `super_admin`.
- Two follow-up hardening migrations, applied in the same session after
  `get_advisors` flagged them (matching this repo's established convention
  from `20260705202917_security_hardening.sql`):
  - `REVOKE EXECUTE ... FROM anon, authenticated` on `commit_cohort_graduation`
    (it's `SECURITY DEFINER` with an internal write, but permission
    enforcement lives in the TS Server Action layer, not the function body —
    it must only ever be called via the service-role client, exactly like
    `write_audit_log`/`cancel_schedule_with_cascade`).
  - Covering indexes for every new FK column; RLS policies rewritten to
    `(select auth.uid())` (evaluated once per statement, not once per row —
    this repo's own established convention,
    `20260706061255_phase4_rls_wrap_auth_functions.sql`); split
    `cohort_graduation_drafts`' ownership policy from `FOR ALL` into
    `FOR INSERT`/`FOR UPDATE` so `SELECT` is no longer double-evaluated by
    two permissive policies.

## 3. Migrations

| File | Purpose |
|---|---|
| `supabase/migrations/20260714130000_cohort_graduation_workflow.sql` | Schema + RPC + RBAC seed (§2) |
| Follow-up: security hardening (`REVOKE EXECUTE`) | Applied via `apply_migration`, named `cohort_graduation_workflow_security_hardening` |
| Follow-up: performance hardening (indexes + RLS rewrite) | Applied via `apply_migration`, named `cohort_graduation_workflow_performance_hardening` |

All applied to the live Supabase project (`fkqwafedruparlqjiprq`) via the
migration tool, never manual SQL Editor, per `docs/MIGRATIONS.md`.
`get_advisors` (security + performance) run after each — zero findings tied
to any Phase 2 object remain after the two follow-ups.

## 4. Files modified

### New

| File | Purpose |
|---|---|
| `modules/groups/actions/cohort-health.ts` | Extracted shared warning-computation logic (refactor, see §11) |
| `modules/groups/actions/graduation-helpers.ts` | Pure functions: `recommendDecision`, `allDecided`, `buildGraduationRpcPayload`, `decisionCountsSummary` |
| `modules/groups/actions/graduation.ts` | All Server Actions: 5 read-only wizard-data functions, 3 draft actions, `commitCohortGraduation` |
| `components/ui/WizardStepper.tsx` | Shared step-header primitive |
| `app/portal/team-leader/groups/workspace/dialogs/graduation/GraduationWizard.tsx` | The 7-step wizard |
| `tests/phase2/cohort-graduation.test.ts` | 25 new tests |
| `supabase/migrations/20260714130000_...sql` + 2 hardening follow-ups | See §3 |
| `docs/PHASE2_COMPLETION_REPORT.md` | This file |

### Modified

| File | Change |
|---|---|
| `modules/groups/actions/lifecycle.ts` | Refactored `validateCohortArchival` to reuse `computeCohortHealthWarnings` — zero change to external behavior, all 18 Phase 1 tests still pass unmodified |
| `modules/rbac/types.ts`, `modules/rbac/permissions.ts` | New `graduate_cohort` permission; `team_leader` default set |
| `modules/groups/operational.ts` | `GroupOperationalRow` + its query gain `graduated_at`/`graduated_to_group_id`/`graduated_from_group_id` |
| `components/admin/StatusBadge.tsx` | New `setup_required` status entry |
| `app/portal/team-leader/groups/workspace/components/StatusChip.tsx` | Renders "Draft – Setup Required" for a Draft cohort born from graduation |
| `app/portal/team-leader/groups/workspace/components/GroupActionsDropdown.tsx`, `GroupSummaryBar.tsx` | New "Start Graduation" / "View Next Cohort →" menu item |
| `app/portal/team-leader/groups/workspace/GroupWorkspace.tsx` | Wizard state + launch wiring, `onGraduationCommitted` passthrough |
| `app/portal/team-leader/groups/GroupsWorkspaceClient.tsx` | Selects the newly created cohort after a successful commit |
| `docs/DOMAIN_RULES.md` | New Rule 14; status header and revision history updated |
| `docs/GROUP_SERIES_RULES.md` | §7 and status header updated — `series_id` linkage is no longer purely theoretical |

### Deleted

None — this phase added a new, additive workflow; nothing it replaces was
dead code.

## 5. Wizard flow

1. **Cohort Summary** (read-only) — course, branch, series, instructor(s),
   schedule, students, sessions completed, attendance %, certificates,
   outstanding balances, completion date.
2. **Validation** (read-only) — blockers (not Completed / already graduated)
   vs. structured `{message, recommendation}` warnings (incomplete
   attendance, missing certificates, outstanding balances) — only blockers
   stop progress.
3. **Student Decisions** — every student defaults to "No Decision"; a
   separate "Recommended" badge is shown but never auto-applied; bulk
   select/filter/search + "Apply Recommended to Selected"; exit gate
   requires every active student to have an explicit decision.
4. **Next Cohort** — editable, prefilled draft (series, branch, schedule,
   room, capacity, course, instructor(s), semester); explicitly labeled
   "will be created as Draft."
5. **Enrollment Preview** — continuing/graduating/held/dropped/transferred/
   repeating breakdown, new + historical cohort summaries, nothing
   committed.
6. **Review & Confirm** *(new, requested in final review)* — decision
   counts, new cohort summary, the full affected-student roster, a
   prominent irreversibility warning, and a required "I have reviewed…"
   checkbox before the Commit button enables.
7. **Commit** — the one write, via the idempotent, atomic RPC; result screen
   truthfully separates the guaranteed part ("Graduation committed") from
   the freshly-stated "Draft – Setup Required" guidance — never implying
   the cohort is fully ready when it isn't.

Autosave persists progress on every step transition from Step 3 onward; the
wizard auto-resumes a caller's own in-progress draft on reopen.

## 6. Business rules implemented

- Graduation only reachable from a Completed cohort, exactly once.
- Every active student must have an explicit decision — enforced in 3
  independent layers (UI, Server Action, RPC).
- No financial account is ever created by this workflow.
- The next cohort is always bare (Draft, unconfigured) immediately after
  commit — never conditional on any best-effort step's success.
- Historical rows (attendance, certificates, old enrollments, old financial
  accounts, `group_courses`/`group_instructors`/`schedules`) are never
  touched, with one deliberate exception: the old enrollment's own `status`
  column transitions away from `ACTIVE` per decision (see §13) so it stops
  colliding with the new enrollment on `uq_student_enrollments_active_course`.
- A draft can be saved/resumed any number of times; exactly one in-progress
  draft per (cohort, user).
- `renewal_of`/`series_id` are populated for the first time by this
  workflow.

## 7. Audit implementation

Reuses the existing `write_audit_log` RPC, called **inside** the same
transaction as the rest of the commit (`p_action: 'graduate_cohort'`,
`p_old_values: {status, graduated_at:null}`, `p_new_values: {graduated_at,
new_group_id, decision_counts}`) — the audit row can never diverge from the
data it describes, since both either commit or roll back together.
`cohort_graduation_decisions` is the per-student complement, letting anyone
answer "what did we decide for student X" without parsing a JSON blob.

## 8. Performance review

- The 4 read-only wizard steps each issue a small, bounded number of
  indexed queries per step, batched with `.in()` across students (no N+1) —
  same pattern as the existing `getGroupDetailDataAction`.
- The one write is O(students) inserts inside a single DB round-trip,
  strictly better than every existing sequential-insert enrollment path in
  this codebase.
- `get_advisors` (security + performance) run after every migration in this
  phase; both follow-up hardening migrations were applied in-session to
  resolve everything raised (missing FK covering indexes, per-row
  `auth.uid()` re-evaluation, a double-evaluated permissive RLS policy pair,
  and the `SECURITY DEFINER` callable-by-`authenticated` finding) — zero
  outstanding findings tied to any Phase 2 object.

## 9. Test results

`tests/phase2/cohort-graduation.test.ts` — **25/25 passing**: `recommendDecision`
(display-only, never auto-applied), `allDecided` (the Step 3 exit gate),
`buildGraduationRpcPayload` (asserts instructor/room/planned_sessions/
open_ended never reach the RPC — the round-3 change #4 contract, in code),
`decisionCountsSummary`, `validateCohortGraduation` (blockers + warning
pass-through), `commitCohortGraduation` (permission gate, undecided-student
rejection with zero RPC calls, non-Completed rejection, exact RPC payload
shape, verbatim error surfacing, `replayed` propagation, cross-branch
rejection).

Full suite: **51 files / 404 tests, all passing** (was 50/379 before this
phase — confirms zero regressions, including the `lifecycle.ts` refactor's
behavior-preservation).

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `npx eslint .` | ✅ 0 errors; 2 new warnings, both the same accepted "setState in a reset-on-open effect" pattern already present in `BulkCertificatesModal.tsx` |
| `npm run build` | ✅ Compiled successfully, 0 errors |
| `npx vitest run` | ✅ 51/51 files, 404/404 tests |

**Disclosed limitation** (same as Phase 1): `commit_cohort_graduation()`'s
real atomicity, its `FOR UPDATE` lock, and every `CASE` branch cannot be
exercised by vitest's mocked DB — covered instead by the QA checklist below,
run against a real Postgres instance and closed out in §10a.

## 10. Manual QA checklist

Not yet executed this session — recommended before sign-off, against a
seeded Completed cohort with one student per decision type:

- [ ] Normal graduation: mixed decisions, full happy path.
- [ ] Large cohort (50+ students) — single request, no timeout.
- [ ] Single-student cohort.
- [ ] Empty cohort (zero active students).
- [ ] Cohort with an outstanding balance — non-blocking warning at Step 2.
- [ ] Cohort with a missing certificate — non-blocking warning.
- [ ] Partial continuation — mixed decisions in one commit.
- [ ] Recovery after failure: invalid `transfer_group_id` → zero rows
      created anywhere for that batch; fix and retry without re-entering
      earlier steps.
- [ ] Double-click / retried commit with the same `request_id` → second
      response is `replayed:true` with the identical `new_group_id`, no
      duplicate cohort or enrollments.
- [ ] Two users, two independent drafts on the same cohort → both persist;
      each sees the other listed, never overwritten.
- [ ] User A commits while User B still has an open draft → B's next
      `getGraduationDraft` call marks their draft `stale`.
- [ ] New cohort renders as **Draft – Setup Required** immediately after
      commit; after Edit Group sets course + instructor, the badge updates
      to Open/Running per the existing lifecycle-stage derivation.
- [ ] `renewal_of` chain is visible/walkable for a student graduated twice.
- [ ] Old cohort's `student_enrollments`/`student_financial_accounts` rows
      are byte-identical to a pre-commit snapshot (the single most important
      assertion — proves the "never modifies historical rows" invariant).
- [ ] Cross-branch team_leader is blocked from graduating or drafting for a
      cohort outside their branch(es).

### 10a. Production acceptance QA — executed 2026-07-14

The manual checklist above was superseded by a scripted, automated version
(`docs/qa/phase2_graduation_acceptance.sql`, 66 checks) run against the live
Supabase project (`fkqwafedruparlqjiprq`) inside a single `BEGIN...ROLLBACK`
transaction so nothing persists. Final result: **66/66 passed**. Full detail,
methodology, and permanent record in `docs/PHASE2_ACCEPTANCE_REPORT.md`.

This QA pass found and fixed **two real production bugs** that vitest's
mocked-DB suite could not have caught — both were live schema/constraint
issues, not logic bugs:

1. **`student_enrollments.renewal_of` did not exist on the live table at
   all.** Migration `0054_schema_reconciliation.sql`'s `CREATE TABLE IF NOT
   EXISTS student_enrollments (...)` silently no-opped against an
   already-existing, differently-shaped table — `renewal_of` was declared in
   the migration file but never actually added to the live schema. Phase 2
   is the first code path that ever tried to write to it. Fixed by
   `supabase/migrations/20260714131000_fix_missing_renewal_of_column.sql`.
2. **`commit_cohort_graduation()` never transitioned the OLD enrollment's
   `status` away from `ACTIVE`.** Any real Continue/Repeat decision into the
   next cohort of the *same course* — the common case — would have violated
   the live `uq_student_enrollments_active_course` unique index, since the
   old `ACTIVE` row and the new `ACTIVE` row would collide on `(student_id,
   course_id)`. Fixed by
   `supabase/migrations/20260714131500_fix_old_enrollment_status_transition.sql`,
   which now also transitions the old row's `status`
   (continue/graduate/repeat → `COMPLETED`, hold → `PAUSED`, drop →
   `DROPPED`, transfer → `TRANSFERRED`) — see the updated §6 bullet above and
   `DOMAIN_RULES.md` Rule 14.

Both fixes are applied live and committed as proper migration files.

## 11. Refactor performed

`validateCohortArchival`'s warning-computation block (unfinished sessions,
missing attendance, outstanding balance, missing certificates —
`modules/groups/actions/lifecycle.ts`) was extracted verbatim into
`computeCohortHealthWarnings()` (`modules/groups/actions/cohort-health.ts`),
now shared by both `validateCohortArchival` (Phase 1, unchanged external
behavior — all 18 existing tests pass without modification) and the new
`validateCohortGraduation` (Phase 2, consumes the richer structured
`{code, message, recommendation}` shape). This is the concrete instance of
"no duplicate logic" for this phase — the two validation flows now share one
implementation instead of two copies of the same four queries.

## 12. Remaining risks

- **New enrollments with no financial account could sit unbilled
  indefinitely** if a TL never completes the Enrollment & Contract step for
  a continuing student — `GroupFinanceTab` already renders this state
  distinctly (no payment data), but there's no proactive reminder. Flagged
  as a Phase 3 candidate ("students missing a contract" nudge), not a defect.
- **"Draft – Setup Required" cohorts could be forgotten** after the wizard
  closes — mitigated by the persistent workspace badge, but there's no
  dashboard-level nudge. Phase 3 candidate.
- **The "Complete Cohort Setup" guidance is informational, not a one-click
  auto-prefilled modal** — the Step 7 result screen lists the Step 4
  choices as a reference and navigates to the new cohort, but does not
  automatically reopen Edit Group pre-filled with those values. This was a
  deliberate scope trade-off made during implementation (a fragile
  cross-component prefill integration was judged higher-risk than the
  one-extra-click alternative) and is disclosed here rather than silently
  left as an assumed feature — a good Phase 3 follow-up if this proves to
  be real friction in practice.
- **Manual QA (§10) has been superseded by the automated acceptance QA run
  (§10a)** — 66/66 checks passed against a live Postgres instance, closing
  the disclosed limitation in §9. Two real bugs found during that run are
  fixed and documented in §10a.
- **Draft staleness**: if a cohort's roster changes between saving a draft
  and resuming it (e.g. a student dropped via the normal Groups UI), the
  resumed wizard re-fetches live data but does not show an explicit
  reconciliation diff banner — the Step 3 table will simply reflect current
  reality, which is safe (no stale decision can be silently applied to a
  student no longer active, since the coverage guard is keyed off the
  *current* active roster) but slightly less explicit than the original
  plan's proposal. Low severity — worth a small follow-up if TLs report
  confusion.

## 13. Recommendations for Phase 3

- Student-journey timeline UI — `renewal_of` now has real data to render for
  the first time.
- Instructor cross-cohort history, reusing the same lifecycle-stage
  derivation.
- A dedicated "Graduation History" list UI, backed by
  `graduated_to_group_id`/`cohort_graduation_decisions` (both already fully
  support it — no further schema work needed).
- A "students missing a contract" nudge for post-graduation enrollments.
- Optional: a one-click "Complete Cohort Setup" prefilled modal, if the
  current reference-card + manual Edit Group flow proves to be real
  friction in production use.

---

Phase 2 is complete. Manual QA against live Postgres (§10) is the one
recommended step before full sign-off — everything else in the original
12-point deliverable is done.
