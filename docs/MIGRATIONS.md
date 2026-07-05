# Migrations Convention

`supabase/migrations/` is the single source of truth for database schema.
`supabase_migrations.schema_migrations` (in the `robocode-platform` project,
`fkqwafedruparlqjiprq`) is the authoritative record of what has actually been
applied — the two must always match 1:1 by version.

## Rules

1. **Every new migration file uses a timestamp version**: `YYYYMMDDHHMMSS_name.sql`
   (UTC, e.g. `20260706120000_add_foo_column.sql`). Do not use the old
   sequential `NNNN_name.sql` numbering (`0001`–`0113`) — that scheme is
   frozen and kept only for the migrations created before this convention.
2. **Apply migrations only via `mcp apply_migration`** (or the Supabase CLI
   against this project). This writes the file's SQL to the database *and*
   registers the exact same version in `schema_migrations` in one step —
   there is no separate "register" step to forget.
3. **Manual execution in the Supabase SQL Editor is not allowed** for schema
   changes. It desyncs `schema_migrations` from `supabase/migrations/` (this
   happened repeatedly between 2026-06-20 and 2026-07-06 — see
   `docs/LMS_FULL_REVIEW_2026-07-05.md` §4 and the Phase 3 reconciliation
   that fixed it) and there is no way to retroactively guess the exact
   version/timestamp that gets assigned without re-deriving it from the
   database afterward.
4. After applying, run `graphify update .` if the change affects code, and
   `get_advisors` (security + performance) to catch anything the new schema
   introduced.

## Verifying sync

At any time, local files and the database record should be identical in
count and version:

```sql
select count(*) from supabase_migrations.schema_migrations;
```

```sh
ls supabase/migrations | wc -l
```

And version-by-version (extract the leading version token from each
filename and diff against `select version from supabase_migrations.schema_migrations order by version`).
If these ever diverge again, do not guess — pull the real `schema_migrations`
table and reconcile file-by-file before writing anything new.

## History

- `migrations/` (repo root, Sprints 32–46) — applied manually before this
  system existed. Archived to `docs/legacy-migrations/`, not tracked in
  `schema_migrations`, never to be re-run.
- `0059` is a deliberate numbering gap, not a missing migration.
- `0114`–`0127` were originally created with sequential filenames but applied
  via a tool that assigned its own timestamp version, so the files were
  renamed post-hoc (2026-07-06) to match what's actually registered.
