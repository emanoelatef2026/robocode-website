@AGENTS.md

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Governance (Phase 6)

- **Migrations**: `supabase/migrations/` with `YYYYMMDDHHMMSS_name.sql` timestamps is the only source of truth — see `docs/MIGRATIONS.md` for the full convention (no manual SQL Editor runs, apply only via the Supabase migration tool).
- **After every migration**, run the security and performance advisors (`get_advisors`) to catch anything the new schema introduced — required, not optional.
- **Service-role Supabase client is server-only** (Server Actions / Route Handlers, never client components). Any new table gets RLS enabled with at least one explicit policy in the same migration that creates it — never ship a table without one.
- **CI must be green before merge**: `.github/workflows/ci.yml` runs `tsc --noEmit`, `vitest run`, `eslint .`, and `next build` on every push/PR to `main`. Do not merge on a red run.
