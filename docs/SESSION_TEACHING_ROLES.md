# Shared class: lead and assistant

## Behavior

- A new class must be started explicitly as lead. An assigned assistant substituting for the lead chooses lead and receives their own lead rate for that class.
- Other assigned instructors request assistant participation in that same class. Pending requests appear in participation/history, with zero earnings.
- Super admin or the class branch's team leader approves participation. Missing assistant rates block approval with a configuration message.
- Only the lead ends, cancels or postpones the class. Student attendance and contract consumption remain shared and are finalized once.
- Assistant attendance, homework, evaluations, recordings, resources and shared notes become proposals. The lead reviews them independently of management's participation approval. Personal private notes remain private.
- Proposed content is unpublished and audience notifications are sent only after approval. Changed baselines prevent overwriting newer attendance/content. Replayed requests and approvals are idempotent.

## Rates

`salary_per_session` remains the lead rate. `assistant_salary_per_session` is optional until an assistant participation is approved. Zero is a valid explicitly configured rate; blank is unconfigured.

A group-specific rate applies only when the actual teaching role matches that assignment's role. Approval snapshots the rate in `session_participations.agreed_rate`; changing a profile later does not reprice an approved class. Explicit payroll overrides remain supported. Earnings require approval and completion.

## Activation

Migration: `supabase/migrations/20261028071336_session_lead_assistant_workflow.sql`.

Apply the migration before releasing the application code. This is a coordinated schema/application release: the code depends on the new columns and RPCs. Local development currently shares the hosted database; a local code change does not create an isolated database.

Activated on the shared database on 2026-10-28 with user approval. The migration history version matches the checked-in migration filename. Post-activation synthetic integration checks ran inside a transaction ending in `ROLLBACK`.

Legacy ongoing classes without a recorded lead can be explicitly resumed as lead by an assigned instructor. The existing class is reused under the group lock; no extra class or attendance record is created.

Do not re-run a migration that has already been applied. Backfill uses the earliest recorded join for historical classes. Classes without a provable recorded lead cannot accept assistant content proposals until ownership is established.

## Verification and preview

- `npx vitest run --maxWorkers=4`
- `npx tsc --noEmit`
- `npm run build`
- Run the migration and `tests/session-lifecycle/lead-assistant.rollback.sql` in the same explicit transaction ending in `ROLLBACK`. Synthetic UUID identities only; no fixture is committed to the database.
- `node tests/session-lifecycle/preview/server.mjs` opens the synthetic preview at `http://localhost:4175`. It uses real UI components with in-memory mocked actions, without database access. It is not an end-to-end authenticated portal test and must never become a production route.
