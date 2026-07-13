# Phase 0 Completion Report — Group / Cohort Academic Lifecycle

**Date:** 2026-07-13
**Scope:** Additive foundation schema + domain documentation + TypeScript enum consolidation.
**Status:** ✅ Complete. No business behavior changed. Ready for Phase 1 planning (not started).

---

## 1. Summary

Phase 0 laid the foundation for the multi-semester Group/Cohort lifecycle feature
(see `docs/DOMAIN_RULES.md` for the full business-invariant model). It added:

- One new table (`group_series`) and two new nullable columns on `groups`
  (`series_id`, `archived_at`).
- Two new nullable snapshot columns on `certificates` (`course_title_snapshot`,
  `semester_name_snapshot`).
- A follow-up migration hardening the new `group_series` RLS policies to match the
  platform's established performance/security pattern.
- The authoritative domain-rules document (`docs/DOMAIN_RULES.md`).
- Consolidation of `GroupStatus`/`GROUP_STATUSES` from 4 independent declarations
  down to 1 canonical source in `types/enums.ts`, fixing stale TS-layer drift
  against the DB's `groups_status_check` constraint (which already allowed
  `handoff_pending`/`archived` since migration `0086`, unbeknownst to the TS layer).

No workflow, trigger, backfill, or UI behavior was added. Nothing writes to any of
the new columns yet. No group has ever been linked to a series. This is purely
additive infrastructure, exactly as scoped.

---

## 2. Database changes

### Migration 1 — `20260713124359_cohort_lifecycle_foundation.sql`
- New table `group_series` (branch_id, name, day_of_week, time, default_capacity,
  default_room, default_course_id, created_at, updated_at) with RLS enabled.
- `groups.series_id` — nullable FK → `group_series(id)`, `ON DELETE SET NULL`.
- `groups.archived_at` — nullable `timestamptz`, no default.

### Migration 2 — `20260713124408_certificate_history_snapshot_columns.sql`
- `certificates.course_title_snapshot` — nullable `text`.
- `certificates.semester_name_snapshot` — nullable `text`.
- No backfill. No change to `modules/certificates/queries.ts` — certificate
  display still live-joins `courses.title` / `semesters.name` exactly as before.

### Migration 3 — `20260713124637_group_series_performance_hardening.sql`
- Fixed `get_advisors` findings on the migration-1 RLS policies: wrapped
  `auth.uid()` calls, merged overlapping permissive SELECT policies, added the
  missing FK index on `default_course_id` — matching the exact pattern already
  established platform-wide (`20260706061514_phase4_merge_permissive_policies_batch1.sql`).

### Verification performed (2026-07-13, this session)

| Check | Result |
|---|---|
| `list_migrations` | All 3 versions present and registered: `20260713124359`, `20260713124408`, `20260713124637` |
| `group_series` columns | 10 columns, types/nullability match design exactly |
| `groups.series_id` / `archived_at` | Present, both nullable, correct types |
| `certificates` snapshot columns | Present, both nullable `text` |
| FK constraints | `groups_series_id_fkey` (SET NULL), `group_series_branch_id_fkey` (CASCADE), `group_series_default_course_id_fkey` (SET NULL), `group_series_day_of_week_check` |
| Indexes | `idx_groups_series_id` (partial), `group_series_pkey`, `idx_group_series_branch_id`, `idx_group_series_default_course_id` (partial) — all present |
| RLS enabled | `relrowsecurity = true` on `group_series` |
| RLS policies | 4 policies (select/insert/update/delete), all correctly use the wrapped `(SELECT auth.uid())` pattern, no raw `auth.uid()` |
| `groups_status_check` | Unchanged: `forming, active, handoff_pending, completed, cancelled, archived` — confirms no drift introduced |
| Security advisor | Zero findings tied to `group_series` or the new certificate columns. All findings present are pre-existing (backup tables, unrelated legacy tables, auth/MFA settings) |
| Performance advisor | Only 2 findings for `group_series`, both benign "index not used yet" (expected — brand-new, empty table). No RLS auth-wrap or multiple-permissive-policy findings |

---

## 3. Files changed

### Phase 0 — intentional (to be committed)

| File | Change |
|---|---|
| `supabase/migrations/20260713124359_cohort_lifecycle_foundation.sql` | New |
| `supabase/migrations/20260713124408_certificate_history_snapshot_columns.sql` | New |
| `supabase/migrations/20260713124637_group_series_performance_hardening.sql` | New |
| `docs/DOMAIN_RULES.md` | New |
| `types/enums.ts` | `GroupStatus`/`GROUP_STATUSES` made canonical (6 values, matching DB) |
| `modules/groups/actions/validators.ts` | Local `GROUP_STATUSES` removed, imports canonical one |
| `modules/groups/schemas.ts` | `updateGroupSchema.status` now uses canonical `GROUP_STATUSES` |
| `modules/shared/schemas/index.ts` | `GroupStatusSchema` now derives from canonical import |

### Unrelated — pre-existing, untouched, NOT part of this commit

These were already modified in the working tree before this work began (visible at
session start) and are unrelated feature work in flight elsewhere:

- `app/portal/team-leader/groups/StudentQuickViewModal.tsx`
- `app/portal/team-leader/groups/workspace/GroupWorkspace.tsx`
- `app/portal/team-leader/students/StudentDetailDrawer.tsx`
- `modules/groups/actions/student-quick-view.ts`
- `modules/groups/modal-actions.ts`

Left alone per scope. Not committed as part of Phase 0.

---

## 4. Validation results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `npx eslint .` | ✅ 0 errors, 2,215 warnings (all pre-existing, all in test files — `no-explicit-any`/`no-unused-vars`; none in Phase 0 files) |
| `npm run build` (`next build`) | ✅ Compiled successfully, 0 errors, 0 warnings |
| `npx vitest run` | ⚠️ 16 failed test files / 5 failed tests, out of 48 files / 166 tests — **pre-existing, proven unrelated (see §5)** |

---

## 5. Vitest investigation — proof, not guess

**Claim:** the `Failed to resolve import "server-only"` failures are pre-existing
and unrelated to Phase 0.

**Method:** three-way isolation test, running `npx vitest run` against three
different working-tree states in sequence, on the same machine, same install:

1. **Current tree** (Phase 0 files + pre-existing unrelated files, as it stood at
   session start): **16 failed / 32 passed test files, 5 failed / 161 passed tests.**
2. **Phase 0's 4 TS files stashed** (`types/enums.ts`,
   `modules/groups/actions/validators.ts`, `modules/groups/schemas.ts`,
   `modules/shared/schemas/index.ts`), pre-existing unrelated files still present:
   **identical — 16 failed / 32 passed, 5 failed / 161 passed.**
3. **Fully clean `HEAD`** (all tracked changes stashed, only the untracked
   migrations/docs remain, which touch no TypeScript import graph at all):
   **identical again — 16 failed / 32 passed, 5 failed / 161 passed.**

All three runs produce byte-identical failure counts and the same failing files
(`modules/staff-finance/queries.ts`, `modules/rbac/guards.ts`,
`modules/instructor-portal/queries.ts`, `modules/notifications/queries.ts`, etc.).
**Conclusion: the failures are 100% pre-existing and unrelated to any change in
this working tree, Phase 0 or otherwise.** All stashes were popped and the working
tree was restored to its exact original state before proceeding.

**Root cause identified** (not left as a mystery): the `server-only` package is
`import`ed directly in 83 files across the codebase (a standard Next.js
server-boundary guard), but:
- It is **not declared** in this project's `package.json` (`dependencies` or
  `devDependencies`).
- It is **absent from `package-lock.json`**.
- It is **absent from `node_modules`** entirely (`npm ls server-only` returns empty).
- It only appears inside `next`'s own internal `devDependencies` (used to build
  Next.js itself, not exposed to consuming projects).

Next.js's own bundler (webpack/Turbopack, used by `next dev` / `next build`) has a
built-in special-case alias for the bare `server-only` specifier, which is why
`npm run build` succeeds without the package installed. Vitest/Vite has no such
alias and resolves imports from `node_modules` directly, so it fails. Because CI
(`.github/workflows/ci.yml`) runs `npx vitest run` against the same `npm ci`
install, **this would fail identically in CI today, independent of this branch.**
Last touch on any of the 16 affected test files predates this session
(`2eab327`, 2026-07-02), confirming this is a standing gap, not a regression
introduced now.

**This is out of scope for Phase 0 to fix** (Phase 0 is additive-schema-only) but
is flagged below as a known, pre-existing, unrelated issue that blocks a fully
green `vitest run` — and will also block CI's `Unit tests` step whenever it next
runs, regardless of what branch triggers it.

---

## 6. No existing functionality changed — confirmation

Reviewed explicitly, as requested:

- **Groups** — `modules/groups/schemas.ts` / `validators.ts` widen the app-layer
  `status` Zod enum from 4 to 6 values, but only to match values the DB
  `groups_status_check` constraint has permitted since migration `0086`. The one
  UI surface that submits a `status` field through this schema
  (`app/admin/groups/[id]/GroupDetailView.tsx`) uses its own locally-restricted
  3-option `<select>` (`forming`/`completed`/`cancelled`) that Phase 0 deliberately
  left untouched — so no request the app can actually generate today changes
  outcome. Zero observable behavior change.
- **Enrollments** — `modules/enrollments/` — zero diff.
- **Attendance** — `modules/attendance/` — zero diff.
- **Finance** — `modules/finance/` — zero diff.
- **Certificates** — `modules/certificates/` — zero diff. New snapshot columns
  exist but are not read, written, or backfilled anywhere yet; `getCertificatesList`
  / `getCertificateDetail` / `verifyCertificate` are unchanged and still live-join
  as before.
- **Search** — `modules/search/` — zero diff.
- **RBAC** — `modules/rbac/` — zero diff. New `group_series` RLS policies reuse the
  existing `user_has_permission()` function already used everywhere else; no new
  permission type introduced.

`git diff --stat` against each of these six module directories returns no output —
confirmed empty, not just eyeballed.

---

## 7. Risks

- **Widened `GROUP_STATUSES` enum** is a latent capability increase: any future
  Server Action reusing `updateGroupSchema` without its own restricted `<select>`
  would now be able to accept `handoff_pending`/`archived` writes where it
  couldn't before. Not exploitable today (no such caller exists), but worth a
  reviewer's eye whenever a new group-editing surface is built.
- **`group_series` is currently 100% dead weight** — no row will ever exist in it
  until a later phase writes to it. This is intentional (Phase 0 = schema only)
  but means the "unused index" performance-advisor noise on it is expected and
  will persist until Phase 2 ("Create Next Cohort") starts populating it.
- **Certificate snapshot columns are unpopulated** — until a later phase adds
  write-on-issue logic, they carry no data. Not a regression (nothing reads them
  yet either), but a reminder that Rule 6 in `DOMAIN_RULES.md` is only half-closed.

---

## 8. Known unrelated issues (not fixed, not in scope)

1. **`server-only` package missing from `package.json`/`node_modules`** — causes
   16/48 vitest test files to fail with import-resolution errors. Pre-existing
   (proven in §5), will also fail in CI the same way. Fixing this (either adding
   `server-only` as a real dependency, or aliasing it to an empty module in
   `vitest.config.ts`) is a one-line, low-risk fix but is explicitly **not** a
   Phase 0 concern and was left untouched per the user's instruction not to fix
   unrelated issues in this pass.
2. **Five pre-existing uncommitted files** unrelated to this feature
   (`StudentQuickViewModal.tsx`, `GroupWorkspace.tsx`, `StudentDetailDrawer.tsx`,
   `student-quick-view.ts`, `modal-actions.ts`) remain in the working tree,
   untouched, not committed as part of this work.
3. **Priority 0** (duplicate-active-membership fix) and **Phase 1** (Archived-stage
   read-only trigger) are the next planned steps per
   `docs/DOMAIN_RULES.md` Rule 13 and the architecture record — **not started,**
   per explicit instruction to stop after Phase 0.

---

## 9. Confirmation

Phase 0 introduced **no behavioral changes** to any existing feature. It is
infrastructure only: one new empty table, four new nullable columns, one type
consolidation that only widens validation to match an already-permissive DB
constraint (with zero reachable new code path), and one documentation file. All
verification (tsc, eslint, build) is green. The one non-green check (vitest) is
proven — not assumed — to be a pre-existing, unrelated environment gap.

**Phase 0 is complete. Awaiting explicit go-ahead before starting Priority 0 /
Phase 1.**
