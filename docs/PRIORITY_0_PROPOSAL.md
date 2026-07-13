# Priority 0 — Constraint Strategy & Proposed Implementation

**Status: PROPOSAL ONLY. Nothing in this document has been applied.** No
migration, trigger, or code change described here has been written to the
database or the codebase. This exists to be reviewed and explicitly approved
before any of it is implemented, per the Phase 0.5 brief.

Read alongside `docs/DUPLICATE_MEMBERSHIP_DIAGNOSTIC.md` (the evidence this
proposal responds to) and `docs/GROUP_SERIES_RULES.md` (why `group_series`
exists and how it's meant to be used).

---

## 1. The core design tension

The diagnostic found exactly one Valid duplicate (`STU-000072`: Python 1 +
Wedo 2 Robotics, different branches, different courses) and it is precisely
the case the brief warned must **not** break: two different course lineages
running concurrently is legitimate and must stay possible. A constraint that
simply forbids "more than one active `group_students` row per student" would
be wrong — it would block a real, valid use case.

The correct scoping is **per lineage, not per student**: a student may hold
many concurrent active memberships, but not more than one *in the same
recurring slot lineage* at a time. `group_series` (see
`docs/GROUP_SERIES_RULES.md` §2) is exactly the identity that defines "same
lineage." This is why Priority 0 was sequenced, in the original architecture
record, to depend on `group_series` existing — it now does (Phase 0), but is
still empty; no `groups` row has ever been linked to a series.

**This creates a real gap this proposal must be honest about:** a constraint
scoped by `series_id` enforces nothing today, because `series_id` is `NULL`
on every single group. The strategy below is therefore split into what can be
done now (application-level, targets the actual root-cause code) and what
should be done later (DB-level, once series linkage begins).

---

## 2. Two separate problems, two separate fixes

The diagnostic found duplication in two structurally different places, and
they need different remedies:

### 2a. `group_students` (operational) — low volume, needs the lineage-aware constraint

Only one real case exists today, and it's valid. The risk here isn't current
bad data — it's that the "current group" resolver pattern
(`order('joined_at', desc).limit(1)`) already silently mis-resolves this one
valid case, and the underlying bug named in the architecture record
(`addStudentsToGroupAction` never closing a student's prior active
`group_students` row when adding them to a new one) could produce a *true*
invalid duplicate (e.g. "Python Spring + Python Summer") the next time a
student is moved between semesters of the same slot, since nothing currently
prevents it.

### 2b. `student_enrollments` (ledger) — 14 real cases, needs a simpler guard

This is a different bug entirely — two uncoordinated insert paths (the
finance-driven enrollment wizard vs. the group-membership dual-write) neither
check for an existing `ACTIVE` row before inserting nor close each other out.
It has nothing to do with lineage/series — it's plain missing-idempotency.
This can and should be fixed independently of the `group_series` timeline.

---

## 3. Recommended constraint strategy

### 3a. For `group_students` — denormalized `series_id` + partial unique index (target state, gated on series population)

A `UNIQUE (student_id, series_id) WHERE status='active'` index cannot be
built directly on `group_students` today because `series_id` lives on
`groups`, not `group_students` — Postgres unique indexes can only reference
columns of the same table, and index expressions can't perform joins or
subqueries.

**Recommended shape**, matching a pattern already established in this
codebase (certificates' and `student_enrollments`' snapshot columns — copying
a value from a joined table at write time rather than joining at read time):

```sql
-- PROPOSED — NOT APPLIED.
-- Step 1 (schema, Phase 2 timing — requires group_series to actually be
-- populated first, otherwise this indexes a column that's always NULL):
ALTER TABLE public.group_students
  ADD COLUMN series_id UUID REFERENCES public.group_series(id);
-- Populated at membership-creation time by copying groups.series_id,
-- exactly like group_name_snapshot/course_name_snapshot are populated today.

-- Step 2 (the actual guard):
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  uq_group_students_active_per_series
  ON public.group_students (student_id, series_id)
  WHERE status = 'active' AND series_id IS NOT NULL;
```

The `WHERE series_id IS NOT NULL` clause is load-bearing: it means the
constraint activates *only* for memberships whose group has been linked to a
series, and is silently inert (matches nothing) for every group that hasn't
been linked yet — which today is all of them. This makes the constraint safe
to add at any time without requiring an immediate backfill: it starts
protecting data the moment "Create Next Cohort" (or any other feature) starts
setting `series_id`, and does nothing before that.

**Why not a trigger instead:** a `BEFORE INSERT/UPDATE` trigger doing a
join-based subquery check would work without the denormalized column, but
costs a function call + subquery on every single membership write, forever,
for a check that a plain index does for free as part of normal B-tree
maintenance. Given the codebase's own established preference (snapshot
columns over live joins, see `DOMAIN_RULES.md` Rule 6) an index over a
denormalized column is the more consistent, cheaper, and simpler choice.

**Why this is gated, not immediate:** applying the index today (before any
`series_id` is ever set) would be a schema change with zero enforcement
value — a real migration with no real effect, adding maintenance surface
for nothing. It should be created in the same phase that starts populating
`group_series` links (Phase 2, "Create Next Cohort"), not before.

### 3b. For `group_students` — interim application-level guard (can apply now, independent of series_id)

Until 3a is live, the actual bug (`addStudentsToGroupAction` /
`enrollStudent` in `modules/groups/actions.ts` never closing a prior active
row) should be closed at the application layer: before inserting a new active
`group_students` row for a student, check whether they already hold an active
row in a group teaching the **same `course_id`** (via `group_courses`, the
closest available proxy for "same lineage" without `series_id` populated
yet) and close it (`status: 'dropped', left_at: now`) first — while
explicitly *not* closing active rows in a *different* course (preserving the
Python + Robotics valid case). This is a same-transaction code change to two
call sites, not a schema change, and does not require any migration.

### 3c. For `student_enrollments` — idempotency guard at both insert sites (can apply now)

Add a "does this student already have an ACTIVE enrollment matching this
same course/group?" check immediately before both insert points
(`modules/enrollments/actions.ts`'s `enrollStudentFull`, and
`modules/groups/actions.ts`'s dual-write inside `enrollStudent`) and either
skip the insert or close the pre-existing row first, mirroring the existing
23505-duplicate-key recovery branch already present in
`enrollStudentFull` (lines 145-158) — that code already anticipates and
handles a unique-constraint collision; the real gap is that there is no
unique constraint to violate today, so that recovery branch never triggers.
Adding a partial unique index on `(student_id, course_id) WHERE status =
'ACTIVE' AND course_id IS NOT NULL` would let the *existing* recovery code
path do its job. The 2 fully-blank duplicate pairs (`STU-000201`,
`STU-000105` — no course_id, no group_id in either row) would need a
narrower `NULLS NOT DISTINCT`-style safeguard (Postgres 15+) or an
application-level check, since a partial index filtered on `course_id IS NOT
NULL` wouldn't catch two blank rows.

---

## 4. Proposed sequence (for approval, not yet started)

1. **One-time manual data reconciliation** of the 15 students named in the
   diagnostic — **not automated**. `STU-000072`'s two rows are both correct
   and must both stay active. `STU-000010` needs a human to determine intent
   before touching either row. The other 13 `student_enrollments` pairs need
   a human decision on which row is authoritative (almost always the
   group-linked one) before the stray free-text row is closed — a blunt
   "keep only the most recent" script would be wrong in at least one
   observed case (STU-000014: the group-linked row is the *older*, not the
   newer, of the two in created_at order for some students, so recency is
   not a safe automatic tiebreaker).
2. **Application-level guards** (§3b, §3c) — code-only, no migration,
   lowest risk, stops new duplicates of both kinds from being created going
   forward.
3. **`student_enrollments` partial unique index** (§3c) — small, targeted
   migration, safe once step 1's existing bad data is cleaned up (a unique
   index cannot be created over data that already violates it).
4. **`group_students.series_id` column + gated partial unique index** (§3a)
   — sequenced together with, or after, whatever future phase starts
   populating `group_series` links (the "Create Next Cohort" feature) — not
   before, since it has no effect before then.

**This document proposes the above sequence. None of it should begin without
a separate, explicit go-ahead** — Phase 0.5 asked for the strategy and
proposal only, not implementation.
