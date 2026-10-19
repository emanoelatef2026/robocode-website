# Instructor session workspace

## Core workflow

Start the session, explicitly mark attendance, then either save a partial roster or
review **Save & end session**. Completion submits the current topic and roster in
one request. Unmarked students are never silently marked present. Cancelled,
postponed and not-yet-started sessions cannot record attendance through this flow.

Starting from the group page resumes an ongoing session, otherwise starts the
earliest numbered scheduled session (preserving its date, number and metadata).
Only when none is scheduled does it create a new session. The selected lesson must
still be inside the instructor's active allocation; later allocations cannot skip
an earlier planned lesson. Retrying returns the same ongoing lesson. Migration
`reuse_scheduled_instructor_session` corrects the former MAX(number)+1 start logic,
which rejected fully pre-scheduled groups as if all planned lessons were delivered.

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

## Shared teaching participation

The group session hub shows the ongoing class, the next planned lesson and all
previous classes with participant names and the instructor's own participation
state. Starting uses expected class IDs under the group lock: a stale page cannot
silently create the following class after a colleague ends the previous one.
A partial unique index enforces one ongoing schedule per group course.

`session_participations` records joining independently of student attendance.
Joining alone does not earn payroll. Explicit confirmation creates one
`session_instructors` row per instructor/class; only completed classes contribute
to payable earnings. Ending also confirms the ending instructor. A colleague who
joined before completion can confirm afterwards without replaying attendance,
contract consumption, group progression or XP. Never credit every assigned
instructor automatically. Historical lead fallback is excluded once explicit
teaching participation exists.
For shared classes, both instructor earnings and management payroll reports also
exclude preassigned teaching rows until `submitted_at` is populated by confirmation
or approval. Historical non-shared payroll attribution is preserved.

Late claims require a reason and branch-scoped team-leader/super-admin approval.
Pending/rejected claims do not earn payroll. Review requests in the Instructors
page of either management portal. Approval only adds that instructor's teaching
participation; it does not reopen or add a class. No historical backfill is run.

### Request notifications

Migration `20261019135021_participation_request_notifications` adds a transactional
in-app bell notification when a late participation request is saved. It targets
super admins and the session branch's team leaders who have `manage_instructors`.
Other branches, students, parents and ordinary instructors are not recipients.
Multiple qualifying roles and repeated requests still produce one notification
per recipient/session/instructor. Notification failure rolls back the request,
so a saved request cannot silently lose its notification.

The message identifies the instructor, group, lesson number and date. Its link
opens the relevant management portal's Instructors page at Participation approvals.
No payroll amounts or financial totals are included. Existing pending requests
are notified once when the migration runs; resolved requests are not backfilled.
This is a notification backfill only, not an attendance or payroll backfill.

Admin/team-leader bells refresh every 30 seconds while the tab is visible and on
returning to it. Other portals keep their existing on-open behavior. Temporary
feed failures preserve the badge, and opening failures offer Retry. Overlapping
polls are deduplicated; stale polls cannot undo a successful mark-all-read.

Shared attendance uses `schedules.attendance_revision`, advanced by a trigger on
every attendance write. Stale revisions are rejected and drafts retained for
review; a reload action explicitly discards the draft. Unversioned legacy writes
are rejected once multiple instructors have joined. Completed attendance is
read-only in the instructor workspace; administrative corrections use existing
attendance management. Group-before-schedule lock ordering is shared by these RPCs.

All participation tables/helpers are service-only, invoker-security, and recheck
actor identity, active instructor, allocation range and branch permission. Late
approval also checks the approver's administrative role and branch in the database.
Required migration: `20261019124846_shared_instructor_session_participation`.
Follow-up `20261019125304_confirm_preassigned_session_participation` ensures an
existing unsubmitted teaching assignment is confirmed in-place rather than
ignored; retries preserve the first submission timestamp and never duplicate it.
`20261019125947_shared_session_payroll_hardening` isolates historical confirmations
from the group's current course allocation and reconciles approved current-course
participation without changing student attendance or consumption.
Integration regression: `tests/session-lifecycle/shared-session.rollback.sql`,
always inside BEGIN/ROLLBACK. Covers co-teaching, late confirmation/approval,
stale saves/starts, duplicate ongoing classes and single student consumption.

## Non-blocking completion effects

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
  access. Also reproduces a 12-lesson plan with three completed lessons: start must
  reuse #4, preserve its planned date, leave future/completed lessons intact and
  never consume attendance/contracts merely by starting. Never run it without
  the rollback wrapper.

The application requires migration `20261018071826_atomic_instructor_session`.
Its local version matches the applied remote migration. No historical attendance,
contract or payment backfill is part of this change.
