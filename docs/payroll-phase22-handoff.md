# Payroll System — Phase XXII Handoff

**Date:** 2026-06-20  
**Status:** Phase XXII complete, 0 TypeScript errors  
**Next chat should continue from:** Any remaining QA, or new features

---

## What Was Built (Phase XX + XXII)

The payroll system is a **live, run-free finance module** — no batch runs, no snapshots.  
Every figure is computed in real-time from DB state.

### Architecture

| Concept | Source |
|---|---|
| Instructor earnings | `schedules WHERE status='completed'` in date range |
| Instructor rate | 3-level hierarchy: session override → group rate → instructor default |
| Staff activities | `staff_sessions` table (manual entries: rate × qty = amount) |
| Adjustments | `finance_adjustments` table (bonus/penalty/advance/purchase/reimbursement/other) |
| Staff net | `basic_salary + session_earnings + adj_net` (always, no payroll_type gate) |

---

## Files Changed

| File | What changed |
|---|---|
| `modules/staff-finance/types.ts` | computeStaffNetAmount fixed, STAFF_PAYMENT_METHOD_LABELS, STAFF_ACTIVITY_OPTIONS, expanded activity types |
| `modules/staff-finance/queries.ts` | getStaffFinanceSummary: removed payroll_type filter on totals |
| `modules/staff-finance/actions.ts` | Staff session CRUD, updateStaffNotes, updateStaffPaymentInfo |
| `app/portal/team-leader/payroll/FinanceClient.tsx` | Full rebuild — see below |
| `supabase/migrations/0113_staff_sessions.sql` | staff_sessions table + department column on staff_payroll_profiles |

---

## FinanceClient.tsx — Key Components

### 3 Tabs
- **Instructors** — date presets + range picker filter
- **Staff** — Month/Year picker filter (auto-navigates on change)
- **Summary** — Month/Year picker filter, aggregate totals

### Staff Tab columns
`Employee | Role | Salary | Activities | Adjustments | Net | Actions`

Actions per row: **View** (→ StaffDetailModal) · **+ Act** (Quick Add Activity) · **+ Adj** · **Edit**

### StaffDetailModal — 6 tabs
| Tab | What it does |
|---|---|
| Overview | KPI grid (Role/Dept/Type/Branch/Salary/Rate/Activities/Net) + Earnings breakdown |
| Activities | Add/Edit/Delete staff_sessions; uses STAFF_ACTIVITY_OPTIONS dropdown (14 types) |
| Adjustments | Add/Delete finance_adjustments inline |
| Payments | Edit basic_salary + activity_rate + payment_method (7 options) + reference |
| History | Monthly breakdown from loaded sessions + adjustments |
| Notes | Freeform text on staff_payroll_profiles.notes |

### Quick Add Activity Modal
Opens from **+ Act** button on each row. Fields: Date / Activity Type / Description / Rate / Qty → saves to `staff_sessions`.

### Add Staff Modal (UUID bug fixed)
- `sfBranch` state initialized from current branch filter or `branches[0]`
- Shows Branch selector when multi-branch
- Always shows both Basic Salary + Activity Rate (not conditional on payroll_type)
- Uses `STAFF_PAYMENT_METHOD_LABELS` (7 methods)

---

## Database Tables

### `staff_payroll_profiles`
```
id, user_id, branch_id, role, department (NEW), payroll_type,
basic_salary, session_rate, payment_method, payment_reference,
is_payroll_enabled, notes
```
`payroll_type` is now a **label only** — does not restrict which components are included in net.

### `staff_sessions` (migration 0113)
```
id, staff_profile_id, branch_id, session_date, activity_type (TEXT),
description, rate, quantity, notes, created_by, created_at, updated_at
```
- `activity_type` has **no DB CHECK constraint** — new values can be added freely
- `amount = rate × quantity` (computed in application, not DB)

### `finance_adjustments`
```
id, branch_id, instructor_id (nullable), staff_profile_id (nullable),
type (bonus|penalty|advance|purchase|reimbursement|other),
amount, adjustment_date, notes, created_by
```

### `payroll_session_overrides`
```
id, schedule_id, instructor_id, override_rate, reason, notes
UNIQUE(schedule_id, instructor_id)
```

---

## Constants (types.ts)

```typescript
STAFF_PAYMENT_METHOD_LABELS = {
  instapay, vodafone_cash, wallet, bank_transfer, cash, cheque, other
}

STAFF_ACTIVITY_OPTIONS = [
  teaching_session, workshop, camp_day, open_day, training,
  event, meeting, outsource_session, bonus_activity, extra_session,
  admin_event, technical_support, custom, other
]

// computeStaffNetAmount — ALWAYS = basic_salary + session_earnings + adj_net
// payroll_type is classification label only, NOT a calculation gate
```

---

## Server Actions (actions.ts)

| Action | Purpose |
|---|---|
| `upsertStaffProfileAction` | Create/update staff_payroll_profiles (onConflict user_id,branch_id) |
| `addStaffSessionAction` | Insert staff_sessions row |
| `updateStaffSessionAction` | Update staff_sessions row |
| `deleteStaffSessionAction` | Delete staff_sessions row |
| `getStaffSessionsAction` | Load sessions for a profile in date range |
| `updateStaffPaymentInfoAction` | Update basic_salary, session_rate, payment_method, payment_reference |
| `updateStaffNotesAction` | Update staff_payroll_profiles.notes |
| `toggleStaffEnabledAction` | Toggle is_payroll_enabled |
| `deleteStaffProfileAction` | Soft-delete staff profile |
| `addFinanceAdjustmentAction` | Add bonus/penalty/etc |
| `deleteFinanceAdjustmentAction` | Delete adjustment |
| `upsertSessionRateOverrideAction` | Per-session rate override for instructors |
| `removeSessionRateOverrideAction` | Remove session rate override |
| `updateInstructorPaymentInfoAction` | Update instructor salary_per_session + payment info |

---

## Known Good State

- `npx tsc --noEmit` → 0 errors
- Migration 0113 applied to remote DB
- All staff CRUD tested end-to-end
- UUID bug (branch_id "all") fixed

---

## What Could Come Next

- Export staff payroll to CSV/PDF
- Bulk mark sessions as paid
- Staff payroll approval workflow
- WhatsApp payment notification per staff
- Staff payroll history across months (cross-month view)
- Staff payroll dashboard widget on TL home
