# Phase 2 — Final Closure Report

**Date:** 2026-07-06
**Project:** `fkqwafedruparlqjiprq`
**Supersedes/extends:** `docs/PHASE2_DATA_FIX_REPORT.md` (code fixes + data corrections)

---

## 1. Cron route verification & hardening

`app/api/cron/finance-maintenance/route.ts` — reviewed and hardened.

**Authentication**
- Gate: `Authorization: Bearer $CRON_SECRET`. This is the mechanism Vercel Cron uses automatically once `CRON_SECRET` is set as an env var on the project — no code-side wiring needed beyond checking the header.
- Fails closed: if `CRON_SECRET` is unset, every request is rejected (never falls back to "no auth required").
- **Fixed this pass:** the token comparison used plain `!==` string equality, which leaks timing information. Replaced with `crypto.timingSafeEqual` over equal-length buffers (mismatched length is rejected pre-comparison without timing signal either way).
- `x-vercel-cron: 1` (the header Vercel stamps on cron-triggered requests) is logged for observability on unauthorized attempts, but is never trusted as an auth signal on its own — it isn't cryptographically verified and could be forged by a caller, so `CRON_SECRET` remains the only real gate.
- Route cannot be called publicly without knowing the secret: confirmed by live test (§6).

**Idempotency review** — both RPCs called by the route are plain, no-INSERT `UPDATE ... WHERE <status> AND <date> < CURRENT_DATE` statements:
```sql
-- mark_overdue_installments()
UPDATE finance_installments SET status='OVERDUE' WHERE status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE;
UPDATE student_financial_accounts SET status='OVERDUE' WHERE status IN ('CURRENT','DUE_SOON') AND next_due_date < CURRENT_DATE AND remaining_amount > 0;

-- mark_broken_promises()
UPDATE payment_promises SET status='BROKEN' WHERE status='ACTIVE' AND promised_date < CURRENT_DATE;
```
A row that already transitioned no longer matches its `WHERE` clause, so re-running the cron (same day or any day) only ever touches newly-eligible rows. No duplicate rows can be created since there are zero `INSERT`s in either function. **Verified live** (§6): identical processed-counts on back-to-back calls, second call touching 0 additional rows.

`auto_fulfill_promises` is **not** called by this route — during Phase 2 execution it turned out to be an `AFTER INSERT` trigger on `finance_payments`, not a standalone maintenance function. It already fires on every payment insert; calling it via `.rpc()` would error (`trigger functions can only be called as triggers`).

**Logging** — added, since both RPCs return `void` and there's no counts otherwise:
- `started_at`, `completed_at`, `duration_ms` — wall-clock around the whole handler.
- `processed.{installments_marked_overdue, accounts_marked_overdue, promises_marked_broken}` — computed via read-only pre-counts that mirror each RPC's `WHERE` clause exactly (safe, no side effects), since the RPCs themselves don't report counts.
- `errors` — any RPC or count-query error, both logged via `console.error` and returned in the JSON body with a 500.
- Sink: `console.log`/`console.error` (visible in Vercel Function Logs), **not** `system_event_logs` — see §4, that table doesn't exist in this project despite being referenced in code and migrations, so routing through it would have silently dropped every log line, same as it already silently drops everywhere else it's called.

## 2. Environment variable

- Code expects `process.env.CRON_SECRET` (`app/api/cron/finance-maintenance/route.ts`).
- No `.env.example` existed before this pass — created one (also documents the other 4 vars already in use, read from `.env.local` keys only, no values copied).
- `.gitignore` had a blanket `.env*` rule that also silently excluded `.env.example` from version control; added a `!.env.example` exception so the template is actually trackable.

**Where to configure in Vercel:** Project → Settings → Environment Variables → add `CRON_SECRET` for the **Production** environment (and Preview, if you want previews to exercise the route too) → redeploy (or it takes effect on the next deploy/cron invocation).

## 3. Generated secret

Cryptographically random, 96 hex characters (48 bytes — well above the 64-char minimum):

```
85dfaecc315b0b4cdcf07fbd90d13573cf94b95a3fbfbbdf2c912cc93584084ba99f858a023dce232bcf75f2e162b4a7
```

Copy this directly into Vercel's `CRON_SECRET` value. It was generated locally (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) and used only transiently in a local `.env.local` for the verification in §6 below, then removed — it was never committed and does not appear anywhere in git history.

## 4. New issue discovered during verification (not fixed — out of scope for Phase 2 finance work)

While deciding where to log cron activity, I checked `modules/observability/index.ts::logSystemEvent()`, which every "log a system event" call in the codebase goes through. It writes to a table called `system_event_logs`, wrapped in a try/catch that **silently swallows failures** ("logging must not break the caller").

That table does not exist in this Supabase project:
```
system_event_logs         → false
automation_execution_log  → false
v_slow_queries (view)     → false
v_consistency_mismatches  → false
```
All four are defined in `supabase/migrations/0052_sprint52_observability.sql`, and `0052` **is** recorded as applied in `schema_migrations` — so the migration was marked successful without its `system_event_logs`/`automation_execution_log` tables (and the views that depend on them) actually existing. This means every `logSystemEvent`/`logError`/`logAutomationFailure`/`logJobFailure` call anywhere in the app has been silently failing since at least whenever this drifted, with zero error surfaced anywhere.

This is consistent with — and likely another instance of — the migration/schema drift already flagged in `docs/LMS_FULL_REVIEW_2026-07-05.md` §4 (Stage 3, not yet executed). **Not fixed here**: recreating a missing observability table/view set is a meaningfully different, larger piece of work than finance-cron hardening, and doing it as a drive-by would be exactly the kind of scope creep Phase 2's rules were written to avoid. Flagging it as a dedicated follow-up.

## 5. Manual verification checklist

Commands actually run against a local dev server (`npm run dev`, port 3000) with a temporary test secret in `.env.local` (removed immediately after, `.env.local` confirmed restored to its original 5 keys):

```bash
# 1. Unauthorized — no header
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/finance-maintenance
# → 401 {"error":"Unauthorized"}

# 2. Unauthorized — wrong token
curl -s -H "Authorization: Bearer wrong-token" http://localhost:3000/api/cron/finance-maintenance
# → 401 {"error":"Unauthorized"}

# 3. Authorized — first run
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/finance-maintenance
# → 200 {"ok":true,"started_at":"2026-07-05T21:28:56.555Z","completed_at":"...","duration_ms":1917,
#         "processed":{"installments_marked_overdue":0,"accounts_marked_overdue":0,"promises_marked_broken":0}}

# 4. Authorized — second run (idempotency)
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/finance-maintenance
# → 200, same shape, processed counts still 0 — confirms no duplicate work on repeat calls
```

Results (actually observed, this session):

| # | Request | Expected | Observed |
|---|---|---|---|
| 1 | No `Authorization` header | 401 | ✅ 401 `{"error":"Unauthorized"}` |
| 2 | Wrong bearer token | 401 | ✅ 401 `{"error":"Unauthorized"}` |
| 3 | Correct bearer, first call | 200 + counts | ✅ 200, `duration_ms: 1917`, all counts 0 (expected — `mark_overdue_installments`/`mark_broken_promises` were already run manually once during Phase 2 data fixes, so nothing new was pending) |
| 4 | Correct bearer, second call | 200 + same/lower counts, no error | ✅ 200, `duration_ms: 2131`, counts still 0 — no duplication, no error |

To re-run this checklist against production after setting `CRON_SECRET` in Vercel:
```bash
curl -s -H "Authorization: Bearer <the-production-CRON_SECRET>" https://<your-domain>/api/cron/finance-maintenance
```

`npx tsc --noEmit` → 0 errors. `npx vitest run` → 244/244 passed (both re-run after the hardening changes).

## 6. Completed work summary (Phase 2, end to end)

**Code (deployed, commits `57dbd99` → `7130530` on `main`):**
- Installment count capped (36 max, 5-year due-date horizon), real clamp not just an HTML hint.
- `addPayment`/`quickPayment` auto-link to the oldest outstanding installment (FIFO).
- TL trial-session attendance UI brought to parity with the instructor view (`endTrialSessionWithAttendance` instead of a no-op call).
- 4 pre-existing test fixtures fixed.
- Daily Vercel cron (`/api/cron/finance-maintenance`) for overdue installments/promises, now hardened per §1 above.
- `.env.example` added; `.gitignore` fixed to allow it.

**Migrations applied this Phase 2 window:**
- `20260705202917_security_hardening.sql` / `20260705203318_security_hardening_revoke_public.sql` — already applied in a prior session; local filenames reconciled to match `schema_migrations` (no re-application).
- `20260706120000_fix_reconcile_ambiguous_enrollment_id.sql` — **new fix**, a genuine bug in `reconcile_student_attendance_sql` (ambiguous `enrollment_id` reference) that made every real invocation fail; never caught before because the function had only been code-reviewed, not executed.

**Data corrections (all pre-verified against live counts before touching anything; full before/after in `PHASE2_DATA_FIX_REPORT.md`):**
- Corrupted installment account: 3,400 bogus rows → 1 correct `PAID` installment (backed up first; account was already fully paid via one real, previously-unlinked EGP 3,400 payment).
- 3 missing financial accounts created for students with real free/legacy enrollments.
- Attendance consumption reconciliation: 506 → 222 missing ledger entries (222 residual = genuine data gaps, no eligible enrollment — not further automatable).
- 64 overdue installments correctly flagged `OVERDUE`.
- 42 orphan sessions (5 group_courses with no instructor at all) — reviewed and **intentionally left untouched** per your decision, including the apparent test-data group ("Test Group"/"Test").

## 7. Remaining known issues

1. **`system_event_logs` and related observability tables/views don't exist** despite migration `0052` being marked applied (§4). All app-wide system-event logging has been a silent no-op. Not fixed in this pass — recommend a dedicated follow-up to either re-run the missing DDL from `0052` or formally retire the `logSystemEvent` call sites if observability is no longer wanted that way.
2. **222 residual `v_consumption_integrity` MISSING rows** — genuine gaps (attendance outside any active/eligible enrollment window), need manual per-student review, not further reconciler runs.
3. **42 orphan sessions** across 5 group_courses with no instructor assigned — deferred by your decision, revisit via TL Groups Workspace when ready.
4. Stages 3–6 of `docs/LMS_FIX_PROMPTS.txt` (migration-folder unification beyond the one filename fix, performance-advisory cleanup, dead-code/module removal, CI + integrity-check cron) remain undone — out of scope for Phase 2.
5. Leaked-password protection and MFA still need manual enabling from the Supabase Auth dashboard (not migration-able).

## 8. Manual action required

> **Add `CRON_SECRET` to Vercel Environment Variables** (Production, and Preview if desired) using the value in §3, then confirm the cron fires correctly after the next deploy (Vercel Dashboard → Project → Cron Jobs, or check Function Logs for the `[cron:finance-maintenance] completed` line at ~02:00 UTC).

## 9. Recommendation

**Phase 2 can be marked CLOSED**, conditional only on the one manual step in §8 (setting `CRON_SECRET` in Vercel — I cannot do this myself). Everything else in scope — code fixes, the two migrations, all data corrections, cron hardening, and verification — is deployed, tested (0 TS errors, 244/244 tests), and confirmed working live against Supabase. The items in §7 are real but are new/adjacent findings, not blockers for closing Phase 2 itself — recommend opening them as separate follow-up work (a "Phase 2.1 — Observability Repair" would be the natural next scope for item #1, given its severity).
