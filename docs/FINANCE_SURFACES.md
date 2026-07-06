# Finance surfaces — who uses what, what's duplicated, and a recommendation

Written as part of the Phase 5 cleanup sprint. This is analysis only — no merge is
implemented here, per instructions. The decision on which surface is "official" per
domain is left to the user.

## Inventory

| Route | Backing component | Purpose | Notes |
|---|---|---|---|
| `admin/finance` | `FinanceTableClient.tsx` | Per-student collections table: search/filter accounts, open a student's finance detail drawer (payments, installments, notes, activities, promises) | Same domain as TL `finance`, but a different, admin-only implementation (own table/detail components) |
| `admin/finance-center` | `FinancialManagementClient.tsx` (1,729 lines) | Org-wide P&L: Group P&L, Branch P&L, Academy P&L, expense management (one-off + recurring) | Super-admin-oriented; `admin/revenue` and `admin/expenses` are **thin redirects into this page's tabs**, not separate surfaces |
| `admin/revenue` | redirect → `admin/finance-center` | — | Phase XXXV consolidation shim, intentionally kept for old links/bookmarks |
| `admin/expenses` | redirect → `admin/finance-center?...` (preserves query string) | — | Same as above |
| `admin/payroll` | **imports `app/portal/team-leader/payroll/FinanceClient.tsx` directly** | Instructor + staff payroll (both branches, `isSuperAdmin` prop) | Already properly de-duplicated — not a separate component, just a different data-scoping wrapper around the same client. Splitting `FinanceClient.tsx` (item 5) must keep this import path working |
| `portal/team-leader/finance` | `StudentOpsTable.tsx` / `StudentOpsDrawer.tsx` / `StudentOpsModal.tsx` / `EnrollmentWizard.tsx` | Per-student collections + enrollment wizard, TL-scoped | Same domain as `admin/finance`, independent implementation |
| `portal/team-leader/collections` | `CollectionsView.tsx` | Risk-sorted watchlist: due-today / overdue / milestone / absent-unpaid / high-risk groupings over the same `listStudentOperations` data as TL `finance` | Was an orphan page (see item 3); now linked as "Watchlist" in the sidebar. It's a **different view** (urgency-grouped) over the **same underlying data** as `finance`/`admin/finance`, not a separate concern |
| `portal/team-leader/payroll` | `FinanceClient.tsx` (2,120 lines) | Instructor + staff payroll, TL-scoped | Canonical implementation; `admin/payroll` reuses it directly |
| `portal/team-leader/instructor-payroll` | redirect → `payroll` | — | Phase 20 consolidation shim, intentionally kept |

## What's actually duplicated vs. what only looks duplicated

- **Payroll is not duplicated.** `admin/payroll` and TL `payroll` share one component (`FinanceClient.tsx`); only the data-fetch wrapper differs (which branches are queried, `isSuperAdmin` flag). This is the pattern to replicate elsewhere.
- **Collections/finance (student-level) is genuinely duplicated.** `admin/finance` (`FinanceTableClient.tsx`) and TL `finance` (`StudentOpsTable.tsx` + friends) solve the same problem — browse accounts, drill into one student's payments/installments/notes — with two independent component trees, two independent WhatsApp-link/date-format re-implementations (already fixed in item 4), and presumably two sets of bugs going forward. This is the highest-value merge target.
- **`collections` (Watchlist) is not a duplicate of `finance`** — it's a different lens (urgency buckets) on the same query (`listStudentOperations`). It doesn't need merging with `finance`, but it and `admin/finance`/TL `finance` do share the row type (`StudentOperationsRow`) and could share the underlying row-rendering (WhatsApp buttons, status badges) once `finance` itself is consolidated.
- **Finance Center is its own domain** (P&L/expenses), not overlapping with per-student collections or payroll. No action needed there beyond what item 5 already covers (breaking up its 1,729-line client).

## Recommendation

1. **Payroll**: keep as-is — already the right pattern (one client, thin per-surface data wrappers). No work needed.
2. **Student collections (`admin/finance` vs TL `finance`)**: pick **one** implementation as canonical — recommend the TL one (`StudentOpsTable`/`StudentOpsDrawer`/`StudentOpsModal`), since it's the more actively maintained surface (EnrollmentWizard, activity logging, payment promises) — and make `admin/finance` a thin wrapper around it the same way `admin/payroll` wraps TL `payroll`, passing an `isSuperAdmin`/all-branches scope. This removes an entire duplicate component tree (`FinanceTableClient.tsx`) once done.
3. **Watchlist (`collections`)**: leave as its own page; optionally, once (2) is done, extract the shared row-rendering (WA button, status pill) into one component both `finance` and `collections` import.
4. **Finance Center / revenue / expenses**: no structural change; the redirects are intentional and should stay.

This is a bigger, riskier change than the rest of this cleanup phase (it touches live financial workflows), so it's flagged here as a candidate for its own dedicated sprint rather than folded into Phase 5.
