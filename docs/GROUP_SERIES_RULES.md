# Group Series & Lineage Model — Design Rationale

**Status:** Phase 0 built the schema (`group_series` table, `groups.series_id`,
`student_enrollments.renewal_of`). As of Phase 2, the Graduation Wizard is the
first (and still only) workflow that actually populates both columns — see
`docs/DOMAIN_RULES.md` Rule 14. This document explains *why* the model looks
the way it does, so future work builds on it correctly instead of
re-deriving or contradicting these decisions.

Related: [DOMAIN_RULES.md](DOMAIN_RULES.md) (business invariants — read that
first for the *rules*; this document is about the *shape of the model* and why
alternatives were rejected).

---

## 1. The problem this model solves

A physical class slot — "Robotics, Saturdays 10am, Branch 3" — runs every
semester. Each semester it is a **new** `groups` row (new roster, new schedule,
new instructor allocation, its own attendance history). But operationally it is
"the same class" continuing across semesters, and a student's academic journey
(Scratch → Python 1 → Python 2 → Arduino) moves through a *sequence* of these
rows, not through one row that gets edited in place.

Two independent lineages need to be tracked, and they are **not the same
lineage**:

1. **The slot** — which recurring class-time keeps recurring, semester after
   semester, regardless of who's enrolled in it.
2. **The student** — which specific enrollments make up one student's
   continuing academic path, regardless of which slot each one happened to run
   in.

`group_series` tracks the first. `student_enrollments.renewal_of` tracks the
second. They are deliberately two separate mechanisms because they answer two
different questions and frequently diverge — a student's next course is often
a *different* series entirely (Python 1 might run Saturdays; the same
student's Python 2 might run Sundays, in a completely different `group_series`
row, taught by a different instructor).

---

## 2. Why `group_series` exists

`group_series` is the **slot dimension table**: branch, name, day-of-week,
time, default capacity/room, default course hint. It exists so that "the
Saturday-10am Robotics class at Branch 3" has one stable identity across every
semester it runs, independent of any single semester's actual `groups` row.

Without it, there is no way to answer "how has this class slot performed over
its last 6 semesters?" or "who taught this slot each time?" without fragile
guesswork (matching on `name` + `branch_id` + `day_of_week`, which Rule 4 in
`DOMAIN_RULES.md` explicitly says must **not** be relied on — the same visible
name is legally allowed to repeat with zero relationship implied).

`group_series` is:
- **Small and mostly static** — one row per recurring slot, not one row per
  semester. It does not grow with enrollment volume.
- **Never itself archived or deleted** as part of a group's lifecycle — a slot
  can go dormant (no active `groups` row pointing at it for a while) and come
  back; the slot identity persists either way.
- **Referenced, not owned** — `groups.series_id` is a nullable FK pointing
  *at* a series. A `groups` row's lifecycle (Running → Completed → Archived)
  never touches or locks `group_series` itself.

---

## 3. Why `renewal_of` exists

`student_enrollments.renewal_of` is a self-referencing, nullable FK that chains
one student's enrollments across their academic path: each hop (Scratch →
Python 1 → Python 2 → Arduino) is a **new** enrollment row pointing back at the
enrollment it continues from — never an edit of the previous one.

This is the student-facing complement to `group_series`. Where `group_series`
answers "which slot," `renewal_of` answers "what did this specific student do
before this, in order." Critically:

- `renewal_of` points at a **previous enrollment**, never at a group or a
  series. The chain follows the student's path, which can cross slots,
  branches, and even courses (a student's next hop is a different subject
  entirely, e.g. Python 2 → Arduino).
- It already existed in the schema before this feature (dormant, unused) —
  this model activates a column that was already there, rather than inventing
  a new one, and Rule 5 in `DOMAIN_RULES.md` explains why every hop must be a
  new row: rewriting or deleting the previous enrollment would erase which
  group a student's *past* payments and attendance actually belonged to.

---

## 4. Why `predecessor_group_id` was rejected

An earlier option considered was a single `predecessor_group_id` column
directly on `groups` — "this group is the direct successor of that group" —
instead of a separate `group_series` dimension table. It was rejected for
three concrete reasons:

1. **It doesn't survive renames or gaps.** If a slot skips a semester (no
   class ran one term) or its `name` changes, a predecessor chain either
   breaks or has to guess across the gap. A stable `group_series` identity
   doesn't care whether a semester was skipped or a name changed — the slot
   identity is independent of both.
2. **It conflates two different questions.** A `predecessor_group_id` chain
   answers "what group came before this one" — but that's ambiguous the
   moment a slot's course, instructor, or room changes between semesters while
   the *time slot* itself is unchanged. `group_series` cleanly separates "this
   is the same recurring slot" from "here's what changed between runs,"
   without forcing every attribute to stay identical for the chain to make
   sense.
3. **It gives worse reporting for no simplicity benefit.** A dimension table
   supports a trivial `GROUP BY series_id` rollup across every semester a slot
   has ever run — attendance trends, instructor history, capacity utilization
   over time — without a recursive CTE walking a linked list of predecessor
   pointers. The one-time cost of a small additional table was judged clearly
   worth it over a data structure that would need extra query complexity for
   every rollup report going forward.

`predecessor_group_id` was offered as the lighter-weight alternative during
design; the user explicitly chose `group_series` for these reasons.

---

## 5. How historical integrity is preserved

Neither `group_series` nor `renewal_of` weakens the immutability guarantee
described in `DOMAIN_RULES.md` Rule 1. Specifically:

- A `groups` row reaching the **Archived** stage locks its own
  `group_courses` / `group_instructors` / `group_students` / `schedules` /
  `attendance_records` rows (Phase 1, not yet built). `series_id` on that row
  is just a pointer — archiving a semester's group never touches, relinks, or
  requires any change to the `group_series` row it points at.
- `renewal_of` never rewrites the enrollment it points back to (Rule 5) — the
  old enrollment's `group_id`/`course_id`/dates/financial account/attendance
  history stay exactly as they were, permanently, under the old group. The
  one deliberate exception is the old enrollment's own `status` column, which
  the Graduation Wizard transitions away from `ACTIVE` (to `COMPLETED`/
  `PAUSED`/`DROPPED`/`TRANSFERRED` per decision, see `DOMAIN_RULES.md` Rule
  14) so it stops colliding with the new `ACTIVE` row on
  `uq_student_enrollments_active_course` — this is a status transition, not a
  historical rewrite. The chain is otherwise purely additive: read backward
  through `renewal_of` to reconstruct a journey; nothing about walking that
  chain forward ever mutates a past link's substantive data.
- Both mechanisms are additive-only by construction: a series or a renewal
  link can be *added* pointing at history, but nothing in this model ever
  requires editing a historical row to add a new one on top of it.

---

## 6. How reporting will work

Once populated (this is future-phase work — Phase 0 adds only the empty
columns/table):

- **Slot-level reporting** — "attendance trend for this recurring class over
  its last N semesters," "which instructors have taught this slot," "capacity
  utilization by slot over time" — is a `GROUP BY groups.series_id` rollup
  joining each semester's `groups` row that shares a `series_id`. No recursive
  query needed; `group_series` is a flat dimension.
- **Student-journey reporting** — "this student's full academic path,
  Scratch → Python 1 → Python 2 → Arduino, each marked
  Completed/Current/Upcoming" — is a walk of `student_enrollments.renewal_of`
  for one student, which is a short chain (one hop per course taken, not per
  semester), independent of which series each hop happened to run in.
- **Instructor cross-cohort history** — "which groups has this instructor
  taught, when, how many students, completion rate" — joins
  `group_instructors`/`group_courses` across every `groups` row, optionally
  rolled up by `series_id` when the question is "how did this specific
  recurring slot perform" rather than "everything this instructor has ever
  taught."

These two report families are independent by design — a slot rollup never
needs to know about student journeys, and a student-journey walk never needs
to know which series any given enrollment's group belonged to.

---

## 7. How future developers should use this model

- **Never infer lineage from `name` + `branch_id` + `day_of_week` matching.**
  That combination is legally allowed to repeat with no relationship implied
  (`DOMAIN_RULES.md` Rule 4). If you need "is this the same recurring slot as
  that one," the answer is `series_id` equality — nothing else.
- **Never use `renewal_of` to represent slot continuity, and never use
  `series_id` to represent a student's academic path.** They are not
  interchangeable and answering the wrong question with the wrong column will
  produce silently incorrect reports (a student-journey query that
  accidentally groups by `series_id` will miss every course change that moved
  slots, which is the common case, not the exception).
- **Every new enrollment hop is a new row.** If you are building "Create Next
  Cohort" (the planned feature that consumes this model) and are tempted to
  update a `student_enrollments` row in place to "move" a student, don't —
  create a new row and set its `renewal_of` to the old one instead. See
  `DOMAIN_RULES.md` Rule 5 for exactly why (`transferEnrollment()`'s in-place
  `student_financial_accounts.group_id` rewrite is the cautionary example
  already in the codebase — dead code, zero callers, and must not be reused
  as-is).
- **A group is linked to a series by setting `groups.series_id` at creation
  time**, typically when "cloning" a finished semester's slot into a new one
  for the next semester. **As of Phase 2**, the Graduation Wizard
  (`commit_cohort_graduation()`, `modules/groups/actions/graduation.ts`) is
  this workflow — Step 4 ("Next Cohort") prefills `series_id` from the
  graduating cohort's own `series_id` if it was already set, and the TL may
  set/change it before committing. No other code path creates this link.
- **Don't add a uniqueness constraint on `group_series` beyond its primary
  key.** Two series rows with the same `branch_id`/`day_of_week`/`time` are
  not necessarily duplicates — e.g. a slot that moved rooms/time and a brand
  new slot that happens to share a schedule are still distinct identities. Do
  not "clean up" apparent duplicates without confirming they aren't
  legitimately separate slots.
