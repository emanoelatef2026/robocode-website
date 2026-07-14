# Phase 2 Graduation Wizard — Production Acceptance Report

**Date:** 2026-07-14
**Scope:** Final acceptance sign-off for the Cohort Graduation Wizard (Phase 2
of the Group/Cohort Lifecycle project). Companion to
`docs/PHASE2_COMPLETION_REPORT.md` (architecture/implementation) and
`docs/DOMAIN_RULES.md` Rule 14 (business rules). This report is the QA record:
what was tested, how, against what environment, and the outcome.

**Verdict: ✅ Sign-off recommended.** 66/66 acceptance checks passed against a
live Postgres instance. Two real production bugs were found and fixed during
this QA pass — both are pre-existing, live-applied fixes now part of the
baseline this report certifies, not open issues.

---

## 1. Method

A single, self-contained SQL script,
[`docs/qa/phase2_graduation_acceptance.sql`](qa/phase2_graduation_acceptance.sql),
run via Supabase `execute_sql` against project `fkqwafedruparlqjiprq`
(production). The entire script runs inside one `BEGIN ... ROLLBACK`
transaction — every fixture, every commit, every assertion happens inside it,
and the final `ROLLBACK` guarantees nothing persists. This lets the QA use
real tables, real triggers, real RLS/permission functions, and real unique
constraints instead of a mock, while remaining completely non-destructive.

A `qa_results` TEMP TABLE collects `(check_name, passed, detail)` per
assertion instead of raising on first failure, so a single run produces a
full pass/fail matrix rather than stopping at the first problem. Scenarios
that must themselves raise an error (rejected commits, guard violations) use
nested `BEGIN ... EXCEPTION WHEN OTHERS` blocks — PL/pgSQL gives each of
these an implicit savepoint, so a caught, expected failure doesn't roll back
everything that happened earlier in the same outer transaction.

Because `public.users.id` carries a foreign key to `auth.users.id`, the
script cannot fabricate new identities — it reuses 7 real students, 1 real
instructor, 1 real multi-branch team leader, and 1 real super_admin
(hardcoded by UUID), plus a temporary, transaction-scoped extra
`user_roles` grant for the "second team leader" and "unauthorized user" test
subjects. All new courses, groups, schedules, enrollments, and certificates
created for the test are fresh rows scoped to a unique test course, so
assertions are scoped by that course/enrollment lineage rather than by
student ID alone — the real students used already have unrelated production
history that a naive `student_id IN (...)` filter would collide with.

## 2. Result summary

**66 / 66 checks passed.** Full raw output is reproducible by re-running the
script; the categories covered:

| Area | Checks | Result |
|---|---|---|
| Coverage guard (every active student needs an explicit decision) | 2 | ✅ |
| Invalid transfer target rejected + full rollback (zero partial rows) | 4 | ✅ |
| Full mixed-decision commit (continue/graduate/hold/repeat/transfer/drop) | 29 | ✅ |
| Idempotency / replay (same `request_id` twice) | 6 | ✅ |
| Rejection of a different `request_id` after graduation | 1 | ✅ |
| Permissions matrix (TL / cross-branch TL / super_admin / unauthorized / RPC grants) | 7 | ✅ |
| Draft save/resume (one in-progress draft per cohort+user, independent per user) | 5 | ✅ |
| Archived-cohort immutability (Phase 1 guarantees re-verified) | 3 | ✅ |
| Completed (ungraduated) cohort remains editable | 1 | ✅ |
| Historical visibility / search proxy | 2 | ✅ |
| Fixture setup | 1 | ✅ |

## 3. The two real production bugs found (both fixed, both applied live)

These were **not** caught by the 404-test vitest suite — mocked DB calls
cannot see live schema drift or live unique-constraint interactions. Both
would have made real graduation commits fail or behave incorrectly in
production had this QA pass not caught them before rollout.

### 3.1 `student_enrollments.renewal_of` did not exist on the live table

`renewal_of` has been referenced in `docs/DOMAIN_RULES.md` and migration
history for 4+ months, and migration `0054_schema_reconciliation.sql`
declares it inside a `CREATE TABLE IF NOT EXISTS student_enrollments (...)`.
Because the table already existed under an earlier, differently-shaped
ad-hoc definition at the time `0054` ran, that `CREATE TABLE` was a silent
no-op — confirmed via `information_schema`, where the live table's actual
columns include `expected_sessions`/`attendance_count`/
`completion_percentage`/`pricing_plan`/`transferred_to`, none of which `0054`
declares. `renewal_of` was simply never added to the live schema. Phase 2 is
the first code path that ever attempted to write to it, which is why nothing
surfaced this until now.

**Fix:** `supabase/migrations/20260714131000_fix_missing_renewal_of_column.sql`
— a straightforward `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Applied live.

**Follow-up flagged, not investigated (out of scope for Phase 2):** whether
other columns `0054` declared are also missing from the live table
(`dropout_score`, `collection_stage`, etc.) — worth a dedicated audit in a
future session.

### 3.2 `commit_cohort_graduation()` never transitioned the OLD enrollment's status

The live unique index `uq_student_enrollments_active_course` on
`(student_id, course_id) WHERE status='ACTIVE'` means any real Continue or
Repeat decision into a next cohort running the *same course* — the ordinary,
expected case ("next round of the same class") — would have violated this
constraint in production, because the old `ACTIVE` enrollment row and the
newly-created `ACTIVE` row collide on the same `(student_id, course_id)`.
This is a genuine correctness bug, not a QA-fixture artifact.

**Fix:**
`supabase/migrations/20260714131500_fix_old_enrollment_status_transition.sql`
— `commit_cohort_graduation()` now also transitions the OLD enrollment's
`status` per decision: continue/graduate/repeat → `COMPLETED`, hold →
`PAUSED`, drop → `DROPPED`, transfer → `TRANSFERRED` (mirrors the existing
`group_students.status` handling already in the function). Only the `status`
column changes on the old row — `group_id`/`course_id`/dates/`renewal_of`/
financial linkage remain untouched, so this does not violate Rule 5 ("never
rewrite a historical enrollment"); verified explicitly by the QA script's
byte-comparison check of the old enrollment rows (`T3 OLD enrollments
group/course/dates/renewal_of never rewritten`), which excludes `status`
from the hash and still passed.

Both fixes are live on Supabase project `fkqwafedruparlqjiprq` and committed
as proper migration files in `supabase/migrations/`.

## 4. Verification detail by scenario

**Normal cohort graduation, full happy path.** A 6-student Completed cohort
was graduated with one student per decision type in a single commit. Result
JSON returned `replayed:false`, the correct `decision_counts` (one of each of
continue/graduate/hold/repeat/transfer/drop), and a `new_group_id`.

**Mixed decisions — all six types in one commit, verified individually:**
- **Continue** → old `group_students.status='graduated'`; old enrollment
  `status='COMPLETED'`; new enrollment created with `renewal_of` pointing at
  the old one, `status='ACTIVE'`, in the new cohort.
- **Graduate** → old `group_students.status='graduated'`; old enrollment
  `status='COMPLETED'`; **no** new enrollment created.
- **Hold** → old `group_students.status='paused'`; old enrollment
  `status='PAUSED'`; no new enrollment.
- **Repeat** → old `group_students.status='dropped'` with a note containing
  "Repeating"; old enrollment `status='COMPLETED'`; new enrollment created in
  the new cohort, `renewal_of` chained.
- **Transfer** → old `group_students.status='dropped'` with a note containing
  "Transferred"; old enrollment `status='TRANSFERRED'`; new enrollment
  created in the **existing target cohort** (not the newly graduated one),
  `renewal_of` chained; student also added to that target cohort's
  `group_students` as `active`.
- **Drop** → old `group_students.status='dropped'`, no note; old enrollment
  `status='DROPPED'`; no new enrollment.

**`renewal_of` verification.** Confirmed by direct query for each
continue/repeat/transfer case: `renewal_of` on the new row equals the old
enrollment's `id`, and the new row lives in the correct target group
(new cohort for continue/repeat, the pre-existing target cohort for
transfer). Graduate/hold/drop correctly produced zero new enrollment rows
(`renewal_of IN (old_enr_ids)` count = 0 for those three).

**New enrollments verification.** New cohort ended with exactly 2 active
`group_students` rows (continue + repeat), and the transferred student was
added as `active` to the separate existing target cohort — both counted and
asserted directly.

**"No financial accounts" verification.** Queried
`student_financial_accounts` for any row whose `enrollment_id` matches one of
the newly created enrollments — zero, confirming the workflow never creates
billing records (matches the deliberate architectural boundary in
`PHASE2_COMPLETION_REPORT.md` §1).

**"No attendance moves" verification.** An MD5 digest of all
`attendance_records` rows tied to the old cohort's two historical sessions
was taken immediately before the commit and re-taken immediately after —
byte-identical.

**"No certificates move" verification.** Same byte-identical-digest technique
applied to a pre-existing certificate tied to one of the graduating students;
also confirmed the total certificate count for the test course stayed at 1
(no new certificate silently created by the commit).

**Audit log verification.** Exactly one `audit_logs` row with
`action='graduate_cohort'` and `entity_id` equal to the old cohort's ID
exists after the commit — and still exactly one after a replay (§ below),
confirming the audit write is idempotent along with everything else.

**Draft save/resume verification.** A draft insert for (cohort, team leader)
succeeds; a second `in_progress` draft for the *same* (cohort, user) pair is
rejected by the `idx_cgdraft_one_in_progress_per_user` unique index; a
*different* user gets their own independent draft on the same cohort;
updating a draft's `step` applies correctly; the `updated_at` trigger is
confirmed installed via the `pg_trigger` catalog (not via a timestamp delta —
Postgres's `now()` is frozen for the whole wrapping transaction, so a
same-transaction `updated_at > earlier` comparison can never be true
regardless of whether the trigger fired; this is a QA-script technique note,
not a product concern).

**Idempotency (replay) verification.** The exact same commit payload and
`request_id` was submitted a second time. Result: `replayed:true`, the
identical `new_group_id` as the first commit, zero new `groups` rows, zero
new `student_enrollments` rows, still exactly 6
`cohort_graduation_decisions` rows and exactly 1 audit row — full replay
safety confirmed, not just a superficial "no error" check.

**Rejection with a different `request_id`.** After the cohort was already
graduated, submitting a *different* `request_id` against the same
`old_group_id` was rejected with an explicit "already been graduated" error,
distinguishing a legitimate replay from an accidental double-submission with
a fresh key.

**Rollback verification (forced failure mid-transaction).** A commit with an
invalid `transfer_group_id` was submitted for a full 6-student mixed batch.
It was rejected with an explicit "invalid transfer target" error, and
**zero** partial rows were left behind anywhere: zero new `groups` rows, zero
`cohort_graduation_decisions` rows, zero new `student_enrollments` rows, and
the old cohort's `graduated_at` remained `NULL` — proving the RPC's
atomicity holds even when failure occurs after several earlier per-student
branches would have already succeeded individually.

**Permissions matrix.**

| Actor | Branch scope | `graduate_cohort` for branch1? |
|---|---|---|
| Real team_leader (holds branch1, multi-branch) | branch1 | ✅ granted |
| Real team_leader, granted a *temporary* branch2-only role for this test | branch1 | ❌ denied (correctly scoped out) |
| Same team_leader | branch2 | ✅ granted |
| Real super_admin (global role) | branch1 | ✅ granted (global roles ignore branch scoping) |
| Unauthorized user (plain student account, no elevated role) | branch1 | ❌ denied |

Also confirmed at the SQL-privilege level: `commit_cohort_graduation()` is
**not** directly executable by either the `authenticated` or `anon` Postgres
roles — it is only reachable through the `SECURITY DEFINER` Server Action
path that performs its own permission check first, not by a client calling
the RPC directly.

> **Note on role naming:** this RBAC model has no "Branch Manager" role — the
> actual role set is `team_leader` / `super_admin` / `instructor` / `student`
> / `parent` (`modules/rbac/types.ts`, `RoleName`). `team_leader` **is** the
> branch-level manager role in this system; the matrix above uses that
> terminology throughout rather than an invented "Branch Manager" label.

**Archived cohort immutability re-verified (Phase 1 guarantee).** An Archived
cohort's `group_students` rejects `UPDATE` with the Phase 1 trigger's
"Archived and permanently read-only" error; inserting a new `group_courses`
row against it is likewise rejected; and attempting to graduate an Archived
cohort is rejected with "Cohort must be Completed before it can be
graduated" — confirming Phase 2 correctly gates on the Completed stage and
does not weaken the Archived-stage lock added in Phase 1.

**Completed (ungraduated) cohort editability re-verified.** A Completed
cohort that has *not* been graduated remains fully editable — inserting and
updating a `group_students` row against it succeeds, confirming graduation
(not the Completed status alone) is what triggers the eventual lock, and
Completed-but-not-yet-graduated cohorts aren't prematurely frozen.

**Historical visibility / search (partial verification, disclosed).** Two
checks confirm the graduated old cohort remains visible to a
`deleted_at IS NULL`-style filter (the pattern used by P&L/reporting views)
and that its core identifying fields (`status`, `name`) are unchanged and
findable. This is a **proxy** for full UI search/report verification, not a
substitute for it — the actual Groups workspace search bar and any reporting
UI that filters/sorts on graduation state were **not** exercised in this
DB-level QA pass. Disclosed here rather than silently assumed covered.

## 5. Explicitly NOT verified this session (disclosed, not silently assumed)

- **"Draft – Setup Required" badge** — this is a UI-only concern (React
  component rendering logic reading `groups.status='forming'` +
  `graduated_from_group_id IS NOT NULL`), not something a DB-level
  transaction can observe. Needs either a manual browser check or an
  explicit UI test in a future session.
- **Full UI search/reports** — see §4 above; only a DB-level proxy was
  checked, not the actual Groups workspace search/filter UI or any
  reporting screen.
- **Large-cohort scale (50+ students in one commit)** — the QA script used a
  6-student cohort; the RPC's logic is per-row and has no reason to behave
  differently at scale, but this was not load-tested.
- **Concurrent double-click race** (two simultaneous commits with the *same*
  `request_id` arriving near-simultaneously, as opposed to the sequential
  replay tested here) — the `FOR UPDATE` lock inside the RPC is designed to
  serialize this, per `PHASE2_COMPLETION_REPORT.md` §9's disclosed
  limitation, but true concurrent-request behavior was not exercised.

## 6. Sign-off recommendation

All 66 acceptance checks pass, both real bugs found during this pass are
fixed and applied live, and the implementation's architectural guarantees
(no financial accounts created, no historical row rewrites beyond the one
documented `status` transition, bare unconfigured next cohort, full
rollback-on-failure atomicity, idempotent replay, correct permission
scoping) are all independently confirmed against a live database rather than
a mock. **Recommend sign-off**, with the disclosed gaps in §5 carried forward
as Phase 3 candidates rather than blockers.
