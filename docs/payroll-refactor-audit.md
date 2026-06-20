# Payroll Refactor Audit — Phase 21

**Date:** 2026-06-19  
**Purpose:** Complete audit before rebuilding payroll as a live finance system.

---

## 1. What Exists

### Database Tables (from migrations 0106, 0107, 0109)

| Table | Description | Decision |
|---|---|---|
| `payroll_runs` | One per branch/month/year. ERP-style snapshot. | **KEEP in DB, REMOVE from UI** |
| `payroll_items` | One per instructor per run. Locked computation. | **KEEP in DB, REMOVE from UI** |
| `payroll_adjustments` | Adjustments linked to a payroll_item. | **KEEP in DB, REMOVE from UI** |
| `payroll_session_snapshots` | Immutable session evidence per item. | **KEEP in DB, REMOVE from UI** |
| `staff_payroll_profiles` | Payroll config per user per branch. | **KEEP and USE** |

### Instructor columns (from migrations 0062, 0106)

| Column | Usage |
|---|---|
| `salary_per_session` | Source of truth for session rate — KEEP, USE |
| `instapay_number` | Payment reference — KEEP, USE |
| `payment_notes` | Payment notes — KEEP, USE |
| `currency` | Currency — KEEP, USE |
| `payroll_type` | Legacy column — IGNORE for now |

### UI Pages

| File | Status |
|---|---|
| `app/portal/team-leader/payroll/page.tsx` | **REWRITE** |
| `app/portal/team-leader/payroll/PayrollClient.tsx` | **REPLACE** with FinanceClient.tsx |
| `app/portal/team-leader/payroll/staff/page.tsx` | **REDIRECT** to main page |
| `app/portal/team-leader/payroll/staff/StaffClient.tsx` | **DELETE** (logic merged) |
| `app/portal/team-leader/instructor-payroll/page.tsx` | Already redirects → keep |

### Module Files

| File | Status |
|---|---|
| `modules/payroll/types.ts` | KEEP — dashboard widget still uses some types |
| `modules/payroll/queries.ts` | KEEP — `getDashboardPayrollSummary` used by widget |
| `modules/payroll/actions.ts` | KEEP — old actions, no longer exposed in UI |
| `modules/payroll/staff-queries.ts` | KEEP — `getStaffPayrollProfiles` still useful |
| `modules/payroll/staff-actions.ts` | KEEP — `upsertStaffPayrollProfileAction` still useful |

---

## 2. What Was Wrong

### Architecture Problems

1. **Generation-first workflow** — User had to click "Generate Payroll" before seeing any data. Nothing was visible until a run was created. This is not how a small ops team works.

2. **Month/year selector** — Forced users to think in calendar months. Real need: "show me sessions from June 1 to today."

3. **ERP-style statuses** — draft → approved → paid → finalized. Too many steps for a school with 5-15 instructors.

4. **UUID paste for staff** — Add Staff modal required pasting an auth UUID. Completely unusable.

5. **Payroll runs blocking** — Couldn't view data for a month without generating a run. Couldn't see two instructors side-by-side unless they were in the same run.

6. **Snapshot model** — Sessions were locked at generation time. If a session was completed after generation, it wouldn't appear until "Regenerate." Live system never has this problem.

---

## 3. New Architecture

### Source of Truth

| Data | Source |
|---|---|
| Completed sessions | `schedules.status = 'completed'` + `scheduled_at` in date range |
| Instructor per session | `schedules.group_course_id` → `group_courses.instructor_id` |
| Session rate | `instructors.salary_per_session` |
| Session earnings | `sessions_count × salary_per_session` (computed live) |
| Staff salary | `staff_payroll_profiles.basic_salary` |
| Adjustments | **NEW** `finance_adjustments` table (standalone, date-filtered) |
| Payment info (instructor) | `instructors.instapay_number`, `instructors.payment_notes` |
| Payment info (staff) | `staff_payroll_profiles.payment_method`, `payment_reference` |

### New `finance_adjustments` Table

Standalone adjustment records — NOT linked to payroll_runs or payroll_items.

- `instructor_id` OR `staff_profile_id` (exactly one set)
- `type`: bonus, penalty, advance, purchase, reimbursement, other
- `amount`: always stored as positive; sign inferred from type
- `adjustment_date`: for date range filtering

### Tabs

| Tab | Content |
|---|---|
| **Instructors** | Live session earnings, date range filter, per-row adjustments |
| **Staff** | Fixed salary employees, date range filter, per-row adjustments |
| **Summary** | KPI totals, breakdown by branch |

---

## 4. What is NOT Changing

- All existing `payroll_*` tables remain in the database (no DROP)
- All existing `payroll_*` data remains untouched
- `getDashboardPayrollSummary()` and dashboard widget preserved
- `staff_payroll_profiles` remains the source for staff payroll config
- `manage_payroll` permission remains and is reused

---

## 5. Migration Strategy

Migration **0110** adds:
1. `finance_adjustments` table (new standalone adjustments)
2. `instructors.payment_method` column (TEXT, default 'cash')
3. Indexes on `finance_adjustments`
4. RLS: service_role bypass

No data is dropped or modified. All migrations are additive.
