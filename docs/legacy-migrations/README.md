# Legacy Migrations (Sprint 32–46)

These 17 SQL files were applied **manually via the Supabase SQL Editor** during
Sprints 32–46, before `supabase/migrations/` (with `supabase_migrations.schema_migrations`
tracking) was adopted as the project's migration system.

They are kept here for historical reference only — the tables they created
(`leads`, `student_enrollments`, the early finance tables, etc.) are already
live in production and are covered by later numbered migrations in
`supabase/migrations/` (schema reconciliation happened in `0054_schema_reconciliation.sql`
and onward).

**Do not re-run these files.** They are not tracked in `schema_migrations` and
have no relationship to the current migration numbering. If you need to
understand how a table from this era evolved, search `supabase/migrations/`
for its name instead — that is the current source of truth.

See `docs/MIGRATIONS.md` for the migration convention used from here on.
