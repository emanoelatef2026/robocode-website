# Super-admin activity and notifications

## Coverage

The private database pipeline records future business mutations in students, parents, instructors, groups/memberships/allocations, contracts/accounts/payments/reversals/staff payments, schedules, attendance, teaching participation/change requests, recordings, assignments/submissions, evaluations, notes, projects/videos, courses, feedback and account-role/permission changes.

Other application audit events (including credential resets and manual reconciliation) are mirrored unless their operation already has row-trigger coverage. Logged operational errors and security denials are also mirrored. Ordinary reads, searches, notification reads and background timestamp-only updates do not generate business activity.

This is business-activity coverage, not a claim to capture every browser click, every storage byte, unaudited direct Auth administration, or arbitrary external database work. New business tables/actions must be added to the trigger coverage or application audit path. Failed client-side validation is not a successful system mutation and is not broadcast.

## Audience and priorities

- Only users with the database `super_admin` role receive these new notifications or can read the center. Existing instructor/team-leader/student/parent notifications remain independent.
- Urgent: financial corrections/reversals, deletions, permission changes, rate changes, logged errors and access denials.
- Needs action: participation requests, parent feedback and classes left open past their duration plus 60 minutes. Participation review remains the real business approval; reading or acknowledging an alert cannot approve earnings.
- Information: ordinary successful activity. Similar events by actor, action and class/group/student are grouped into five-minute bell bundles. Individual events remain available in the center.
- No historical notification flood is generated when the migration is installed.

## Identity and privacy

Server REST mutations attach an actor header derived from the verified LMS session cookie on each operation, not from mutable global headers. The database accepts that header only for service-role requests; authenticated database callers use their verified JWT subject. Background jobs remain labeled as system operations when no reliable actor is available.

Event snapshots use a strict scalar-field whitelist. Passwords, auth metadata, tokens, contact details, private note content, request/response bodies and receipt images are excluded. The original audit log is not copied wholesale. Error notifications contain generic messages and safe operation metadata, not raw database errors.

## Reliability

Activity is durable before bell delivery. Failed delivery is retained and retried by the super-admin bell refresh and existing session-effects cron. Bundle updates become unread again. Read-one uses an expected timestamp so a stale click cannot swallow a newly grouped event. Mark-all locks the notification rows; new events after its cutoff stay unread. Unread counts include the entire inbox, not only the most recent 30 notifications.

The new database helpers are service-only; trigger functions needing cross-user notification privileges are in the non-exposed `private` schema with a fixed search path and explicit execute revocations.

## Locations and operation

- `/admin/activity`: filters, pages, actor, Cairo time, before/after changes, related-record links and acknowledgement.
- Bell: new priority/group labels and an Activity Center link for super admin only.
- `/admin/system-events`: existing technical-event detail view.
- Long-running class scans are throttled to once per 15 minutes when the super-admin bell is active and also run from the existing cron.

Migration: `20261028102519_super_admin_activity_center.sql`. Apply before running the updated notification queries/actions. Do not include the rollback-only test fixture in the migration or deploy process.

Activated on the shared database on 2026-10-28 as part of the requested implementation. Migration history matches the local filename. Both rollback fixtures passed after activation. Application releases depend on this migration being installed first.

RLS is intentionally enabled without authenticated-user policies on the activity table: only the server service role can read it, and the feed RPC performs a fresh super-admin role check. The advisor's informational "RLS enabled with no policy" notice is expected for this service-only design.

Verification: `tests/notifications/admin-activity.rollback.sql` uses generated synthetic identities inside a transaction ending in `ROLLBACK`; it covers actual row triggers, actor isolation, financial changes, visibility, grouping/read races, redaction, retry after delivery failure, and role-gated reads. The instructor lifecycle rollback fixture also runs with these triggers installed to check shared attendance and contract-consumption behavior.
