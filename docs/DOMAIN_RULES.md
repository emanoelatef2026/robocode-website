# Domain Rules — Group / Cohort Academic Lifecycle

**Status:** Phase 1 — Archived-stage read-only enforcement is live (migration
`20260714120000_cohort_lifecycle_archive_enforcement.sql`)
**Owns:** `groups`, `group_series`, `student_enrollments`, `certificates`, and everything
that hangs off a group (`schedules`, `attendance_records`, `group_students`,
`group_instructors`, `group_courses`)

This document is the single source of truth for the business invariants of the
academic cohort lifecycle. It exists so that every future migration, Server Action,
and UI surface can be checked against an explicit rule instead of re-deriving intent
from code. When a rule here and the code disagree, the code is wrong — fix the code,
or open a discussion to change the rule (and update this file in the same PR).

Related: [ARCHITECTURE.md](ARCHITECTURE.md) §9 (Group & Cohort Architecture),
[MIGRATIONS.md](MIGRATIONS.md).

---

## 1. Historical data is immutable after final archive

Once a group reaches the **Archived** stage (`groups.status = 'archived'`,
`groups.archived_at` set), every row that describes what happened during that
group's run — its course assignment, its instructor assignments, its student
roster, its session schedule, its attendance records — is permanently frozen.
Nothing may `UPDATE` or `DELETE` those rows again, including via the service-role
client. This is the terminal, structural guarantee the whole feature exists to
provide: a finished semester's academic record can never silently change after
the fact, no matter how the app code evolves later.

- Locked table set: `group_courses`, `group_instructors`, `group_students`,
  `schedules`, `attendance_records` (scoped by `group_id` / `schedule.group_id`).
- `certificates` is **not** in the locked set — see Rule 6.
- Enforcement is DB-level (a trigger), not app-level, mirroring the precedent
  already set by `certificate_snapshots` (`prevent_snapshot_mutation()`,
  migration `0027`) and `prevent_attendance_on_cancelled_session()` (migration
  `0092`) — immutability that survives an app bug, not just a UI guard.
  `is_group_archived()`, `prevent_mutation_on_archived_group()` (direct
  `group_id` tables), `prevent_schedule_mutation_on_archived_group()`, and
  `prevent_attendance_mutation_on_archived_group()` implement this (Phase 1,
  migration `20260714120000_cohort_lifecycle_archive_enforcement.sql`).
- **Revised in Phase 1**: there IS an app-layer reopen path after all —
  `recoverCohortAction` (`modules/groups/actions/lifecycle.ts`), gated by the
  `recover_archived_cohort` permission (**super_admin only**, never
  `team_leader`), fully audited via `write_audit_log` (`p_action:
  'recover_cohort'`, records the reason and prior/new status). It moves the
  cohort's `status` back to `'completed'` — the `groups` row itself is never
  part of the locked table set, so this update always succeeds; the
  `sync_group_archived_at()` trigger (Rule 3) auto-clears `archived_at` as a
  side effect. This supersedes the original "DB-only, no app unlock" language
  above — a real UI action exists, but it stays a narrow, permission-gated,
  audited exception, not a general-purpose unlock.
- **Enforced as of Phase 1.** The `archived_at` column and `'archived'` status
  value existed since Phase 0; the read-only trigger and the `archiveCohortAction`
  /`recoverCohortAction` workflow were added in Phase 1. Archiving itself is
  only reachable from the `Completed` stage (Phase 1's `validateCohortArchival`
  blocks archiving a still-Running cohort) — see Rule 11's stage table below.

## 2. `deleted_at` is reserved for accidental deletion only

`deleted_at` on `groups` (and the equivalent soft-delete columns elsewhere in the
schema) means "this row was a mistake and should behave as if it never existed" —
it is what today's `archiveGroupAction` / `deleteGroupAction` actually set. It is
**not** the mechanism for "this semester finished successfully." A group that
completed a real semester of teaching must never have `deleted_at` set, because
every downstream system — finance P&L, global search, RBAC/RLS, most list
queries — filters on `deleted_at IS NULL` and would silently make a real,
historically important group invisible.

- Real lifecycle completion uses `status` (`'completed'` → `'archived'`) and the
  new `archived_at` timestamp, never `deleted_at`.
- Existing callers of `archiveGroupAction` / `deleteGroupAction` that set
  `deleted_at` are unrelated to this feature and are out of scope for Phase 0.
  Reconciling their naming/behavior against this rule is a later-phase concern,
  not a Phase 0 change.

## 3. `archived_at` means historical completion, not deletion

`groups.archived_at` (new in Phase 0, nullable, no default) is set exactly once,
the moment a group transitions into the terminal **Archived** stage. Its presence
is the authoritative signal that a group's record is now locked (Rule 1). Its
absence means the group is still `Running` or `Completed` and may still be
edited. It is independent of `deleted_at` (Rule 2) and independent of `status`
in the sense that `status = 'archived'` and `archived_at IS NOT NULL` must always
agree — Phase 1 enforcement should treat any disagreement between the two as a
data-integrity bug, not a valid state.

## 4. The same visible group name may exist many times

"Robotics — Saturday 10am — Branch 3" is a *slot*, not a unique entity. Every
semester that slot runs, it is legitimate to create a brand new `groups` row with
the identical `name`, `branch_id`, `day_of_week`, and `time` as a prior, now
-archived group. There is no uniqueness constraint on `groups.name` and none
should ever be added — the operational reality is recurring class slots, and the
old row must keep existing, untouched, alongside the new one. What ties
same-slot groups together across semesters is `group_series` (Rule 9), never name
matching.

## 5. Student history is never deleted

A student's enrollment, attendance, payment, and progress records tied to a
finished group are permanent. "Moving" a student to a new semester's group never
rewrites or deletes their history in the old group — it always creates a new,
separate `student_enrollments` row (and a new financial account) in the new
group, linked back to the old one via `renewal_of` (Rule 10). This is why
`transferEnrollment()`'s in-place `student_financial_accounts.group_id` rewrite
path must never be used for this feature: it would erase which group a student's
past payments actually belonged to.

## 6. Certificates are permanent, and structurally independent of group lifecycle

`certificates` has no `group_id` foreign key today, and Phase 0 does not add
one. This decoupling is intentional and load-bearing: certificate issuance,
viewing, and verification must keep working exactly as they do today, forever,
regardless of what stage the underlying group is in — including after that
group is permanently archived and locked (Rule 1). A certificate is issued
against a student, a semester, and a course; it must never depend on a `groups`
row remaining writable.

- The one real gap this rule surfaces: `certificates` currently displays
  `course_title` (live-joined from `courses.title`) and `semester_name`
  (live-joined from `semesters.name`) at read time. Renaming a course or
  semester later silently rewrites the text on a certificate that was already
  issued months or years ago — a violation of "permanent" in spirit even though
  no `UPDATE` ever touches the `certificates` row itself.
- Phase 0 adds nullable snapshot columns (`course_title_snapshot`,
  `semester_name_snapshot`) to close this gap. **No backfill, no trigger, and no
  change to certificate generation logic yet** — that is Phase 0's boundary.
  Populating them on issuance, and preferring the snapshot over the live join at
  read time, is later-phase work.

## 7. Finance history is immutable

Once a payment, installment, or revenue-share calculation is recorded against a
group, it stays attributed to that group forever, even after the group is
archived. `getGroupPnLRows` / `getBranchPnLRows` / `getAcademyPnL` already filter
only on `deleted_at IS NULL`, with no `status` filter — which is exactly correct
for this rule, and must stay that way. Archiving a group must never move,
recompute, or hide its historical financial rows.

## 8. Attendance history is immutable

Once a session's attendance is recorded, it reflects what actually happened on
that date. It may still be corrected while a group is `Running` or `Completed`
(Rule 12), but the moment a group is `Archived`, `attendance_records` for that
group's sessions become permanently frozen (Rule 1) — no further corrections,
no matter how the request is justified. This is the same immutability bar
already applied to cancelled-session consumption (migration `0092`,
`prevent_attendance_on_cancelled_session()`), extended to the group's terminal
state instead of a single session's cancelled state.

## 9. `group_series` — purpose

`group_series` is the *operational slot identity*: which branch, which
recurring day/time, which default room/capacity/course, independent of any
particular semester's run. It exists so that "the same Saturday-10am Robotics
class at Branch 3" has one stable identity across many semesters, even as the
`groups` row representing each semester's actual run gets created, filled,
completed, and archived. `groups.series_id` is a nullable FK to it.

- `group_series` is purely a slot dimension table — small, mostly static, never
  itself archived or deleted as part of a group's lifecycle.
- It is deliberately **not** how student academic history is tracked (that's
  `renewal_of`, Rule 10) — a student's next course is frequently a different
  series entirely (e.g. Python 1 Saturdays → Python 2 Sundays).
- Phase 0 creates the table and the nullable `groups.series_id` column only.
  No group is linked to a series yet, and no workflow creates or assigns series
  membership — that begins in a later phase ("Create Next Cohort").

## 10. `renewal_of` — usage

`student_enrollments.renewal_of` is a self-referencing, nullable FK that chains
a student's enrollments across their academic journey: Scratch → Python 1 →
Python 2 → Arduino, each a separate enrollment in a separate (possibly
differently-seriesed) group. It already exists in the schema and has been
dormant (unused) until this feature activates it.

- Every hop in the chain is a **new** `student_enrollments` row with its own
  new financial account — never an in-place rewrite of the previous enrollment
  or its account (Rule 5).
- `renewal_of` points at the *previous* enrollment, not at a group or a series —
  the chain follows the student, not the slot.
- Phase 0 does not populate or read this column for the new feature. It remains
  exactly as dormant as it is today; only the surrounding schema (`group_series`,
  `archived_at`) is added around it.

## 11. Group lifecycle — three stages, no new enum values

A group moves through exactly three stages, encoded entirely in the existing
`groups.status` CHECK constraint (`'forming'`, `'active'`, `'handoff_pending'`,
`'completed'`, `'cancelled'`, `'archived'` — migration `0086`; no new values are
introduced by this feature):

| Stage | `status` values | Editable? |
|---|---|---|
| **Running** | `forming`, `active`, `handoff_pending` | Fully — unchanged from today. |
| **Completed** — the primary terminal state | `completed` | Yes. Makeups, certificates, late attendance corrections, and instructor adjustments must keep working. Already auto-set today by `session-ownership.ts` when an instructor's allocation covers all planned sessions — no new enforcement is added for this stage. |
| **Archived** — the only locked stage | `archived` | No — see Rule 1. Reached only by explicit, later-phase action; never automatic. |

`'cancelled'` is a separate, unrelated concept (a mistaken or aborted group,
Rule 2) and is not part of this three-stage progression.

**Revised in Phase 1**: the UI no longer conflates `'cancelled'` and
`'archived'` under one "Archived" filter — they are business-invariantly
distinct (Rule 2), so the Groups workspace now exposes them as separate quick
filters. The UI additionally splits `Running` into two presentation-only
sub-labels, computed by `getCohortLifecycleStage()`
(`modules/groups/lifecycle-stage.ts`) and never stored as a new `status`
value:

| UI stage (business/domain term "Cohort") | `status` | Notes |
|---|---|---|
| Draft | `forming` | not yet enrollment-ready (no course/instructor assigned) |
| Open | `forming` | enrollment-ready (course + instructor assigned) |
| Running | `active`, `handoff_pending` | unchanged from this rule's original 3-stage table |
| Completed | `completed` | unchanged |
| Archived | `archived` | unchanged — the only locked stage (Rule 1) |

`'cancelled'` remains outside this progression entirely (Rule 2) and is shown
as its own distinct badge/filter, never folded into any of the 5 stages above.

## 12. What stays editable at each stage (summary)

This restates Rules 1, 6, 8, and 11 as one lookup, since it is the rule most
likely to be checked while building a UI or Server Action:

| Action | Running | Completed | Archived |
|---|---|---|---|
| Run makeup sessions | ✅ | ✅ | ❌ |
| Correct attendance | ✅ | ✅ | ❌ |
| Adjust instructor allocation | ✅ | ✅ | ❌ |
| Add/remove students | ✅ | ✅ | ❌ |
| Issue / view certificates | ✅ | ✅ | ✅ (decoupled, Rule 6) |
| Appear in search / finance / reports | ✅ | ✅ | ✅ (no `deleted_at`, Rules 2 & 7) |

## 13. Duplicate active membership is a data-integrity precondition, not a Phase 0 concern

Before any lock or archival workflow is built, the codebase must not allow a
student to silently accumulate more than one *open* `group_students` row from
the same course lineage (e.g. left uncommitted when moved between groups). This
was tracked and fixed as **Priority 0** (closed, commit `1cd8c81`) — via
`course_id`-scoped partial unique indexes rather than `series_id` (no group has
ever been linked to a series yet; see `docs/GROUP_SERIES_RULES.md`) — sequenced
after Phase 0's additive schema and before Phase 1's locking behavior below.

---

## Revision history

- **2026-07-13** — Initial version, written as part of Phase 0 (foundation only:
  `group_series` table, `groups.series_id`, `groups.archived_at`, certificate
  snapshot columns). No enforcement exists yet; every "locked"/"immutable"
  statement above describes the target state, not current behavior, unless a
  line explicitly says otherwise.
- **2026-07-14** — Phase 1: the Archived-stage read-only trigger described in
  Rule 1 is now live (migration
  `20260714120000_cohort_lifecycle_archive_enforcement.sql`), covering
  `group_courses`, `group_instructors`, `group_students`, `schedules`, and
  `attendance_records`. Added an audited, super_admin-only app-layer recovery
  path (`recoverCohortAction`), revising Rule 1's original "DB-only, no app
  unlock" language. Added the UI-facing 5-stage lifecycle mapping to Rule 11.
  New permissions: `archive_cohort`, `view_archived_cohorts` (team_leader +
  super_admin), `recover_archived_cohort` (super_admin only). Priority 0
  (Rule 13) is now closed.
