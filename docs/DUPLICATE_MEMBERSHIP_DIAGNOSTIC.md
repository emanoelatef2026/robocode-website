# Duplicate Active Membership — Diagnostic Report (Read-Only)

**Date:** 2026-07-13
**Scope:** Phase 0.5, Objective 2. Read-only investigation only — **no data was
modified, no constraint was added, no trigger was created.**
**Database:** Supabase project `fkqwafedruparlqjiprq` (production).

---

## 1. Method

Two independent tables can represent "a student is currently active in something,"
and the codebase's "current group" resolver pattern
(`.eq('status','active').order('joined_at', {ascending:false}).limit(1).maybeSingle()`,
found repeated across `modules/student-portal/queries.ts`,
`modules/parents/parent-portal-queries.ts`, `modules/tl-dashboard/queries.ts`, and
elsewhere) reads from **`group_students`** — that is the operational
"who's actually in this class" table. **`student_enrollments`** is the parallel
financial/ledger table, dual-written alongside `group_students` since "Sprint 41"
per in-code comments, but it is not what the "current group" resolvers query.

Both tables were checked independently for students holding more than one row
with an active-equivalent status (`group_students.status = 'active'`;
`student_enrollments.status = 'ACTIVE'`) at the same time. Every result below is
a direct SQL query against production data — nothing here is inferred or
sampled.

---

## 2. Finding A — `group_students` (the operational table): 1 case

```sql
select student_id, count(*) from group_students
where status = 'active' group by student_id having count(*) > 1;
```

Exactly **one** student (out of 164 distinct students holding an active
membership) has two concurrent active `group_students` rows: **`STU-000072`**.

| Group | Branch | Day / Time | Course (via `group_courses`, active) | Joined |
|---|---|---|---|---|
| Sh-Mon-8-python1 | ElShrouk City | Monday | Python 1 | 2026-06-14 |
| Ba_Tues_4 | Badr City | Tuesday 16:00 | Wedo 2 Robotics | 2026-06-16 |

**Classification: VALID.**

This is exactly the "Python + Robotics simultaneously" pattern named in the
Phase 0.5 brief: two different courses, two different branches, two different
weekdays, both still active, neither `left_at`. Nothing indicates a
move-without-closing bug — this reads as a student legitimately enrolled in two
different programs at once.

**However — this single Valid case already demonstrates the real production
risk the constraint work exists to fix.** The "current group" resolver
(`order('joined_at', desc).limit(1)`) would silently return only "Ba_Tues_4"
(joined last) for this student on any dashboard, homework list, or "current
group" lookup — hiding the Python 1 enrollment entirely, even though it is
still fully active. A correct fix must **allow** this valid case to keep working
while still detecting truly invalid duplicates (see §4 and the constraint
strategy document).

---

## 3. Finding B — `student_enrollments` (the financial/ledger table): 14 cases

```sql
select student_id, count(*) from student_enrollments
where status = 'ACTIVE' group by student_id having count(*) > 1;
```

**14 students** hold 2–3 concurrent `ACTIVE` `student_enrollments` rows — a much
larger number than Finding A, and a **different mechanism entirely**. None of
these 14 students appear in Finding A's list — `group_students` is clean for all
of them. The duplication lives only in the ledger table.

### Pattern observed (13 of 14 students)

In every one of these 13 cases, the pair (or trio) of rows splits cleanly into:

- **One row with no `group_id`, no `group_course_id`, no `course_id`** — only a
  free-text `course_name_snapshot` (in 11 of 13 cases, literally
  `"Pictoblox Coding"`; in 2 cases both rows in the pair are entirely blank —
  no group, no course name at all).
- **One row with a real `group_id` + `group_course_id`** (in the cases with a
  linked group, that group is `Shrouk-Tues6 Pictoblox` at ElShrouk City,
  confirmed via `group_courses` to be teaching Pictoblox Coding) — but this row
  has `course_name_snapshot = NULL`.

`created_at` timestamps show these were created by two separate, uncoordinated
events — sometimes minutes apart, sometimes days apart — never as a single
atomic insert. Example (`STU-000014`): a free-text-only row created
2026-06-06 23:39:50, then a properly group-linked row for the *same* group
(`Shrouk-Tues6 Pictoblox`) created three days later, 2026-06-09 21:36:08. The
first row was never closed when the second was created.

Two students (`STU-000201`, `STU-000105`) show an even more direct signature:
both rows are completely blank (no group, no course name at all) and were
created **11 seconds** and **59 seconds** apart, respectively — consistent with
a double form-submission, not two distinct enrollment decisions.

**Root cause (best-supported explanation, not fully re-traceable to a single
commit):** `student_enrollments` is written to by more than one independent code
path — `modules/enrollments/actions.ts`'s `enrollStudentFull` (the
finance-driven enrollment wizard, which can create a `student_enrollments` row
with only a course/name context and no group yet — by current-code design,
line 95-108, this branch requires `input.course_id` and would populate
`course_id`, so today's code cannot literally reproduce a `course_id = NULL`
row — meaning these rows most likely predate a prior version of this same
function, before `course_id` was threaded through as a column/parameter) and
`modules/groups/actions.ts`'s dual-write inside `enrollStudent`/
`addStudentsToGroupAction` (which sets `group_id` + `group_course_id` but never
touches `course_name_snapshot`). **Neither insert path checks for an existing
`ACTIVE` `student_enrollments` row for the same student before inserting a new
one, and neither closes out the other's row.** This is the same category of bug
as the `group_students` Priority 0 concern already on record
(`addStudentsToGroupAction` not closing the old row) — but manifesting
independently in the ledger table via a different pair of call sites.

**Classification: INVALID** (13 of 14 students). These are not two legitimate
concurrent enrollments — they are duplicate bookkeeping rows describing what is,
in each case, a *single* real-world enrollment event (a student joining
`Shrouk-Tues6 Pictoblox`, or an unspecified course) that got written twice by
two different features that don't know about each other. Full list:

| Student | Rows | Same course? | Gap between inserts |
|---|---|---|---|
| STU-000036 | 2 | Both Pictoblox Coding | 34 min |
| STU-000049 | 3 | All Pictoblox Coding | ≤5 min (all three) |
| STU-000012 | 2 | Both Pictoblox Coding | 10 min |
| STU-000017 | 2 | Both Pictoblox Coding (one via linked group) | next day |
| STU-000201 | 2 | Both blank — no course info at all | **11 sec** |
| STU-000015 | 2 | Both Pictoblox Coding (one via linked group) | next day |
| STU-000053 | 2 | Both Pictoblox Coding (one via linked group) | 5 min |
| STU-000014 | 2 | Both Pictoblox Coding (one via linked group) | 3 days |
| STU-000011 | 2 | Both Pictoblox Coding | ~9 hrs (same evening) |
| STU-000016 | 2 | Both Pictoblox Coding (one via linked group) | 3 days |
| STU-000050 | 2 | Both Pictoblox Coding | 5 min |
| STU-000052 | 3 | All Pictoblox Coding (one via linked group) | 4 min, then 11 min |
| STU-000105 | 2 | Both blank — no course info at all | **59 sec** |

### The one exception — needs manual review, not auto-classified

**STU-000010** (`<STU-000010_UUID>`): one row is linked to
real group `Shrouk-Sun6 Scratch jr` (whose *actual* `group_courses` assignment,
checked directly, is titled **"General Sessions"** — a generic placeholder
course, not literally "Scratch Jr" despite the group's display name); the other
row is free-text `course_name_snapshot = "Pictoblox Coding"`, no group. Because
the group's real course link is a generic placeholder rather than a specific
subject, this tool cannot confidently determine whether this reflects (a) a
second, genuinely different course interest — which would be **Valid** — or
(b) the same duplicate-write pattern as the other 13, just landing on a
differently-named placeholder group. **Classification: INDETERMINATE — flag for
manual review before any automated remediation touches this student.**

---

## 4. Summary table

| Table | Students affected | Valid | Invalid | Indeterminate |
|---|---|---|---|---|
| `group_students` (operational) | 1 | 1 | 0 | 0 |
| `student_enrollments` (ledger) | 14 | 0 | 13 | 1 |

**15 distinct students total** are touched by some form of duplicate-active
condition, out of 164 students with any active group membership (~9%). The
scale is small enough to review individually before any fix, and small enough
that a partial unique index (see the constraint-strategy document) is a safe,
low-risk remediation once approved.

---

## 5. What this diagnostic does NOT do

Per Phase 0.5 scope: this is read-only. No row was updated, no `left_at` was
set, no enrollment was closed, no constraint or trigger was created, and no
migration was written. The recommended remediation is proposed separately in
`docs/PRIORITY_0_PROPOSAL.md` and requires explicit approval before any of it
is applied.
