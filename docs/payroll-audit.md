# Payroll System Audit — Phase 20

**Date:** 2026-06-18  
**Auditor:** Claude (automated audit before Phase 20 redesign)

---

## 1. Existing Tables

### `payroll_runs`
**Migration:** `0106_instructor_payroll_system.sql`  
**Purpose:** One row per branch per calendar month. Represents a payroll generation event.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| branch_id | UUID FK → branches | NOT NULL, RESTRICT |
| month | SMALLINT | 1–12 |
| year | SMALLINT | ≥ 2020 |
| status | TEXT | draft / approved / paid / archived |
| total_amount | NUMERIC(12,2) | Sum of all final_amounts |
| notes | TEXT | nullable |
| generated_at | TIMESTAMPTZ | auto |
| generated_by | UUID FK → auth.users | nullable |
| approved_at | TIMESTAMPTZ | set on approve |
| approved_by | UUID FK → auth.users | nullable |
| paid_at | TIMESTAMPTZ | set on mark paid |
| paid_by | UUID FK → auth.users | nullable |
| created_at / updated_at | TIMESTAMPTZ | auto |
| **UNIQUE** | (branch_id, month, year) | one run per period |

**Classification: EXTEND** — Add `finalized` status; otherwise keep as-is.

---

### `payroll_items`
**Migration:** `0106_instructor_payroll_system.sql`  
**Purpose:** One salary record per instructor per run.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| payroll_run_id | UUID FK → payroll_runs | CASCADE delete |
| instructor_id | UUID FK → instructors | NOT NULL — **PROBLEM** |
| sessions_count | INT | completed sessions |
| rate_per_session | NUMERIC(10,2) | snapshot at generation |
| gross_amount | NUMERIC(12,2) | sessions × rate |
| adjustments_total | NUMERIC(12,2) | sum of all adjustments |
| final_amount | NUMERIC(12,2) | gross + adjustments |
| currency | TEXT | EGP default |
| status | TEXT | draft / approved / paid |
| approved_at / paid_at | TIMESTAMPTZ | |
| notes | TEXT | |
| **UNIQUE** | (payroll_run_id, instructor_id) | one item per instructor |

**Problems:**
- `instructor_id NOT NULL` — prevents non-instructor staff payroll
- Missing `basic_salary` field for fixed/mixed staff
- Missing `payroll_type` snapshot (unclear how item was computed)
- Missing `staff_profile_id` link for new unified system

**Classification: EXTEND** — Make instructor_id nullable, add staff_profile_id, basic_salary, payroll_type.

---

### `payroll_adjustments`
**Migration:** `0106_instructor_payroll_system.sql`  
**Purpose:** Bonuses, penalties, and other manual adjustments per item.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| payroll_item_id | UUID FK → payroll_items | CASCADE delete |
| instructor_id | UUID FK → instructors | NOT NULL — **PROBLEM** |
| type | TEXT | bonus/penalty/transport/allowance/deduction/other |
| amount | NUMERIC(10,2) | positive or negative |
| notes | TEXT | |
| created_by | UUID FK → auth.users | |
| created_at / updated_at | TIMESTAMPTZ | |

**Problems:**
- `instructor_id NOT NULL` — prevents non-instructor adjustments
- Missing adjustment types: advance, purchase, equipment, reimbursement
- No `staff_profile_id` link

**Classification: EXTEND** — Make instructor_id nullable, add staff_profile_id, extend type check.

---

### `payroll_session_snapshots`
**Migration:** `0106_instructor_payroll_system.sql`  
**Purpose:** Immutable point-in-time evidence of which sessions contributed to each item.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| payroll_item_id | UUID FK → payroll_items | CASCADE delete |
| schedule_id | UUID FK → schedules | RESTRICT |
| session_number | INT | |
| group_id | UUID FK → groups | RESTRICT |
| group_name | TEXT | snapshot |
| topic | TEXT | snapshot |
| session_date | DATE | |
| session_value | NUMERIC(10,2) | rate at time of generation |
| created_at | TIMESTAMPTZ | immutable |

**Classification: KEEP** — No changes needed. Snapshots are immutable evidence.

---

### Instructor Payroll Fields (on `instructors` table)
**Added in:** `0062_instructor_ops.sql` and `0106_instructor_payroll_system.sql`

| Column | Source | Notes |
|--------|--------|-------|
| salary_per_session | 0062 | NUMERIC(10,2) — rate per completed session |
| currency | 0062 | TEXT default 'EGP' |
| instapay_number | 0062 | TEXT — payment reference |
| payment_notes | 0062 | TEXT |
| payroll_type | 0106 | per_session / fixed_monthly / hybrid |
| payroll_effective_from | 0106 | DATE |

**Problems:**
- Payment info (`instapay_number`) is Instapay-only — no support for other methods
- `payroll_type` column exists but only `per_session` is implemented
- No `basic_salary` field for fixed/mixed types
- Non-instructor staff have no payroll configuration at all

**Classification: KEEP** — Preserve for backwards compatibility. New data goes in `staff_payroll_profiles`.

---

## 2. Missing Table

### `staff_payroll_profiles` (MISSING — MUST CREATE)
**Purpose:** Unified payroll configuration for all staff types.

This table is the core of the Phase 20 redesign. It stores payroll configuration for:
- Instructors (linked from existing instructor records)
- Team Leaders, Coordinators, Branch Managers
- Admin, Sales, Marketing, Operations, Finance staff

---

## 3. Existing Logic

### Payroll Generation Flow (`generateMonthlyPayrollAction`)

```
1. Duplicate guard (one run per branch/month/year)
2. Load active instructors in branch via instructor_branches
3. Fetch instructor metadata (name, salary_per_session, currency)
4. Load branch groups (ids + names)
5. Load group_instructors allocations for active instructors
6. Load group_courses (active + completed) for branch groups
7. Load completed schedules in target month
8. Aggregate per instructor (session deduplication via seen-set)
9. Generate warnings (missing/zero rates)
10. Create payroll_run (status=draft)
11. Create payroll_items + payroll_session_snapshots
12. Update run total_amount
13. Audit log
```

**Problems:**
- Only processes instructors (instructor_branches + group_instructors)
- Does not support fixed_salary or mixed payroll types (despite type column existing)
- Session deduplication is per-run, not cross-instructor

### Approval Flow
- `approvePayrollRunAction`: draft → approved, cascades to all draft items
- `approvePayrollItemAction`: draft → approved (individual item)
- `markPayrollPaidAction`: approved → paid, immutable after
- `archivePayrollRunAction`: draft/approved → archived (cannot archive paid)

**Problem:** No `finalized` status for permanent lock-down by super admin.

### Adjustment Flow
- `addPayrollAdjustmentAction`: inserts adjustment, recalculates item + run totals
- `deletePayrollAdjustmentAction`: deletes adjustment, recalculates
- Sign handling: penalty/deduction → forced negative; bonus/allowance/transport → positive

**Problem:** Types missing: advance, purchase, equipment, reimbursement.

---

## 4. Existing Problems

### Architecture Issues
1. `payroll_items.instructor_id` is NOT NULL — **blocks unified staff payroll**
2. `payroll_adjustments.instructor_id` is NOT NULL — blocks non-instructor adjustments
3. No `staff_payroll_profiles` table — no payroll config for non-instructors
4. Generation only reads `instructor_branches` — ignores all other staff

### Missing Features
1. Fixed salary payroll (basic_salary per month, no session counting)
2. Mixed payroll (basic_salary + session pay)
3. Staff directory (view/edit all staff payroll config)
4. FINALIZED status (permanent lock after payment)
5. Payment method support beyond Instapay (vodafone_cash, bank_transfer, cash)
6. Adjustment types: advance, purchase, equipment, reimbursement

### Duplicate Logic
- `adjustments_total` recalculated in both `addPayrollAdjustmentAction` and `deletePayrollAdjustmentAction` — identical code blocks
- `instructorName()` helper defined in both `actions.ts` and `queries.ts`

### UI Problems
- Page title says "Instructor Payroll" — not inclusive of all staff
- KPI strip doesn't break down by payroll type
- No staff directory tab
- No way to configure payroll for non-instructor users
- Mobile cards don't show payroll type

### Permission Problems
- `manage_payroll` not in `CONFIGURABLE_PERMISSIONS` — cannot customize per-user
- No `finalize_payroll` permission for super-admin-only finalization

### Scalability Issues
- `instructor_id` FK hard-coded — requires schema change to support more roles
- No batch adjustment support

### Data Integrity Risks
- No CHECK constraint ensuring `instructor_id OR staff_profile_id IS NOT NULL` after migration
- `payroll_runs` status allows going from `paid` to `archived` would lose audit trail (currently blocked in code only, not DB)

---

## 5. Component Classification

| Component | Classification | Reason |
|-----------|---------------|--------|
| `payroll_runs` table | EXTEND | Add `finalized` status |
| `payroll_items` table | EXTEND | Nullable instructor_id, add staff_profile_id, basic_salary, payroll_type |
| `payroll_adjustments` table | EXTEND | Nullable instructor_id, add staff_profile_id, more types |
| `payroll_session_snapshots` table | KEEP | Immutable evidence, no changes needed |
| `instructors.payroll_*` fields | KEEP | Backwards compat, data migrated to staff_payroll_profiles |
| `staff_payroll_profiles` | CREATE | New canonical payroll config table |
| `generateMonthlyPayrollAction` | DEPRECATE | Replace with `generateUnifiedPayrollAction` |
| `approvePayrollRunAction` | KEEP | No changes needed |
| `markPayrollPaidAction` | KEEP | No changes needed |
| `archivePayrollRunAction` | KEEP | No changes needed |
| `addPayrollAdjustmentAction` | EXTEND | Support staff_profile_id |
| `deletePayrollAdjustmentAction` | EXTEND | Support staff_profile_id |
| `getPayrollRunWithItems` | EXTEND | Join staff profiles alongside instructors |
| `getPayrollItemsForRun` | EXTEND | Resolve name from instructor OR staff profile |
| `getDashboardPayrollSummary` | KEEP | No changes needed |
| `PayrollWorkspaceClient.tsx` | DEPRECATE | Replace with new `PayrollClient.tsx` |
| `InstructorPayrollWidget.tsx` | EXTEND | Update link to new route |
| `/instructor-payroll/` route | REDIRECT | Point to new `/payroll/` route |

---

## 6. Migration Safety Plan

**DO NOT DROP any existing tables.**  
**DO NOT DELETE any existing payroll history.**

Safe migration sequence:
1. Create `staff_payroll_profiles` table (new, no conflict)
2. Backfill instructors → `staff_payroll_profiles` (safe INSERT ... ON CONFLICT DO NOTHING)
3. `ALTER TABLE payroll_items ALTER COLUMN instructor_id DROP NOT NULL` (safe, nulls not introduced for existing rows)
4. `ALTER TABLE payroll_items ADD COLUMN staff_profile_id` (safe, nullable)
5. Add partial unique index on `(payroll_run_id, staff_profile_id) WHERE staff_profile_id IS NOT NULL`
6. `ALTER TABLE payroll_adjustments ALTER COLUMN instructor_id DROP NOT NULL` (safe)
7. `ALTER TABLE payroll_adjustments ADD COLUMN staff_profile_id` (safe, nullable)
8. Drop + recreate type CHECK constraints on adjustments (extend values only, never remove)
9. Extend payroll_runs status CHECK (add 'finalized' only, never remove values)

All existing rows are unaffected — `instructor_id` remains set on old rows.
