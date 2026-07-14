# Phase 2 — Data & Code Fix Report

**Date:** 2026-07-06
**Reference:** `docs/LMS_FIX_PROMPTS.txt` (Stage 1: code), `docs/LMS_FULL_REVIEW_2026-07-05.md` (§2–3)
**Project:** `fkqwafedruparlqjiprq`

## 1. Code fixes (deployed to `main`, commits `57dbd99`, `aaa7735`, `f2c00b4`)

| # | Fix | File(s) |
|---|-----|---------|
| 1 | Installment count capped at 36, 5-year due-date horizon guard (server + client, real clamp not just HTML `max`) | `modules/enrollments/actions.ts`, `app/portal/team-leader/finance/EnrollmentWizard.tsx` |
| 2 | `addPayment`/`quickPayment` auto-link to oldest outstanding installment (FIFO by `due_date`) when `installment_id` not supplied | `modules/finance/actions.ts` |
| 3 | TL trial-session detail now has present/absent attendance UI + Save Attendance, `handleEnd` calls `endTrialSessionWithAttendance` instead of the no-op `endTrialSession` | `TLSpecialSessionDetail.tsx` |
| 4 | 4 pre-existing test fixtures fixed (array-vs-object mock, missing `isBranchAccessible` mock, missing `topic` field, missing `attendance_status` in TEST 15b) | `tests/analytics/queries.test.ts`, `tests/progress/wiring.test.ts`, `tests/special-sessions/special-sessions.test.ts` |
| 5 | Migration filename drift reconciled — `security_hardening`/`security_hardening_revoke_public` (already applied in a prior session under different timestamps) renamed locally to match `schema_migrations` | `supabase/migrations/20260705202917_*.sql`, `20260705203318_*.sql` |
| 6 | **New bug found during Phase 2 execution:** `reconcile_student_attendance_sql` failed on every real invocation with `column reference "enrollment_id" is ambiguous` — `RETURNS TABLE(enrollment_id, ...)` implicitly declares an OUT variable that collided with the temp-table column of the same name in unqualified `SELECT`s. Never caught before because the function had only been code-reviewed, not executed. Fixed by qualifying all references. | `supabase/migrations/20260706120000_fix_reconcile_ambiguous_enrollment_id.sql` |
| 7 | Daily Vercel cron for `mark_overdue_installments` + `mark_broken_promises` (pg_cron not enabled on this project). **`auto_fulfill_promises` was excluded** — it turned out to be an `AFTER INSERT` trigger on `finance_payments`, not a callable maintenance function; it already runs on every payment insert. | `app/api/cron/finance-maintenance/route.ts`, `vercel.json` |

Verification: `npx tsc --noEmit` → 0 errors. `npx vitest run` → 244/244 passed.

**Action needed from you:** set the `CRON_SECRET` env var in the Vercel project dashboard (Settings → Environment Variables) — I can't set it myself. Vercel Cron sends it automatically as `Authorization: Bearer $CRON_SECRET`.

## 2. Data fixes (re-verified against live DB before touching anything — all numbers matched the 2026-07-05 diagnosis exactly)

### a) Corrupted installment account (`<CORRUPTED_ACCOUNT_ID>`, contract `<CORRUPTED_ACCOUNT_CONTRACT_CODE>`)
- Backed up first: `finance_installments_backup_20260706` (3,400 rows).
- Deleted the 3,400 bogus EGP-1 installments (confirmed 0 `finance_payments` referenced any of them — safe).
- **Deviation from the original plan, based on what the live data actually showed:** the account already had `paid_amount = 3400.00` / `remaining_amount = 0.00` from one real EGP 3,400 Instapay payment on 2026-06-06 (previously unlinked, `installment_id IS NULL`). So instead of regenerating a `PENDING` installment as originally planned, I regenerated one installment (`amount = 3400`, `due_date = 2026-06-09`, the account's existing `next_due_date`) and linked the existing payment to it. The existing trigger recomputed it correctly to `status = PAID`.
- Before → after: 3,400 installments → 1 (`PAID`).

### b) 3 missing financial accounts
Created for the 3 students confirmed to have a real free/legacy enrollment (`net_amount = 0`) and no account:
- `<MISSING_ACCOUNT_1_STUDENT_ID>` (enrollment `<MISSING_ACCOUNT_1_ENROLLMENT_ID>`)
- `<MISSING_ACCOUNT_2_STUDENT_ID>` (enrollment `<MISSING_ACCOUNT_2_ENROLLMENT_ID>`)
- `<MISSING_ACCOUNT_3_STUDENT_ID>` (enrollment `<MISSING_ACCOUNT_3_ENROLLMENT_ID>`)

All created with `net_amount = 0`, `status = PAID`. The other ~61 students without an account (no enrollment at all) were intentionally left untouched per the original decision.

### c) Attendance consumption reconciliation
Ran `reconcile_all_unmatched_sql()` (after fixing the bug in §1.6 above):
- `attendance_consumptions`: 20 → 304 (+284 matched)
- `v_consumption_integrity` (MISSING): 506 → 222

The remaining 222 are attendance records with no eligible enrollment covering that date/capacity — a genuine data gap (e.g., attendance outside any active contract window), not something the FIFO reconciler can resolve. Left as-is; would need manual review per-student if you want them closed out.

### d) Overdue installments / broken promises
Ran `mark_overdue_installments()` and `mark_broken_promises()` once manually (both will now also run daily via cron): 64 of the 65 past-due `PENDING` installments flipped to `OVERDUE` (the 65th was the corrupted account's row, now `PAID`).

### e) 42 orphan sessions (`v_orphan_sessions`)
Resolves to 5 `group_courses`, all with **no instructor assigned at all** (not a per-session gap):

| Group | Course | Sessions |
|---|---|---|
| 5th-tues6 (Age 5-8) | Pictoblox Coding | 24 |
| Shrouk-Mon-6 Arduino 2 | Arduino L2 | 12 |
| on_web_fri_10 | Web_1 | 3 |
| Test Group | Test | 2 |
| on_picto_2026 | Pictoblox Coding | 1 (cancelled) |

**Deferred per your instruction** — no instructor assigned, "Test Group" not deleted. Revisit later via the TL Groups Workspace.

## 3. Before / after summary

| Metric | Before | After |
|---|---|---|
| Installments on corrupted account | 3,400 | 1 (PAID) |
| Total PENDING installments | 3,507 | 43 |
| OVERDUE installments | 0 (bug: never marked) | 64 |
| Payments linked to an installment | 0 / 112 | 1 / 112 (the rest will link automatically going forward via the FIFO fix — see §1.2) |
| `attendance_consumptions` rows | 20 | 304 |
| `v_consumption_integrity` MISSING | 506 | 222 (genuine residual, no eligible enrollment) |
| Students without a financial account (real enrollment) | 3 | 0 |
| `v_orphan_sessions` | 42 | 42 (deferred — needs instructor decision) |
| TypeScript errors | 0 | 0 |
| Test suite | 244 (5 failing before this session started) | 244/244 passing |

## 4. Not done in this pass (out of scope / deferred)
- Stage 3 (migration folder unification beyond the one filename fix above), Stage 4 (performance advisories), Stage 5 (code cleanup/dead modules), Stage 6 (CI, integrity-check cron) from `docs/LMS_FIX_PROMPTS.txt` — untouched.
- The 222 residual `v_consumption_integrity` MISSING rows and the 42 orphan sessions — both need manual/business decisions, not further automation.
- Leaked-password protection and MFA — still need to be enabled manually from the Supabase Auth dashboard (can't be done via migration).
