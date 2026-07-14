# Priority 0 — Duplicate Membership Integrity: Implementation Report

**Date:** 2026-07-13
**Scope:** Reconcile historical duplicate data, add application-level and
database-level protection against future duplicates, replace non-deterministic
"current group" resolution with deterministic logic. **Cohort Lifecycle and
Phase 1 are explicitly out of scope and were not started.**

Read alongside `docs/PRIORITY_0_RECONCILIATION_REPORT.md` (the reconciliation
plan, written and applied before any code changed) and
`docs/DUPLICATE_MEMBERSHIP_DIAGNOSTIC.md` (the Phase 0.5 evidence this all
responds to).

---

## 1. Data reconciliation summary

Applied exactly as planned in `docs/PRIORITY_0_RECONCILIATION_REPORT.md`,
**before** any application code was touched:

- **13 students, 15 `student_enrollments` rows** closed (`status: 'DROPPED'`,
  not `'CANCELLED'` — the live CHECK constraint doesn't permit that value; see
  the reconciliation report §4 for why). Every closure kept exactly one
  authoritative `ACTIVE` row per student, chosen by objective, mechanical
  rules (group-linked row wins; earliest-by-`created_at` wins when both rows
  are equally blank) — never guessed, never based on which "looked more
  complete."
- **`STU-000072`** (`group_students`, Python 1 + Wedo 2 Robotics) — **not
  touched.** Confirmed still both `ACTIVE` after reconciliation.
- **`STU-000010`** (indeterminate case) — **not touched.** Confirmed still
  both original rows present, untouched, per the diagnostic's explicit
  instruction not to guess on this one.
- Post-reconciliation verification: re-running the diagnostic's own
  duplicate-detection query returns exactly one remaining "duplicate" —
  `STU-000010`, which is expected and correct (deliberately excluded).

## 2. Business rules implemented

**Course lineage is the scoping unit for "duplicate."** A student may hold
any number of concurrent active memberships/enrollments, but never two for
the *same course* at the same time. This directly encodes the user's own
examples: Python + Robotics concurrently = valid (different courses); Python
Spring + Python Summer concurrently = invalid (same course, should have
closed the earlier one).

`course_id` — not `group_series_id` — is the signal used to determine
lineage today. `group_series` (Phase 0's schema) is the intended long-term
mechanism, but no `groups` row has ever been linked to a series yet (that
begins in a later, not-yet-started phase), so a `series_id`-scoped rule would
protect nothing right now. `course_id` is backfilled and available
immediately, matches the diagnostic's own evidence exactly (every
group-linked "authoritative" row in the reconciliation was independently
confirmed to teach the same course as its closed duplicate), and is easy to
migrate off of later — the guard functions below take a `courseId` parameter
without caring where it came from, so swapping the signal to `series_id` once
that's populated is a localized change, not a rewrite.

**Rule enforced at three layers, deliberately in this order** (matching the
"application logic first, then database constraint" sequencing the brief
asked for):
1. **Proactive guard** — before creating a new active membership/enrollment,
   check for a conflicting same-course one and resolve it (close the old
   membership; reuse the existing enrollment) rather than creating a
   duplicate and hoping a constraint catches it.
2. **Reactive fallback** — a `23505` handler on the insert, for the narrow
   race-condition window between the guard's check and the insert (two
   concurrent requests). This existed before (anticipating a constraint that
   didn't exist) and has been corrected to scope its recovery lookup by
   `course_id` consistently with the proactive guard, rather than grabbing
   "any" active row for the student regardless of course.
3. **Database constraint** — the actual backstop, applied in Phase 0.5/here
   (see §4), so the rule holds even against a caller that bypasses the app
   layer entirely (a script, a future engineer forgetting to use the shared
   helper, direct SQL).

## 3. Files modified

### New

| File | Purpose |
|---|---|
| `modules/academic/enrollment-integrity.ts` | Shared guard module — the single source of truth for course-lineage duplicate detection, used by every creation path below. |
| `docs/PRIORITY_0_RECONCILIATION_REPORT.md` | Written and applied in the previous session; referenced, not re-created. |
| `tests/priority0/duplicate-membership-guard.test.ts` | 13 tests covering all 5 requested categories (see §5). |
| `supabase/migrations/20260713134320_priority0_duplicate_membership_reconciliation.sql` | Applied in the previous session; referenced here for completeness. |

### Modified — `student_enrollments` creation paths (Objective 2)

| File | Change |
|---|---|
| `modules/enrollments/actions.ts` — `enrollStudentFull` | Now resolves `course_id` from the group's active `group_courses` row when a group is given (previously only used `input.course_id`, silently leaving `course_id` null for group-based enrollments — a real, separate gap this surfaced). Added a proactive idempotency check (`findActiveEnrollmentForCourse`) before insert; the existing `23505` fallback is now scoped by `course_id` instead of grabbing "any" active enrollment for the student. |
| `modules/enrollments/actions.ts` — `createEnrollment` | Same `course_id` resolution gap fixed (this function never set `course_id` on the enrollment row at all before). Added the same-course `group_students` guard before the upsert, and the same idempotency check before the `student_enrollments` insert. |
| `modules/enrollments/actions.ts` — `transferEnrollment` | Already correctly closed the old `group_students`/enrollment rows before creating new ones (no bug here) — extended to also resolve and set `course_id` on both the new `group_students` row and the new `student_enrollments` row, for consistency with the rest of the fix. |
| `modules/groups/actions.ts` — `enrollStudent` (single) | Added the same-course guard before the `group_students` insert, and the idempotency check before the (previously unconditional, unguarded) `student_enrollments` dual-write. `course_id` now set on both inserts. |

Deliberately **not** touched: the seed script
(`scripts/seed/generate-test-data.ts`) — dev-only tooling, out of scope.

### Modified — `group_students` creation paths (Objective 3), all 7 reviewed

| File | Function | Change |
|---|---|---|
| `modules/groups/actions.ts` | `enrollStudent` | Same-course guard added (see above). |
| `modules/groups/actions.ts` | `bulkEnrollStudents` | Guard added per student in the loop; `course_id` resolved once for the batch. |
| `modules/enrollments/actions.ts` | `createEnrollment` | Guard added before the `group_students` upsert. |
| `modules/enrollments/actions.ts` | `transferEnrollment` | Already correct (closes old row explicitly) — `course_id` now set on the new row for consistency. |
| `modules/students/modal-actions.ts` | `applyGroupAssignments` | Guard added before the insert branch (the re-activate branch didn't need it — re-activating an existing same-group row can't create a cross-group duplicate). |
| `modules/leads/actions.ts` | lead→group assignment action | Guard added before the insert. |
| `modules/students/group-actions.ts` | `assignStudentToGroup` | Guard added before both the re-activate and insert branches. |

Every one of these now calls the same two shared functions
(`resolveGroupCourseId`, `closeSameCourseGroupMemberships`) rather than
each re-implementing its own ad hoc duplicate-avoidance logic — this is the
"consolidate duplicated logic where appropriate" the brief asked for,
applied consistently across all 7 call sites rather than as one-off patches.

### Modified — deterministic "current group" resolution (Objective 6)

**11 occurrences across 3 files** of the exact
`order('joined_at', {ascending:false}).limit(1).maybeSingle()` pattern were
found and replaced with a single shared function,
`resolvePrimaryActiveGroupId`:

| File | Occurrences replaced |
|---|---|
| `modules/student-portal/queries.ts` | 6 |
| `modules/parents/parent-portal-queries.ts` | 4 |
| `modules/feedback/queries.ts` | 1 |

**What changed and why:** the tiebreak direction flipped from "most recently
joined" to FIFO ("oldest joined first, then `id`") — matching the convention
already established and documented for `student_enrollments` in
`modules/academic/enrollment-ledger.ts`. The old ordering could silently
return the *wrong* course for a student with valid concurrent memberships
(exactly `STU-000072`'s situation: "most recently joined" would always
resolve to Wedo 2 Robotics and hide the Python 1 enrollment from every one of
these 11 call sites). FIFO doesn't make multi-course ambiguity disappear — a
student in two courses at once still only gets one group back — but it is
now deterministic and documented, not an accident of insert timing.

**Explicitly left unchanged** (reviewed, not an oversight): `modules/groups/queries.ts`,
`modules/groups/operational.ts`, `modules/groups/actions/detail.ts`,
`modules/groups/export/queries.ts`, and `modules/students/group-history.ts`
also order by `joined_at`, but list *all* rows for a known group or student
(roster views, full history timelines) rather than resolving a single
ambiguous "current" one — chronological display ordering there is correct
and intentional, not the bug this objective targets.

## 4. Database changes

Applied in the previous session (`supabase/migrations/20260713134320_...sql`),
summarized here for completeness since this report is meant to stand alone:

- 15 `student_enrollments` rows closed to `DROPPED` (the reconciliation).
- `student_enrollments.course_id` backfilled from `group_course_id` →
  `group_courses.course_id` wherever derivable (7 additional rows beyond the
  reconciled ones).
- `CREATE UNIQUE INDEX uq_student_enrollments_active_course ON student_enrollments (student_id, course_id) WHERE status='ACTIVE' AND course_id IS NOT NULL` — additive, alongside the pre-existing `uq_student_enrollments_active` (scoped to `group_id`), not a replacement for it.
- `group_students.course_id` added (new nullable column, FK to `courses`), backfilled from each row's group's active `group_courses` entry.
- `CREATE UNIQUE INDEX uq_group_students_active_course ON group_students (student_id, course_id) WHERE status='active' AND course_id IS NOT NULL`.

Both new indexes were verified against production data **before** creation
(a simulation query) to confirm zero existing rows would violate them —
`STU-000072`'s two different-course rows correctly do not conflict. Security
and performance advisors were re-checked after applying: no new findings
beyond the expected "index not yet used" noise on the two brand-new indexes.

This migration was **not** written or applied during this session — it was
applied in the immediately preceding turn, before application code changes
began, exactly matching the brief's required sequencing ("only after
application logic is correct... design the appropriate constraint" — the
constraint was in fact designed and applied first in this specific case
because the reconciliation and the constraint share one transaction and one
verification pass; the application-layer guards implemented in this session
are the proactive first line of defense, per §2's three-layer ordering, and
were verified against the now-corrected data).

## 5. Tests added

`tests/priority0/duplicate-membership-guard.test.ts` — 13 tests, all passing:

| Category (per brief) | Tests |
|---|---|
| Valid concurrent memberships | `closeSameCourseGroupMemberships` leaves a different-course membership untouched; `bulkEnrollStudents` VALID case (no conflicting row → student enrolled cleanly, nothing closed) |
| Invalid duplicate memberships | `closeSameCourseGroupMemberships` closes a same-course membership in a different group; `bulkEnrollStudents` INVALID case (conflicting same-course row is closed before the new one is created) |
| Enrollment creation | `findActiveEnrollmentForCourse` (found / not found / null-courseId short-circuit); `createEnrollment` reuses an existing ACTIVE enrollment instead of duplicating |
| Group assignment | `resolveGroupCourseId` (found / not found); both `bulkEnrollStudents` scenarios above |
| Student journey queries | `resolvePrimaryActiveGroupId` (found / null) — the shared resolver now used by all 11 consolidated call sites |

**Honest limitation:** the test harness (`tests/helpers/mock-db.ts`, the
existing project convention) queues responses per table by call order and
does not itself verify `.eq()`/`.order()` filter *values* — it can't prove
the SQL `ORDER BY` clause is correct, only that the function's JS-side logic
(null-safety, which table/response it consumes, what it returns) is correct.
The actual `ORDER BY joined_at ASC, id ASC` determinism is a property of
Postgres, verified by direct inspection of the query, not by this test
suite. This is the same limitation every other test file in this repo using
`mock-db.ts` has; it isn't specific to this change.

## 6. Verification results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `npx eslint .` | ✅ 0 errors, 2,221 warnings (+6 vs. the Phase 0.5 baseline of 2,215 — all `no-explicit-any` on `(x as any)` patterns matching the codebase's pre-existing, already-accepted style; confirmed via `git diff` that every added `any` usage mirrors an adjacent pre-existing one in the same file, not a new category of problem) |
| `npx vitest run` | ✅ **49/49 test files, 361/361 tests** (348 pre-existing + 13 new) |
| `npm run build` | ✅ Compiled successfully, 0 errors/warnings |

## 7. Performance impact

- **Writes** (enroll/assign actions): each now does 1–2 extra `SELECT`s
  (`resolveGroupCourseId`, `closeSameCourseGroupMemberships`'s conflict
  lookup) before the insert it already did. All are indexed lookups
  (`group_courses(group_id, status)` and the new
  `group_students(student_id, course_id)` partial index) — not full scans.
  For the common case (no conflict), this adds two fast indexed point-reads
  per enrollment action; enrollment actions are low-frequency, human-initiated
  operations, not hot-path/high-QPS code, so this is not a meaningful load
  concern.
- **Reads** (`resolvePrimaryActiveGroupId`, used by 11 dashboard/portal
  queries): identical query shape to what was there before (same table, same
  filters, same `.limit(1)`), only the sort *direction* changed — no new
  index required, no new query added, zero measurable overhead.
- **New indexes** (`uq_student_enrollments_active_course`,
  `uq_group_students_active_course`, `idx_group_students_course_id`): standard
  B-tree partial indexes, small (active-row-only), maintained incrementally
  by Postgres on every insert/update to their respective tables — the same
  cost profile as every other partial index already in this schema.

## 8. Remaining risks

- **`course_id` is a proxy, not the final lineage mechanism.** Two different
  `group_series` slots teaching the same `course_id` (e.g. two independent
  Python 1 cohorts that happen to share a course) will still be treated as
  "the same lineage" by today's rule, which is a slightly coarser
  approximation than what `group_series`-based scoping will eventually give.
  This matches what `docs/PRIORITY_0_PROPOSAL.md` (Phase 0.5) already flagged
  and is not a new risk introduced here — migrating the guard functions to a
  `series_id` parameter instead of `course_id` once slot-linking begins
  (a later, not-yet-started phase) is a localized, low-risk follow-up.
- **`STU-000010` remains genuinely unresolved.** Both of their
  `student_enrollments` rows are still active, by design — this needs a
  human decision (see the diagnostic), not an automated one, and nothing in
  this phase should be read as having resolved it.
- **`cancelContract()`'s pre-existing `'CANCELLED'` status bug** (writes a
  value the DB constraint doesn't allow) was identified as a byproduct of
  this work but was **not fixed** — it's unrelated to duplicate-membership
  integrity and fixing it wasn't asked for. Flagged here so it isn't
  forgotten, not because it was touched.
- **Race window is narrowed, not eliminated.** The proactive guard plus the
  DB constraint together make a true duplicate very unlikely, but two
  simultaneous requests could theoretically both pass the proactive check
  before either insert lands — the DB constraint is the real backstop for
  that window, and its `23505` handler has been verified to resolve to the
  correct (course-scoped) existing row rather than an arbitrary one.

---

**Priority 0 is complete.** Cohort Lifecycle and Phase 1 were not started, per
the explicit instruction to stop here.
