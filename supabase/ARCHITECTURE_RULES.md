# Supabase Architecture Rules
## Robocode School Platform — Database Governance

This document is the single source of truth for all database design decisions.
Every developer and AI assistant modifying the schema must read and follow these rules.

---

## 1. Migration Naming

- Format: `NNNN_short_description.sql` (4-digit zero-padded number)
- Numbers are sequential — never skip, never re-use
- Descriptions use snake_case, max 40 chars
- Examples: `0081_enrollment_index_hardening.sql`, `0082_instructor_availability.sql`
- Sprint numbers are NOT used in filenames — they become stale immediately

---

## 2. Idempotency Policy

**ALL migrations MUST be idempotent.** Every statement must be safe to re-apply:

```sql
-- Tables
CREATE TABLE IF NOT EXISTS ...

-- Columns
ALTER TABLE t ADD COLUMN IF NOT EXISTS col TYPE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_name ON table (column);

-- Views
CREATE OR REPLACE VIEW v_name AS ...

-- Functions
CREATE OR REPLACE FUNCTION fn_name() ...
```

**NEVER** use bare `ALTER TABLE ... ADD COLUMN` without `IF NOT EXISTS`.  
**NEVER** use bare `CREATE INDEX` without `IF NOT EXISTS`.

---

## 3. No Destructive Migration Policy

Migrations NEVER:
- `DROP TABLE` (use `deleted_at` soft-delete instead)
- `DROP COLUMN` (mark as deprecated in a comment, remove in a future cleanup sprint)
- `TRUNCATE` (use targeted `DELETE` with a `WHERE` clause)
- `ALTER TABLE ... ALTER COLUMN TYPE` on tables with live data (add a new column, backfill, then swap)

Exception: dropping indexes that were mistakes — always safe.

---

## 4. Soft Delete Policy

All entity tables use `deleted_at TIMESTAMPTZ DEFAULT NULL`.

**Required pattern:**
```sql
ALTER TABLE entity ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_deleted ON entity (deleted_at) WHERE deleted_at IS NULL;
```

All queries on entities MUST filter `deleted_at IS NULL` unless explicitly fetching deleted records.

---

## 5. View Naming Standards

| Prefix   | Purpose                                        | Example                       |
|----------|------------------------------------------------|-------------------------------|
| `v_`     | Operational/read views used by application     | `v_group_health`              |
| `v_diag_`| Diagnostic views for data integrity auditing   | `v_diag_orphan_students`      |
| `v_dash_`| Dashboard-specific aggregation views           | `v_dashboard_overview`        |

Views MUST:
- Use `CREATE OR REPLACE VIEW` (never bare `CREATE VIEW`)
- Never contain write operations
- Be documented with a comment block describing their purpose and expected consumers

---

## 6. Snapshot / Ledger Rules

**Ledger tables** (append-only, immutable rows):
- `student_enrollments` — session contracts. Never UPDATE, only INSERT + status changes via separate column.
- `finance_payments` — payment records. Never UPDATE amounts.
- `attendance_records` — attendance ledger. Never UPDATE status retroactively in bulk.
- `attendance_consumptions` — FIFO session consumption ledger.

**Invariants:**
- `student_enrollments.consumed_sessions + remaining_sessions = enrolled_sessions` (enforced at application layer)
- `student_financial_accounts.paid_amount + remaining_amount ≈ total_amount` (drift allowed, reconciled nightly)
- Never backfill ledger tables. Write correction entries instead.

---

## 7. Operational Event Rules

Operational events (attendance, payments, enrollments, transfers) MUST:
1. Be written to their respective ledger table
2. Trigger `revalidatePath` for affected portal pages (via server action)
3. Optionally write to `audit_log` via `write_audit_log` RPC for compliance trails

Do NOT recompute derived state inline. The `operational-engine` module computes all operational outputs
from raw data — do not add computation logic to migrations.

---

## 8. Index Policy

**Required indexes** for every foreign key used in `WHERE`, `JOIN ON`, or `ORDER BY`:
- Always use partial indexes where a filter is always applied (e.g., `WHERE deleted_at IS NULL`)
- Name format: `idx_{table}_{columns}` (abbreviated if needed)
- Composite index column order: highest-selectivity first

**Do NOT add indexes for:**
- Columns only used in `SELECT` (not `WHERE`/`JOIN`)
- Tables with < 1,000 rows (PostgreSQL sequential scan is faster)
- Columns that change frequently (write amplification > read gain)

---

## 9. Generated Column Policy

Generated/computed columns (e.g., `GENERATED ALWAYS AS`) are ONLY allowed for:
- Simple arithmetic (e.g., `remaining = enrolled - consumed`)
- Immutable transformations (e.g., `lower(email)`)

Never use generated columns for:
- Business logic with side effects
- Expressions that query other tables (use views instead)

---

## 10. Ownership Model

| Domain                  | Owner table(s)                         | Key invariant                              |
|-------------------------|----------------------------------------|--------------------------------------------|
| Sessions contract       | `student_enrollments`                  | Financial ownership; independent of group  |
| Group delivery          | `group_students`, `groups`             | Operational only; switching groups ≠ new contract |
| Payments                | `student_financial_accounts`, `finance_payments` | Linked to enrollment, not group    |
| Attendance              | `attendance_records`, `attendance_consumptions` | FIFO session deduction from enrollment |
| Instructor assignment   | `group_courses.instructor_id`, `group_instructors` | Lead + optional additional role  |

**Critical**: Groups are operational delivery units. Enrollment contracts exist independent of groups.
Removing a student from a group does NOT cancel their contract.

---

## 11. RLS / Grants Policy

- RLS is enabled on all user-facing tables
- Service-role key bypasses RLS (used only in server-side actions via `createServiceClient`)
- Never use the anon/public key in server actions
- `GRANT` statements must be included in every migration that creates a new table or view

---

## 12. Schema Drift Prevention

After every migration:
1. Run `supabase db push --local` and verify exit 0
2. Run `supabase gen types typescript --local` and commit the updated types
3. Run `npx tsc --noEmit` and verify 0 errors

Migration 0054 (`schema_reconciliation.sql`) was the last emergency reconciliation.
All future migrations follow this governance document — no emergency reconciliation sprints.
