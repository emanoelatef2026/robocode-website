# Parent Dashboard Redesign

Presentation-only redesign of `/portal/parent` — no business logic, queries, or database schema changed. Every data source already existed; this sprint reorganized how it's shown.

## 1. UX problems found

- **Identity shown three times.** Student name/status/branch/course-count appeared in the `ChildOverviewCard` grid ("Your Child(ren)"), again in a separate dark "Hero" banner directly below it, and a third time implicitly via the Stats row.
- **Two overlapping stat systems.** A 4-tile Stats row (Attendance, Assignments, Projects, Certificates) duplicated the quick-stats already rendered inside `ChildOverviewCard` (Courses, Attendance, Balance) for the selected child.
- **Two "recent activity" surfaces.** A "Story" grid of six `SectionPreviewCard`s (Evaluations, Competitions, Notes, Journey, Certificates, Portfolio) sat above an unrelated "Recent Activity" feed card lower on the page — both existed to answer "what happened recently," rendered as unrelated blocks.
- **"Upcoming Class" duplicated per-course scheduling.** A dedicated card repeated exactly what `LearningCard` already shows per active enrollment (next session date/time).
- **Weak hierarchy.** Alerts (payment overdue, low sessions, low attendance) were buried near the bottom of the page, after Enrollment Contracts, instead of surfacing immediately after identity.
- **Six link-only cards with no real content** (`SectionPreviewCard` grid) occupied significant vertical space while the same navigation is already one tap away in the sidebar/bottom-nav (`PARENT_NAV_ITEMS` covers every one of those routes).

## 2. Duplicate information removed

| Info | Previously shown | Now shown |
|---|---|---|
| Name / avatar / status / branch | `ChildOverviewCard` grid + Hero banner | Hero only |
| Active course count | `ChildOverviewCard` + Hero chip | Hero only |
| Attendance % | `ChildOverviewCard` + Stats row | Hero only |
| Certificates count | `ChildOverviewCard` + Stats row + Story preview card | Hero only |
| Competitions count | `ChildOverviewCard` + Story preview card | Hero only |
| Balance / financial status | `ChildOverviewCard` + Enrollment Contracts (aggregate) | Hero (aggregate) + Contracts (per-course breakdown — legitimately different granularity, kept) |
| Latest evaluation / achievement | `ChildOverviewCard` only (never appeared on the selected-child detail view before) | Hero, plus full record in the activity feed |
| Next class | "Upcoming Class" card + inside each `LearningCard` | Hero (single summary) + `LearningCard` (per-course detail — different granularity, kept) |
| Recent evaluations/competitions/notes/attendance/certificates | Split across the Story grid (link previews) and the Recent Activity card (event feed) | One merged, date-sorted `RecentActivityFeed` |

## 3. Layout improvements

New top-to-bottom flow: **Hero → Alerts/Feedback prompt → Current Learning → Recent Activity → Enrollment Contracts.**

- **One Hero** (`ParentHero`), full width, dark navy gradient matching the Student Portal's `HeroHeader` visual language: avatar, name, status, branch on the left; a "Next Class" mini-card on the right; a wrapped row of stat chips (courses, attendance, assignments, certificates, competitions, balance); a highlights line for latest evaluation/achievement. Everything the old grid + banner + stats row + upcoming-class card showed, in one component.
- **Alerts moved directly under the Hero** (previously below Enrollment Contracts) so anything actionable (overdue payment, low sessions, low attendance, pending feedback prompt) is seen before scrolling.
- **Story grid removed**, replaced by one `RecentActivityFeed` card merging attendance/homework/portfolio/certificate events (existing `dashboard.recent_activity`) with evaluations, competitions, and notes (already-fetched arrays), sorted newest-first. Six low-content link cards became one information-dense feed.
- **"Upcoming Class" card removed** — the same information now lives in the Hero; per-course scheduling remains visible in `LearningCard`.
- Enrollment Contracts kept as the detailed/drill-down section at the bottom, unchanged functionally.

## 4. Components reused

- `LearningCard`, `ChildSelector`, `NoChildrenLinked`, `StatusBadge` — unchanged, reused as-is.
- `getChildrenOverview`, `getChildDashboardData`, `getChildEnrollmentContracts`, `getChildLearningCards`, `getChildEvaluations`, `getChildCompetitions`, `getChildNotes`, `getPendingFeedbackMilestone` — same queries, same call sites, zero business-logic changes.
- Two new presentation components were added (`ParentHero`, `RecentActivityFeed`) because no existing component covered "single dense parent summary" or "merged multi-source activity feed" — both compose only already-fetched data.
- `ChildOverviewCard.tsx` deleted — its content is now the Hero; it had no other callers (verified via repo-wide search) so it became dead code once absorbed.

## 5. Desktop improvements

- Removed one entire duplicate section (Story grid + separate Recent Activity card → one feed) and one duplicate card (`ChildOverviewCard` grid), cutting overall page height significantly on desktop without losing information.
- Hero uses the full container width with a wrapped chip row instead of fixed 2-or-4-column tile grids, so it scales cleanly from a 2-child mobile view up to a wide desktop viewport without empty tile padding.
- Alerts and Current Learning now sit directly under the Hero, so the first viewport on a standard desktop screen shows identity, key stats, next class, and anything actionable — no scrolling required for the most common parent question ("is everything OK?").

## 6. Mobile impact

- Net reduction in vertical scroll: one Hero + one alerts stack + activity feed replaces what was previously Hero + overview grid + stats row + upcoming-class card + six-tile story grid + separate activity card.
- Hero chips wrap naturally at narrow widths (`flex-wrap`), same pattern already proven on the Student Portal `HeroHeader`.
- `ChildSelector` pill switcher is untouched — multi-child switching behavior on mobile is unchanged.

## 7. Before / after summary

**Before:** Hero-like banner + full per-child overview card grid + 4-tile stats row + Current Learning + 6-tile link grid ("Story") + Enrollment Contracts + bottom-of-page alerts + a 2-column "Upcoming Class / Recent Activity" row — identity, stats, and next-class info each repeated 2–3 times across the page.

**After:** One Hero carrying all identity/status/stat/next-class/highlight information → alerts (now near the top) → Current Learning → one merged Recent Activity feed → Enrollment Contracts. No information element appears twice; every card earns its space.

## Verification

- `tsc --noEmit`: 0 errors.
- `eslint` on changed files: 0 errors (1 pre-existing warning, unrelated to this change — an already-present `Date.now()` purity lint in the alerts calculation, carried over verbatim from the prior implementation).
- `vitest run`: 478/478 tests passing.
- `next build`: succeeds, `/portal/parent` compiles as a dynamic route.
- Manual browser QA: **not completed** — this environment has no parent-portal login credentials available, and the task explicitly disallowed touching the database (so no test account could be created/reset for this session). The route was confirmed to compile and correctly redirect (307) for an unauthenticated request against the already-running dev server, but the rendered UI itself has not been visually verified in a browser. Recommend a quick manual pass with a real parent login before considering this fully verified.
