# Phase 1 Completion Report — Cohort Lifecycle Foundation

**Date:** 2026-07-14
**Scope:** Archived-stage read-only enforcement, lifecycle presentation model, RBAC,
audit, Groups UI, tests. Reuses everything from Phase 0/0.5/Priority 0 — no schema
redesign, no new `groups.status` enum values.
**Status:** ✅ Complete. Quality gate green. Awaiting explicit go-ahead before Phase 2.

---

## 1. Architecture summary

The physical table stays `groups`; "Cohort" is business/UI terminology only —
matches the architecture record's decision to never rename the table. Phase 1
implements exactly what `docs/DOMAIN_RULES.md` Rule 1 had documented but left
unenforced since Phase 0:

- A **presentation-layer 5-stage lifecycle** (Draft → Open → Running →
  Completed → Archived), computed by a pure function
  (`getCohortLifecycleStage()`, `modules/groups/lifecycle-stage.ts`) from the
  existing `groups.status` value plus the existing course/instructor readiness
  signal — no new DB values, no new enforcement for Draft/Open/Running/Completed
  (those stages were already correctly editable; only their *labels* are new).
- A **DB-trigger-enforced read-only lock** on the 5 tables that describe an
  archived cohort's history (`group_courses`, `group_instructors`,
  `group_students`, `schedules`, `attendance_records`), mirroring the existing
  `prevent_attendance_on_cancelled_session()` (migration `0092`) pattern.
- An **audited archive/recover workflow** (`modules/groups/actions/lifecycle.ts`):
  archiving is only reachable from `Completed` (blocks Running/Draft/Open with a
  clear validation error, per an explicit decision this phase), with non-blocking
  warnings for unfinished sessions, missing attendance, unpaid balances, and
  missing certificates. Recovery is a narrow, `super_admin`-only, fully audited
  exception to "Archived is terminal" — a deliberate, explicit revision to
  Rule 1's original stricter language (see §6).
- **Three new RBAC permissions** (`archive_cohort`, `view_archived_cohorts` —
  team_leader + super_admin; `recover_archived_cohort` — super_admin only),
  reusing the existing DB-backed `permissions`/`role_permissions` model and the
  `requirePermission()` guard — no new authorization mechanism.
- **Groups UI**: lifecycle badges (via the existing `StatusBadge` component,
  not a new one), fixed a pre-existing filter bug that conflated the unrelated
  `cancelled` and `archived` concepts, new Draft/Open/Running/Completed quick
  filters, Archive/Recover actions with a confirmation dialog, and a read-only
  banner on archived cohorts.

## 2. Database changes

One new migration (plus one immediate follow-up hardening fix), both applied to
the live Supabase project (`fkqwafedruparlqjiprq`) via the migration tool:

- `is_group_archived(p_group_id UUID) RETURNS BOOLEAN` — single reusable helper,
  avoids duplicating the archived-check subquery across 5 trigger functions.
- `prevent_mutation_on_archived_group()` — `BEFORE INSERT OR UPDATE OR DELETE`
  trigger on `group_courses`, `group_instructors`, `group_students` (direct
  `group_id` column).
- `prevent_schedule_mutation_on_archived_group()` — same, on `schedules`,
  resolving the owning group via `group_course_id → group_courses.group_id`.
- `prevent_attendance_mutation_on_archived_group()` — same, on
  `attendance_records`, resolving via
  `schedule_id → schedules.group_course_id → group_courses.group_id` (two hops).
  Coexists with the pre-existing `prevent_attendance_on_cancelled_session()`
  (independent condition, no overlap).
- `sync_group_archived_at()` — `BEFORE UPDATE` on `groups` itself: auto-sets
  `archived_at` when `status` transitions to `'archived'`, auto-clears it on the
  reverse transition. Mechanically guarantees Rule 3's invariant
  (`status='archived' ⟺ archived_at IS NOT NULL`) instead of relying on app code
  to keep both fields in sync.
- Three new rows in `permissions` + `role_permissions` (see §7).
- `certificates` is deliberately **not** in the locked table set (Rule 6
  decoupling stays intact — certificates remain issuable/viewable forever).
- No RLS policy changes — all group mutations already go through
  `createServiceClient()` (RLS-bypassing) gated by `requirePermission()` in the
  Server Action, the same enforcement model `manage_groups` already used.

## 3. Migrations

| File | Purpose |
|---|---|
| `supabase/migrations/20260714120000_cohort_lifecycle_archive_enforcement.sql` | Triggers + permissions (§2) |
| `supabase/migrations/20260714120500_cohort_lifecycle_search_path_hardening.sql` | Follow-up: pins `search_path = ''` on the 5 new functions, per a security-advisor `WARN` raised immediately after the first migration |

Both applied via `apply_migration` (never manual SQL Editor), per
`docs/MIGRATIONS.md`. `get_advisors` (security + performance) run after both —
zero findings tied to any new object; see §9.

## 4. Files modified

### New

| File | Purpose |
|---|---|
| `modules/groups/lifecycle-stage.ts` | Pure `getCohortLifecycleStage()` derivation — deliberately **not** `server-only` (rendered from client components) |
| `modules/groups/actions/lifecycle.ts` | `validateCohortArchival`, `archiveCohortAction`, `recoverCohortAction`, `listArchivedCohorts` |
| `tests/phase1/cohort-lifecycle.test.ts` | 18 tests (see §8) |
| `supabase/migrations/20260714120000_...sql`, `20260714120500_...sql` | See §3 |
| `docs/PHASE1_COMPLETION_REPORT.md` | This file |

### Modified

| File | Change |
|---|---|
| `modules/rbac/types.ts`, `modules/rbac/permissions.ts` | 3 new `PermissionName` literals; `team_leader` gets `archive_cohort`/`view_archived_cohorts` by default |
| `modules/groups/actions/group-crud.ts` | Guarded `archiveGroupAction`/`deleteGroupAction`/`updateGroupModal` against mutating an Archived cohort (see §11 — a regression this phase's own trigger design would otherwise have introduced) |
| `modules/groups/actions.ts` | Same guard on the legacy `updateGroup`/`deleteGroup` (used by `/admin/groups/[id]`) |
| `components/admin/StatusBadge.tsx` | Added `open`, `running`, `archived` entries (reused the existing `draft` entry) |
| `app/portal/team-leader/groups/workspace/components/StatusChip.tsx` | Rewired to render the canonical `StatusBadge` + `getCohortLifecycleStage()` instead of its own ad-hoc color logic |
| `app/portal/team-leader/groups/workspace/components/GroupListItem.tsx`, `GroupSummaryBar.tsx`, `dialogs/MoveGroupModal.tsx` | Updated `StatusChip` call sites to the new `group`-object prop |
| `app/portal/team-leader/groups/workspace/types.ts`, `utils.ts`, `components/GroupSidebar.tsx` | Fixed the `cancelled`/`archived` filter conflation; added `draft`/`open`/`running`/`completed` quick filters |
| `app/portal/team-leader/groups/workspace/GroupWorkspace.tsx`, `components/GroupActionsDropdown.tsx` | Archive/Recover buttons, confirmation dialogs, read-only banner |
| `app/portal/team-leader/groups/GroupsWorkspaceClient.tsx` | Passes `isSuperAdmin` down to `GroupWorkspace` |
| `docs/DOMAIN_RULES.md` | Rule 1 marked enforced + revised recovery language; Rule 11 gets the 5-stage UI mapping; Rule 13 marked closed |

### Deleted (cleanup)

| File | Reason |
|---|---|
| `app/portal/team-leader/groups/GroupDetailDrawer.tsx` (~1,222 lines) | Confirmed zero importers anywhere in the codebase (grepped the full repo) — dead code duplicating the status-badge logic 3× that this phase's refactoring goal explicitly asked to remove |

## 5. Lifecycle implementation details

`getCohortLifecycleStage({ status, has_course, has_instructor })`:

| UI stage | `status` | Derivation |
|---|---|---|
| Draft | `forming` | not yet enrollment-ready |
| Open | `forming` | course + instructor both assigned |
| Running | `active`, `handoff_pending` | unchanged |
| Completed | `completed` | unchanged |
| Archived | `archived` | unchanged, now enforced read-only |

`cancelled` deliberately falls outside this progression (Rule 2) — the UI
checks for it explicitly and renders it as its own badge/filter rather than
running it through the derivation.

Archive precondition (explicit decision, confirmed with the user): archiving is
**blocked** unless `status = 'completed'` — `validateCohortArchival` returns a
blocker, not a warning, for a still-Running cohort. Warnings (non-blocking):
unfinished sessions, completed sessions missing attendance, students with an
outstanding balance, students missing a certificate for the cohort's course.

## 6. Audit implementation

Reuses the existing `write_audit_log` RPC (`audit_logs` table, Phase 13's
infrastructure) — no new logging system:

- `archiveCohortAction` → `p_action: 'archive_cohort'`, `p_old_values: {status}`,
  `p_new_values: {status: 'archived', reason}`.
- `recoverCohortAction` → `p_action: 'recover_cohort'`, `p_old_values: {status:
  'archived'}`, `p_new_values: {status: 'completed', reason}`.

Both record who (`p_performed_by`), when (`created_at` default), and the
free-text reason the caller supplied, satisfying the "who/when/reason/previous
state/new state" requirement.

## 7. Permission changes

| Permission | Holders | Purpose |
|---|---|---|
| `archive_cohort` | team_leader, super_admin | Archive a Completed cohort |
| `view_archived_cohorts` | team_leader, super_admin | Gate the archived-cohorts list query |
| `recover_archived_cohort` | super_admin only | Reverse an Archived cohort back to Completed |

Not added to `CONFIGURABLE_PERMISSIONS` — these are lifecycle-governance
actions, not day-to-day delegable permissions, so they always flow from role
and carry none of the per-user-override backfill obligations.

## 8. Test results

`tests/phase1/cohort-lifecycle.test.ts` — **18/18 passing**, covering:
`getCohortLifecycleStage` (all 5 derivations + `cancelled` fallback),
`validateCohortArchival` (not-found/already-archived/not-completed blockers;
all 4 warning conditions; the fully-clean case), `archiveCohortAction`
(rejects Running, succeeds + audits on Completed), `recoverCohortAction`
(rejects non-super_admin, rejects non-Archived, succeeds + audits),
`listArchivedCohorts` (branch scoping for team_leader vs. super_admin), and
`applyFilters` (archived vs. cancelled now correctly distinguished).

Full suite: **50 files / 379 tests, all passing** (49 pre-existing files + this
one; zero regressions).

**Disclosed limitation**: the DB triggers themselves aren't exercised by these
vitest tests (mocked-DB tests can't invoke real Postgres trigger logic). They
were verified separately, directly against the live Supabase project, inside a
`BEGIN…ROLLBACK` transaction that left zero permanent rows — see §10.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `npx eslint .` | ✅ 0 errors, 2,219 warnings (all pre-existing style warnings in test files, `no-explicit-any`/`no-unused-vars`; none in Phase 1 files) |
| `npm run build` | ✅ Compiled successfully, 0 errors/warnings |
| `npx vitest run` | ✅ 50/50 files, 379/379 tests |

## 9. Performance review

`get_advisors` (security + performance) run after both migrations:

- **Security**: one `WARN` (`function_search_path_mutable`) surfaced
  immediately after the first migration, on all 5 new functions — fixed in the
  same session via the follow-up hardening migration (§3), matching this
  repo's own established convention (`20260705202917_security_hardening.sql`).
  Re-run confirms zero findings tied to any Phase 1 object afterward. All
  remaining findings are pre-existing and unrelated (RLS-enabled-no-policy on
  unrelated CMS tables, two unrelated backup tables without RLS, `pg_trgm`
  extension location, auth MFA/password settings).
- **Performance**: zero findings mention `is_group_archived`,
  `prevent_mutation_on_archived_group`, `prevent_schedule_mutation_on_archived_group`,
  `prevent_attendance_mutation_on_archived_group`, `sync_group_archived_at`,
  or the three new permissions (grepped the full advisor output).
- The triggers add one indexed-PK lookup (`groups` by `id`) per write to the 5
  locked tables — negligible overhead, and only ever exercised for cohorts that
  are actually archived (a tiny, terminal-state minority of rows).

## 10. Manual QA checklist

Performed directly against the live Supabase project inside a single
`BEGIN … ROLLBACK` transaction (temp table `ON COMMIT DROP`, zero rows
persisted afterward — confirmed via a follow-up `count(*)` query):

- [x] Archiving a cohort auto-sets `archived_at` (`sync_group_archived_at`).
- [x] `UPDATE group_courses` on an archived cohort → blocked (`P0001`).
- [x] `INSERT group_students` (new student) on an archived cohort → blocked.
- [x] `UPDATE schedules` on an archived cohort → blocked.
- [x] `INSERT attendance_records` on an archived cohort → blocked.
- [x] Recovering (status → `completed`) auto-clears `archived_at`.
- [x] After recovery, `INSERT group_students` succeeds again (lock lifted).

Remaining manual QA (not yet clicked through in a browser — recommend before
sign-off): Archive/Recover buttons visible only to the correct roles; the
archive confirmation dialog surfaces warnings correctly; the read-only banner
and disabled edit affordances render correctly on an archived cohort in the
actual UI; the Draft/Open/Running/Completed/Cancelled/Archived quick filters
return the expected counts against real data.

## 11. Remaining risks

- **A latent regression was found and fixed, not just avoided**: the
  pre-existing `archiveGroupAction`/`deleteGroupAction`
  (`group-crud.ts`) and the legacy `updateGroup`/`deleteGroup`
  (`modules/groups/actions.ts`) write directly to `groups.status`/`deleted_at`,
  which the new child-table triggers don't cover (only `groups`' own children
  are locked, not the `groups` row itself). Without a guard, calling any of
  these on an already-Archived cohort would have silently cleared
  `archived_at` via `sync_group_archived_at` while marking it `cancelled` —
  corrupting the terminal Archived state through an unaudited path. Fixed by
  adding an explicit `status === 'archived'` refusal to all four functions.
  Worth a follow-up audit of any *other* code path that writes `groups.status`
  directly, in case one was missed.
- **`validateCohortArchival`'s "missing certificate" check is a heuristic**,
  not authoritative — it matches on `(student_id, course_id)`, coarser than
  true series-based lineage (same caveat already carried forward from Priority
  0). Acceptable since it's a non-blocking warning, not a gate.
- **No app-layer "Archived cohorts" list page/tab was built** —
  `listArchivedCohorts` exists as a server action but isn't yet wired into a
  dedicated UI tab; today, archived cohorts surface only via the existing
  workspace's `Archived` quick filter (fully functional) and global search
  (unaffected, still `deleted_at`-only). Building a dedicated tab is a small
  follow-up, not a blocker.
- **`GroupDetailView.tsx`'s legacy 3-value status `<select>`** (`/admin/groups/[id]`)
  was left untouched per scope ("do not redesign the application") — it still
  can't submit `'archived'` (good) but also doesn't show the new lifecycle
  badges. Pre-existing tech debt, not a regression.

## 12. Recommendations for Phase 2

Per the architecture record, Phase 2 ("Create Next Cohort") is next: student
promotion, `renewal_of` activation, and next-cohort creation integrated with
the Payment/Enrollment Wizard — explicitly **not** touched in this phase.
Suggested entry points for that work to build on:
- `getCohortLifecycleStage()` and the `archive_cohort`/`recover_archived_cohort`
  permission pair are stable primitives Phase 2 can reuse without modification.
- Consider building the dedicated "Archived Cohorts" list UI (§11) as part of
  Phase 2's or Phase 3's UI work, backed by the already-implemented
  `listArchivedCohorts`.
- Phase 3 (student journey UI + instructor cross-cohort history) can reuse the
  same lifecycle-stage derivation for any cohort-history timeline view.

---

Phase 1 is complete. Stopping here per instruction — awaiting explicit
approval before Phase 2.
