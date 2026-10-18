# Instructor session workspace

## Core workflow

Start the session, explicitly mark attendance, then either save a partial roster or
review **Save & end session**. Completion submits the current topic and roster in
one request. Unmarked students are never silently marked present. Cancelled,
postponed and not-yet-started sessions cannot record attendance through this flow.

Attendance, content, homework, and notes/evaluations have separate tabs. Switching
tabs preserves the attendance draft. The fixed toolbar follows the content width,
reserves space below the content, and clears the mobile bottom navigation. Pending
operations disable conflicting actions. Errors preserve the draft; subsequent
edits invalidate the saved indicator. Reloading with unsaved attendance prompts
before leaving. Notes/evaluations use portalled dialogs, never nested forms.

## Transaction boundary

`save_instructor_session` is a service-only, invoker-security RPC. It rechecks actor,
branch permission, instructor allocation, session/group identity and active roster
under database locks. Missing, foreign, duplicate or invalid student/status input
is rejected. Saving can include a subset; ending requires the entire active roster.

Completion atomically writes attendance/topic, canonical contract consumption,
instructor participation, session status, allocation lifecycle, audit and an outbox
job. A critical write failure rolls back the entire operation. Completed retries
return success without replaying changes, charging another slot or queuing rewards
again. Ordinary content edits cannot overwrite the session status.

Consumption preserves the existing rule: an explicit group contract wins;
otherwise only the same course is eligible, using the established FIFO/date/window
rules. Present, absent, late, excused and makeup consume slots. Existing ledger
links are never reassigned by this workflow; generated remaining-session counters
are not manually written. Unrelated contracts remain untouched.

## Non-blocking effects

Completion freezes the reward roster in `session_completion_effects`. An awaited
Next `after()` callback processes it after the response. A completed-session revisit
can resume an eligible job; `/api/cron/session-effects` provides a daily recovery
pass, authenticated using the existing constant-time cron secret guard.

Workers lease jobs for five minutes, back off on failure, and cap attempts at eight.
An expired final attempt becomes `failed`, not permanently `processing`. Failed
jobs require operator review; the ordinary UI does not claim that rewards have
already finished. The outbox and XP event tables have RLS enabled, no browser grants
or policies, and are accessible only to the server service role.

XP is awarded transactionally with a unique `(session_id, student_id)` event. Badge
and achievement eligibility stays in the canonical TypeScript services; their
individual award writes are serialized/idempotent RPCs. Database failures in the
worker propagate through a checked client rather than falsely finishing a job.
The XP function explicitly qualifies `public.students`, preserving its empty
security search path. This fixes the former `relation "students" does not exist`
error without weakening permissions.

## Verification

- `node node_modules/vitest/vitest.mjs run --maxWorkers=4`
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`
- `node node_modules/next/dist/bin/next build`
- Synthetic browser preview: `node tests/session-lifecycle/preview/server.mjs`.
  This is localhost-only, uses mocked actions, and cannot import the backend.
  It is not an authentication bypass or a production route.
- Database fixture: `tests/session-lifecycle/atomic-session.rollback.sql`, run
  only inside an outer `BEGIN`/`ROLLBACK` transaction. It creates synthetic people
  and groups, injects a critical audit failure, and asserts rollback, absent-slot
  consumption, unrelated-contract protection, idempotent starts/completion, leases,
  frozen reward eligibility, XP/achievement/badge retry safety and service-only
  access. Never run it without the rollback wrapper.

The application requires migration `20261018071826_atomic_instructor_session`.
Its local version matches the applied remote migration. No historical attendance,
contract or payment backfill is part of this change.
