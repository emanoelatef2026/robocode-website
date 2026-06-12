# Migration Rules — Robocode Platform

These rules exist because we experienced permanent history drift that required a
manual reconciliation audit (June 2026). Follow them without exception.

---

## 1. Immutable Version Numbers

Once a migration file is committed and pushed, its version number **never changes**.

- ❌ `0044_sprint26.sql` → `0044_final.sql` (NEVER)
- ✅ Create a new file: `0079_portfolio_fix.sql`

**Why:** Renaming a file changes the version string. Remote DB still holds the old
name. `db push` then fails with "Remote migration versions not found in local
migrations directory."

---

## 2. File Naming Convention

Format: `{NNNN}_{short_description}.sql`

- `NNNN` = zero-padded integer, one higher than the current highest
- `short_description` = snake_case, describes what changes (not when or why)
- Never use sprint names, dates, or "final" as suffixes

```
0079_add_payment_method.sql   ✅
0079_sprint60_final.sql       ❌
0079_2026_06_12.sql           ❌
```

---

## 3. One Concern Per Migration

Each file must do one logical thing. Do not bundle unrelated changes.

- ✅ `0080_add_invoice_columns.sql` — only invoice columns
- ❌ A file that adds invoice columns AND rewrites auth policies AND creates a new table

**Why:** Rollback and debugging become impossible with mixed-concern migrations.

---

## 4. Always Idempotent

Every migration must be safe to run twice without error:

- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `CREATE OR REPLACE VIEW`
- `DO $$ BEGIN IF NOT EXISTS ... END $$;` guards for policies

**Never use** bare `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, or `CREATE INDEX`
without the `IF NOT EXISTS` guard.

---

## 5. No Manual DB Edits Without a Migration File

If you run SQL directly in the Supabase SQL editor or via `db query --linked`:

1. Immediately create a migration file that reproduces the same SQL idempotently.
2. Register it in migration history: `npx supabase migration repair --status applied NNNN`
3. Commit both the file and the repair command in the same PR description.

**Why:** Manual edits are the #1 cause of history drift. The 0058 gap in this
project was caused by exactly this.

---

## 6. Never Repurpose a Version Number

If a migration was reverted or removed, its version number is **retired forever**.
The next migration uses `current_max + 1`.

- After removing `0059`, the next migration is `0079`, not `0059`.

---

## 7. Generated Column Rule

`student_enrollments.remaining_sessions` is a `GENERATED ALWAYS` column.
Do **not** include it in any `UPDATE ... SET` statement.

```sql
-- ❌ WRONG — will fail at runtime
UPDATE student_enrollments SET consumed_sessions = 5, remaining_sessions = 3 WHERE ...;

-- ✅ CORRECT — remaining_sessions recomputes automatically
UPDATE student_enrollments SET consumed_sessions = 5 WHERE ...;
```

This applies to ALL functions, triggers, and migration backfill scripts.

---

## 8. Append-Only Migration History

`supabase_migrations.schema_migrations` is the source of truth.

- Never `DELETE` from it manually except as part of an explicit history repair.
- Never `INSERT` fake rows — always use `supabase migration repair --status applied NNNN`.
- The `repair` command only accepts pure-numeric version strings. For non-numeric
  remote versions (legacy artifacts), use `db query --linked` with raw SQL.

---

## 9. Deployment Checklist

Before every production deployment run:

```bash
npx supabase migration list        # must show all Local = Remote
npx supabase db push               # must say "Remote database is up to date"
```

If either fails, **stop the deployment** and repair the history first.

---

## 10. History Repair Procedure

If drift is detected:

```bash
# Find the offending remote version
npx supabase db query --linked \
  "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;"

# Remove a wrongly-named remote entry (pure numeric versions only)
npx supabase migration repair --status reverted NNNN

# For non-numeric legacy version strings (e.g. 0044_final), use direct SQL:
npx supabase db query --linked \
  "DELETE FROM supabase_migrations.schema_migrations WHERE version = '0044_final';"

# Register the correct local version
npx supabase migration repair --status applied NNNN

# Verify
npx supabase migration list
npx supabase db push
```

---

## 11. Schema Verification After Any Repair

After any history repair, confirm the actual schema objects exist — not just history rows:

```sql
-- Run in db query --linked to spot-check
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'consume_attendance_sessions_batch';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'attendance_consumptions';
```

History rows do NOT guarantee schema objects exist. Verify both independently.

---

## Known Historical Drift (Resolved June 2026)

| Version | Issue | Resolution |
|---------|-------|------------|
| `0044_final` | Renamed file; remote kept old name | Deleted `0044_final` from remote history; registered `0044` |
| `0058` | Manually applied without registering | Registered `0058` in remote history |
| `0069–0078` | History rows inserted without executing SQL | Applied all DDL directly via `db query --linked` |
| `remaining_sessions` | GENERATED column set in UPDATE in 0074/0075/0076/0078 | Fixed all four migration files |
