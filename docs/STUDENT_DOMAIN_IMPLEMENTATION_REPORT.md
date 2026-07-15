# Student Domain Implementation Report — Sprint 2

**Date:** 2026-07-15
**Scope:** Student Notes, Evaluations, Competitions, Achievements, Timeline, Notifications, RBAC — data model + business layer only. No Student/Parent Portal UI, no Gamification UI, no Analytics, no Mobile, no XP wiring.

---

## 1. Architecture Summary

Before writing any schema, the live Supabase project (`fkqwafedruparlqjiprq`) and codebase were audited directly (not from stale docs) to avoid duplicating existing infrastructure. That audit found three of the five domains already had real, working scaffolding:

- **`student_timeline_events`** — a generic `(type, severity, metadata, actor_user_id)` event table already existed with a full reader (`lib/timeline/index.ts`, `getStudentTimeline`) and a 27-value `TimelineEventType` enum, but **0 rows and no writers** — nothing in the app ever called `logTimelineEvent()`.
- **`student_achievements` / `student_badges`** (Phase XXXIII gamification) — real, working tables. `achievement_type` already allowed `'competition'` as a value, unused.
- **`student_notes`** — already had `author_id`, `category`, `severity`, RLS, and an audit trigger. Its only gap versus the required 6-tier visibility model was a single `is_private BOOLEAN`.

Given this, the implementation **extends existing tables/modules** wherever possible and creates new tables only for the two genuinely new entities: Evaluations and Competitions. No parallel systems were introduced.

Four new/extended domain modules were built, all following the repo's existing module shape (`types.ts` / `schemas.ts` / `queries.ts` / `actions.ts`, `'use server'` actions, `server-only` queries):

- `modules/student-notes/` (new — promoted out of `modules/instructor-portal/`)
- `modules/student-evaluations/` (new)
- `modules/student-competitions/` (new)
- `modules/gamification/` (extended — achievement/badge services now emit timeline events + notifications)

`lib/timeline/` and `modules/notifications/` were extended, not replaced, with new event/notification types.

---

## 2. Database Changes

### `student_notes` (extended)
| Change | Detail |
|---|---|
| `is_private BOOLEAN` | **removed** |
| `visibility TEXT NOT NULL` | 6-tier model: `PRIVATE_INSTRUCTOR`, `PRIVATE_TEAM_LEADER`, `INTERNAL_STAFF`, `SHARED`, `STUDENT_INSTRUCTION`, `PARENT_EVALUATION` |
| `attachments JSONB NOT NULL DEFAULT '[]'` | attachments-ready, unpopulated |
| `deleted_at TIMESTAMPTZ` | soft delete |

Backfill: `is_private=false` → `INTERNAL_STAFF`; `is_private=true` → `PRIVATE_TEAM_LEADER` if the author's only role is `team_leader`, else `PRIVATE_INSTRUCTOR`. Verified against live data (2 pre-existing notes both backfilled to `PRIVATE_INSTRUCTOR`).

### `student_evaluations` (new)
Structured, criterion-based evaluation. Columns: `student_id`, `enrollment_id`/`course_id` (nullable), `branch_id`, `criterion` (14 fixed values + `CUSTOM` + `custom_label`), `score NUMERIC(5,2)`, `rating SMALLINT(1-5)` (at least one required via CHECK), `feedback`, `author_id`, `visible_to_student`/`visible_to_parent` (default true), `evaluated_at`, `deleted_at`, timestamps.

**No separate history/snapshot table** — each row is itself the historical record; "history" is the full row set per `(student_id, criterion)` ordered by `evaluated_at`. This mirrors the Phase XXXIII precedent of avoiding event-log tables for cost/complexity reasons.

### `student_competitions` (new)
`student_id`, `competition_name`, `season`, `year`, `role`, `team_name`, `coach_instructor_id` (FK `instructors`), `branch_id`, `project_id` (FK `portfolio_projects` — reused, not duplicated), `rank`, `award`, `certificate_id` (FK `certificates` — reused), `notes`, `media JSONB DEFAULT '[]'` (media-ready), `achievement_id` (FK `student_achievements`, set when auto-created), `created_by`, timestamps.

### `student_achievements` (extended)
- `+ competition_id UUID REFERENCES student_competitions(id)`
- `achievement_type` CHECK extended: added `'milestone'` (alongside existing `project`, `competition`, `certificate`, `leadership`, `attendance`, `innovation`, `custom`)

### RBAC seed
Two new permissions inserted via the existing `permissions`/`role_permissions` seeding idiom (matching `0025_seed_portfolio_certificate_permissions.sql`):
- `manage_evaluations` → `instructor`, `team_leader`, `super_admin`
- `manage_competitions` → `team_leader`, `super_admin` (mirrors `manage_portfolio`/`manage_certificates` — instructors don't hold record-keeping permissions for those either)

---

## 3. Migrations

1. **`supabase/migrations/20260715123000_student_domain_foundation.sql`** — all schema/RLS/trigger/permission changes above, applied via the Supabase migration tool (not manual SQL Editor).
2. **`supabase/migrations/20260715124500_student_domain_security_hardening.sql`** — follow-up fix. Running the mandatory post-migration `get_advisors` (security) check surfaced that the two new trigger functions (`audit_student_evaluation_change`, `audit_student_competition_change`) were, by Postgres default, `SECURITY DEFINER` with a mutable `search_path` **and anon/authenticated-executable via RPC** — exactly the pattern the prior Sprint S0 security lockdown fixed elsewhere. Fixed by pinning `search_path = ''` on all three note/evaluation/competition trigger functions and revoking `EXECUTE` from `PUBLIC, anon, authenticated` on the two new ones (the note trigger was already correctly locked down from the earlier hardening pass and CREATE OR REPLACE preserved its ACL). Re-ran `get_advisors` after — confirmed `anon_exec`/`auth_exec` both `false` for all three.

Both migrations are live on production (project `fkqwafedruparlqjiprq`).

---

## 4. Business Rules Implemented

- A student's notes visibility is now a real 6-tier model instead of a boolean, matching the mission's Part 1 spec exactly (private-instructor / private-TL / internal-staff / shared / student-instruction / parent-evaluation).
- Team Leaders can now author notes (`createTeamLeaderNote`) — previously **no TL authoring path existed at all**, despite RLS nominally granting TL read access.
- A latent access-control gap was fixed in the same migration: the old `student_notes_manager_read` RLS policy let any TL/admin read **any** note regardless of `is_private` (the real enforcement lived only in a hand-written app-layer filter that no TL-facing code path used). The new policy set correctly scopes staff reads to non-private visibility tiers.
- Evaluations support both numeric score (0–100) and star rating (1–5), independently or together, across 13 named criteria plus a `CUSTOM` escape hatch — decoupled from `assignment_id`, unlike the existing `submissions.score`.
- Competition results (`rank`/`award`) automatically create a linked `student_achievements` row (`achievement_type='competition'`) — competition history is folded into the existing achievement/history system, not a parallel one.
- Soft delete added to `student_notes` and `student_evaluations` (previously `student_notes` hard-deleted).

---

## 5. Permission Model

| Permission | instructor | team_leader | super_admin |
|---|:-:|:-:|:-:|
| `manage_evaluations` | ✅ | ✅ | ✅ |
| `manage_competitions` | — | ✅ | ✅ |
| Notes (staff tiers) | via existing group-membership check | via `manage_students` (reused, no new permission) | via `manage_system` admin override |

"Branch Manager" (named in the mission's business rules) does not exist as a distinct role in this system — only `student`, `parent`, `instructor`, `team_leader`, `super_admin`. Noted rather than inventing a role that has no corresponding account type.

RLS is defense-in-depth only (documented repo pattern: all application code uses the service-role client, which bypasses RLS unconditionally); real enforcement is the app-layer `requirePermission`/`isBranchAccessible` calls plus the `canViewerReadNote()` pure function in `modules/student-notes/queries.ts`, which is the single source of truth for note visibility (used by every reader, not re-implemented per portal).

---

## 6. Notification Integration

Extended the existing per-event-type seed-function pattern (`modules/notifications/actions.ts`, `dedup_key` idiom) rather than introducing a generic `createNotification()` — that would have been a parallel mechanism to the repo's established one.

New types: `EVALUATION_PUBLISHED`, `STUDENT_NOTE_SHARED`, `PARENT_NOTE_SHARED`, `ACHIEVEMENT_EARNED`, `COMPETITION_RESULT`. All 5 are fully wired (not just scaffolded):

- Notes → student/parent notified when visibility reaches them (`SHARED`/`STUDENT_INSTRUCTION`/`PARENT_EVALUATION`)
- Evaluations → student/parent notified per the `visible_to_student`/`visible_to_parent` flags
- Competitions → student + all linked parents notified; if an achievement was auto-created, a second `ACHIEVEMENT_EARNED` notification fires
- Gamification (`unlockAchievement`, `awardBadge`) → now also notify the student, closing a gap where achievements/badges were created but never surfaced

Two new recipient-resolution helpers were added once, in `modules/notifications/queries.ts` (`getStudentUserId`, `getParentUserIdsForStudent`), reused by all three new domains instead of tripling the `parent_students` join.

---

## 7. Timeline Architecture

`lib/timeline/index.ts` (and its backing `student_timeline_events` table) is the **single** timeline module — a second, unrelated `getStudentTimeline` in `modules/student-portal/queries.ts` (an ad-hoc student-portal activity feed) was left untouched; conflating the two would have been a real mistake since they serve different audiences and neither reads the other's table.

4 new event types added: `EVALUATION_RECORDED`, `COMPETITION_LOGGED`, `ACHIEVEMENT_EARNED`, `BADGE_EARNED`. Notes reuse the **pre-existing** `NOTE_ADDED` value, which had a label/severity defined but was never fired.

All 4 new domains + the existing gamification services now call `logTimelineEvent()` fire-and-forget. Author-private notes (`PRIVATE_INSTRUCTOR`/`PRIVATE_TEAM_LEADER`) are deliberately excluded from timeline logging so a private note never leaks into a feed some other staff member might read.

**Explicitly out of scope:** retrofitting Enrollment/Group-change/Certificate/Graduation/Renewal events into this table. Those already have their own tracking (`audit_logs`, `cohort_graduation_decisions`, finance's separate timeline usage of the same table for collections events). Rewiring them is a larger cross-cutting change beyond this sprint's stated deliverables — flagged as a Sprint 3+ recommendation below, not silently dropped.

---

## 8. Files Modified / Created

**New modules:**
`modules/student-notes/{types,queries,actions}.ts`, `modules/student-evaluations/{types,schemas,queries,actions}.ts`, `modules/student-competitions/{types,schemas,queries,actions}.ts`

**New migrations:**
`supabase/migrations/20260715123000_student_domain_foundation.sql`, `supabase/migrations/20260715124500_student_domain_security_hardening.sql`

**Modified:**
`lib/timeline/index.ts` (new event types), `modules/notifications/{types,actions,queries}.ts` (new notification types + seed functions + recipient helpers), `modules/gamification/{achievement-service,badge-service}.ts` (timeline + notification hooks, `resolvePortfolioId` exported for reuse), `modules/rbac/{types,permissions}.ts` (2 new permissions), `modules/instructor-portal/{actions,queries,types}.ts` (delegates to `modules/student-notes/`), `app/portal/instructor/groups/[id]/students/[studentId]/page.tsx` (1-line visibility display update), `types/database.ts` (regenerated from live schema).

**Deleted:**
`modules/students/notes/types.ts` — stale, zero-importer duplicate type file predating the category/severity fields, confirmed dead before removal.

**New tests:**
`tests/student-evaluations/evaluations.test.ts`, `tests/student-competitions/competitions.test.ts`, `tests/timeline/timeline-events.test.ts`, `tests/notifications/student-domain-notifications.test.ts`

**Rewritten test:**
`tests/student-notes/notes.test.ts` — updated from the old `is_private`-based inline filter to the real `canViewerReadNote()` visibility matrix (staff/student/parent scenarios).

No UI component files (`StudentNoteModal.tsx`, `NoteForm.tsx`, `DeleteNoteButton.tsx`) were touched — the existing `is_private` checkbox continues to work unchanged; the Server Action layer computes `visibility` from it internally.

---

## 9. Performance Review

- All new tables have indexes on the actual query patterns used: `(student_id, evaluated_at DESC)` and `(student_id, criterion, evaluated_at DESC)` for evaluations, `(student_id, year DESC)` for competitions, plus `branch_id`/`author_id` indexes for RLS/permission-scoped lookups.
- `getStudentNotes()` replaces an inline per-call query + in-memory filter that instructor-portal previously duplicated — same query cost, now centralized.
- All notification/timeline side effects are fire-and-forget (`void ... .catch(() => {})`), matching the existing gamification XP pattern — never block the primary write path.
- `get_advisors` (performance) was run after the migration; no new unindexed-foreign-key or missing-index findings attributable to this sprint's tables (the tool's full output was dominated by pre-existing, unrelated findings on other tables).

---

## 10. Tests Added

61 test files / 462 tests total, all passing. New/changed for this sprint:
- `tests/student-notes/notes.test.ts` — 9 tests: visibility-matrix filtering (staff/student/parent × all 6 tiers), schema shape.
- `tests/student-evaluations/evaluations.test.ts` — 12 tests: schema validation (score-or-rating requirement, CUSTOM+custom_label requirement, score/rating bounds), criterion label completeness, action wiring (insert + validation-error path).
- `tests/student-competitions/competitions.test.ts` — 7 tests: schema validation, achievement auto-creation on award/rank, no-achievement path when neither is set.
- `tests/timeline/timeline-events.test.ts` — 4 tests: new event types have labels/severities, `logTimelineEvent` inserts correctly and never throws on failure.
- `tests/notifications/student-domain-notifications.test.ts` — 8 tests: all 5 new seed functions produce the correct `dedup_key`/upsert-conflict contract; both recipient-resolution helpers.

---

## 11. Manual QA

Performed directly against the live Supabase project (no UI exists yet to QA through):
- Confirmed migration backfill correctness: both pre-existing `student_notes` rows correctly mapped to `PRIVATE_INSTRUCTOR`.
- Confirmed schema shape for all 3 touched/new tables via `information_schema.columns`.
- Confirmed the security-hardening follow-up: `has_function_privilege('anon'/'authenticated', ..., 'EXECUTE')` returns `false` for all 3 audit trigger functions post-fix.
- Confirmed `role_permissions` grants landed correctly for `manage_evaluations`/`manage_competitions` per role.
- `tsc --noEmit`, `eslint .` (0 errors), `npm run build` (full production build, all ~150 routes compiled), `vitest run` (462/462) all green.

---

## 12. Remaining Risks

- **`feedback_notes` / `parent_feedback` / `instructor_notes` were deliberately not consolidated** into `student_notes`. They serve genuinely different purposes (rated session feedback, parent NPS surveys, instructor-about-instructor notes respectively) and a prior sprint already documented deferring this consolidation once. Continuing to defer is a documented decision, not an oversight — but the codebase now has 4 note-like tables total, which is real tech debt if a future sprint wants one unified "feedback" surface.
- **No TL-facing UI exists** for note authoring, evaluations, or competitions — `createTeamLeaderNote`, `createStudentEvaluation`, `createStudentCompetition` are business-layer-only per the mission's explicit stop-list. They are untested against a real browser flow (only unit-tested).
- **The `student_evaluations.criterion` "CUSTOM" escape hatch** is a single free-text `custom_label`, not a managed lookup table — fine for a handful of academy-specific criteria, but won't scale gracefully if academies want many self-managed custom criteria with their own ordering/icons/etc.
- **RLS remains defense-in-depth only** (all server code uses the service-role client) — this is a pre-existing, documented, and accepted repo-wide pattern, not something introduced by this sprint, but worth restating: the real security boundary is every Server Action's `requirePermission`/`isBranchAccessible` call, not the database policies.

---

## 13. Recommendations for Sprint 3

1. **Competitions & Gamification completion** (per the audit's own proposed roadmap): fix the two known-dead gamification paths — `checkPerfectAttendanceAchievement()` (never called) and Student-of-the-Week's 250 XP bonus (never fires) — before building more achievement types on top of them.
2. **Student/Parent Portal UI** for the four new domains — timeline feed, evaluations history view, competitions gallery, notes (student-visible tiers only) — is the natural next step now that the data/business layer is complete.
3. **Notification digest/preference center** — 5 new notification types were added with zero UI to manage preferences; `notification_preferences`/`notification_recipients` tables exist but are superseded/unused by the current `recipient_id`+`notification_reads` model. Worth reconciling before the notification surface grows further.
4. Consider a `manage_notes`-style dedicated permission if TL/instructor note-authoring rules ever need to diverge further from `manage_students`/the ad-hoc group check — reusing `manage_students` was the right call for this sprint's scope but may not stay right forever.
