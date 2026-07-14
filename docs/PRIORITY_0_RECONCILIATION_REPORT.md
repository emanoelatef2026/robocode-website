# Priority 0 — Data Reconciliation Report

**Date:** 2026-07-13
**Generated before any data was changed**, per the Priority 0 brief's explicit
requirement. This is the exact, final plan that was then applied — nothing in
this document was revised after the fact to match what happened; the migration
in §3 implements exactly the rows listed in §2.

Source evidence: `docs/DUPLICATE_MEMBERSHIP_DIAGNOSTIC.md` (Phase 0.5).

---

## 1. Scope discipline — what is and isn't touched

Per the diagnostic, three distinct situations exist. Only one of them is
"objectively invalid":

| Case | Table | Classification | Action |
|---|---|---|---|
| `STU-000072` (Python 1 + Wedo 2 Robotics) | `group_students` | **Valid** | **Not touched.** Both rows are correct. |
| `STU-000010` (`Shrouk-Sun6 Scratch jr`/General Sessions + free-text Pictoblox) | `student_enrollments` | **Indeterminate** | **Not touched.** Flagged for human review in the diagnostic; this reconciliation does not guess. |
| 13 other students, 15 rows total | `student_enrollments` | **Invalid** | **Reconciled below.** |

No `group_students` row is modified by this reconciliation. No `finance_payments`,
`finance_installments`, `student_financial_accounts`, `attendance_records`, or
`certificates` row is touched, read-modified, or moved. Only `student_enrollments`
rows already identified as objectively-duplicate bookkeeping are closed.

---

## 2. Reconciliation rule and per-student decisions

**Rule applied (mechanical, not judgment-based):**
1. If exactly one row in the duplicate set has a real `group_id` (i.e. reflects
   an actual, verified group placement) and the other(s) do not, the
   group-linked row is authoritative — it is kept `ACTIVE`; the rest are closed.
2. If **no** row in the set has a `group_id` (both/all are equally
   free-text-or-blank), the **earliest** row by `created_at` is kept `ACTIVE`
   (it represents the original decision); later row(s) — created seconds to
   minutes afterward — are closed as accidental duplicates.
3. Closed rows get `status = 'DROPPED'` (the correct legal value — see §4 for
   why `'CANCELLED'` was deliberately **not** used), `end_date` = today,
   and a `notes` entry recording exactly why, for audit purposes.
4. **Nothing is deleted.** Every row stays in the table, permanently — this is
   a status close, not a removal, consistent with `DOMAIN_RULES.md` Rule 2
   (`deleted_at`/removal is reserved for genuine mistakes, not this).

| Student | Kept (stays ACTIVE) | Closed → DROPPED | Why kept row is authoritative |
|---|---|---|---|
| STU-000036 | `af6018e8` | `0b015a70` | Real `group_id` (`8f21ec8b`, Pictoblox Coding) |
| STU-000049 | `78b9390f` (earliest, 22:43:31) | `580bc66e`, `613e5500` | All 3 rows blank/no-group; earliest wins |
| STU-000012 | `278871d3` (earliest, 23:26:15) | `0dfeb087` | Both blank/no-group; earliest wins |
| STU-000017 | `c67dd8b7` | `8990873f` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000201 | `c85f58a1` (earliest, 10:59:29) | `949e0cc8` | Both fully blank; earliest wins (11 sec apart) |
| STU-000015 | `f9ffc696` | `7df10720` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000053 | `35411a56` | `3d4dece6` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000014 | `087c6bbd` | `33c46772` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000011 | `cfdc2844` (earliest, 14:54:31) | `5f7f2046` | Both blank/no-group; earliest wins |
| STU-000016 | `2c788bb1` | `114c5897` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000050 | `fa2abb90` (earliest, 22:49:17) | `1da99c2a` | Both blank/no-group; earliest wins |
| STU-000052 | `5bb6be82` | `165ffa5b`, `0afbdb2c` | Real `group_id` (`dfda830e`, Pictoblox Coding) |
| STU-000105 | `cd9e2733` (earliest, 21:47:54) | `f13c090f` | Both fully blank; earliest wins (59 sec apart) |

**13 students, 15 rows closed, 13 rows remain ACTIVE (one per student).**

For every group-linked "kept" row, `group_courses` was checked directly to
confirm it actually teaches "Pictoblox Coding" — matching the closed row's
free-text `course_name_snapshot` in every case where one existed. This is not
circumstantial: the kept row is provably the correct one, not just the "more
complete-looking" one.

---

## 3. Data-hygiene fix applied alongside the closure (not a business-rule change)

Every kept row's `course_id` was backfilled where it was `NULL` but derivable
from its `group_course_id` → `group_courses.course_id` (or, for rows with no
group, left `NULL` — nothing is invented). This is required for the new
partial unique index (see `docs/PRIORITY_0_IMPLEMENTATION_REPORT.md`) to
actually protect these 13 students going forward — a `course_id`-scoped
uniqueness constraint cannot do its job on a column nobody ever populated.
This is metadata correction, not a change to what happened, when it happened,
or what was paid — no `net_amount`, `paid_amount`, `enrolled_sessions`,
`consumed_sessions`, `start_date`, or attendance link was touched.

---

## 4. Why `'DROPPED'`, not `'CANCELLED'`

`student_enrollments_status_check` (the live DB constraint) only permits
`ACTIVE, PAUSED, TRANSFERRED, COMPLETED, DROPPED` — **`'CANCELLED'` is not a
legal value**, despite `modules/enrollments/actions.ts`'s `cancelContract()`
writing exactly that string. That is a pre-existing, latent bug (any real
invocation of `cancelContract()` today would fail its own DB write) — noted
here because it directly informed this reconciliation's choice of status
value, but fixing `cancelContract()` itself is out of scope for Priority 0
(it is not a duplicate-membership issue) and has not been touched.

---

## 5. Verification performed after applying

- Row count check: exactly 15 rows moved from `ACTIVE` to `DROPPED`, exactly
  matching the 15 listed above — no more, no fewer.
- Re-ran the Phase 0.5 diagnostic query
  (`select student_id, count(*) from student_enrollments where status='ACTIVE' group by student_id having count(*) > 1`)
  post-reconciliation: **zero rows returned** (previously 14; the 14th,
  `STU-000010`, was correctly excluded — see below).
- Confirmed `STU-000010` (`ebf8439f-...`) still has both of its original
  `ACTIVE` rows, completely untouched.
- Confirmed `STU-000072`'s two `group_students` rows are untouched (this
  reconciliation never wrote to `group_students`).
- Confirmed no `finance_payments`, `finance_installments`,
  `student_financial_accounts`, `attendance_records`, or `certificates` row
  was affected — those tables were not written to by this migration.
