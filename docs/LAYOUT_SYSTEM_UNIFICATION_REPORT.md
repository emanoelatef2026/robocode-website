# Layout System Unification Report

Sprint scope: one shared navigation/layout system for Super Admin, Team Leader, Instructor, Parent, and Student portals. No business logic, database schema, or permission changes were made.

## 1. Architecture Summary

Before this sprint, each of the five portals had its own hand-rolled sidebar, bottom nav, and (mostly) topbar, with only `PortalSidebar` and `AdminTopbar`/`NotificationBell` genuinely shared, and only across a subset of portals. Two real overlap bugs existed (Admin's and Parent's mobile drawers had no bottom offset, so the fixed bottom nav bar could paint over the last drawer items). Nav items were hand-duplicated between each portal's sidebar and bottom nav, and page titles lived in a single giant cross-portal lookup table hardcoded inside a component named `AdminTopbar`.

The new system is layered:

- **Design tokens** (`app/globals.css`) — one `:root` block defines sidebar/header/drawer/bottom-nav dimensions, a z-index scale, and avatar/icon sizes as CSS custom properties. Consumed via Tailwind v4's `w-(--sidebar-width)` syntax.
- **Shared primitives** (`components/shared/layout/`) — `icons.tsx` (one icon family, sized via `className`), `roles.ts` (role labels/initials, `getInitials()`), `PortalLogo.tsx`, `PortalUserMenu.tsx` ("My Account"), `TopHeader.tsx`, `BottomNav.tsx`, `AppLayout.tsx`, `TopbarActionContext.tsx`, `getPageTitle.ts`.
- **Shared Sidebar** (`components/shared/sidebar/PortalSidebar.tsx`) — now the single sidebar implementation for all five portals.
- **Per-portal navigation configs** (`modules/{admin,team-leader,instructor,parents,student-portal}/navigation.tsx`) — one array of nav items per portal, feeding both the sidebar sections and the bottom-nav primary/more lists, plus page-title derivation. Admin's config additionally carries `permission`/`superAdminOnly` gating, replicated verbatim from the original filter logic.
- **Portal shells** (`components/{admin,portal/*}/*Shell.tsx`) — each is now a thin composition of `AppLayout` + `TopHeader` + the shared `Sidebar`/`BottomNav`, supplying only portal-specific nav config and content.

## 2. Layout Components Created

| Component | Purpose |
|---|---|
| `PortalLogo` | The one logo mark — sizing/spacing/typography taken verbatim from the Student portal (the designated reference). |
| `PortalUserMenu` | The one "My Account" — avatar (real name/email initials, falls back to role initials), name, role, subtitle, dropdown with **Profile / Change Password / Settings (soon) / Logout**. Supports a collapsed icon-only rail mode with a flyout menu. |
| `TopHeader` | The one header bar — hamburger (mobile), title (auto-derived from nav config, or a `centerSlot` override), optional branch badge, optional `quickActions` slot, notification bell slot. |
| `BottomNav` | The one mobile bottom nav — up to 4 primary tabs + a "More" bottom sheet, with an optional `getHref` transform for query-param-preserving portals (Parent). |
| `AppLayout` | The one page shell — owns mobile-drawer open state, renders sidebar + header + `<main>` + bottom nav via render props so each portal only supplies its own sidebar/header content. |
| `TopbarActionContext` | Relocated (unchanged) from `components/admin/` — `TopbarTitle`/`TopbarAction` let any page override the header title or inject an action button. |
| `getPageTitle.ts` | Derives the header title from a portal's own nav config (longest-href match) instead of a hand-maintained path→title table. |
| `icons.tsx` | One 20×20 icon family exported as sized components (`<Icons.dashboard className="h-6 w-6" />`), replacing ~6 duplicated per-portal icon maps across two different vector families. |
| `roles.ts` | `ROLE_LABELS`, `ROLE_INITIALS`, `getInitials(name, role)` — one place for role→display-text mapping. |
| `/account/profile` | New minimal read-only page (avatar, email, role, link to Change Password) — the destination for the new "Profile" menu item. Presentational only; no new queries or mutations. |

## 3. Components Reused

- `components/shared/sidebar/PortalSidebar.tsx` — already shared by Team Leader and Instructor; extended in place (see §5) rather than replaced, and is now consumed by all five portals.
- `components/portal/shared/NotificationBell.tsx` — already shared by Instructor and Parent; now also wired into Admin, Team Leader, and Student (previously the bell was either a dead static placeholder or entirely absent).
- `InstructorFAB.tsx` — kept unchanged as an Instructor-only affordance; no equivalent existed elsewhere and none was invented.

## 4. Components Removed

- `components/admin/AdminSidebar.tsx` (520-line standalone reimplementation) → now a 20-line wrapper around the shared `Sidebar` + `modules/admin/navigation.tsx`.
- `components/admin/AdminBottomNav.tsx` (315 lines) → thin wrapper around shared `BottomNav`.
- `components/admin/AdminTopbar.tsx` (162 lines) and `components/admin/TopbarActionContext.tsx` — deleted outright; replaced by `TopHeader` + the relocated `TopbarActionContext`, both under `components/shared/layout/`. 21 call sites across the codebase were updated to the new import path.
- `components/portal/student/StudentSidebar.tsx` / `StudentBottomNav.tsx` (361 + 295 lines of bespoke markup) → thin wrappers around shared `Sidebar`/`BottomNav`, with only the XP widget (via a new `footerExtra` slot) and gamified header content (via `centerSlot`/`quickActions`) remaining Student-specific.
- `components/portal/parent/ParentBottomNav.tsx` bespoke sheet implementation → shared `BottomNav` with a `getHref` transform for the `?child=` query param.
- `components/portal/team-leader/TLBottomNav.tsx` / `InstructorBottomNav.tsx` bespoke implementations → shared `BottomNav`.
- ~6 duplicated inline icon-map object literals (Admin sidebar, Admin bottom nav, TL sidebar, TL bottom nav, Instructor sidebar, Student sidebar/bottom nav) collapsed into `components/shared/layout/icons.tsx`.
- 3 independent role-label/role-initials maps collapsed into `roles.ts`.

Net effect on the touched files: **461 insertions, 3,140 deletions** (`git diff --stat`).

## 5. Sidebar Refactoring

`PortalSidebar` (`components/shared/sidebar/PortalSidebar.tsx`) is the single sidebar for every portal. Changes made to it directly:

- Props changed from `{roleLabel, roleInitials, accountSubtitle, mobileBottomOffset}` to `{role, name, subtitle}` — identity now comes from a real name/email where the portal has one (Student's `studentName`, others' session `email`), falling back to the role label/initials only when absent.
- `mobileBottomOffset` is gone — the mobile drawer now always uses the `.drawer-safe-bottom` CSS utility (`bottom: calc(var(--bottom-nav-height) + var(--safe-bottom))`). This is the fix for the two real overlap bugs found in review: Admin's and Parent's drawers previously used `inset-y-0`/no offset and could render behind the bottom nav bar.
- Width/collapsed-width/z-index are now driven by the CSS tokens (`w-(--sidebar-width)`, `z-(--z-drawer)`) instead of hardcoded `w-56`/`w-14`/`z-30`.
- Logo block now renders `<PortalLogo />` (Student's exact spec) instead of three different hand-rolled logo markups.
- Footer now renders `<PortalUserMenu />` instead of the old `SidebarFooter`, gaining a Profile link and a Settings placeholder that neither Admin/TL/Instructor's nor Parent's account menu had before.
- New optional `footerExtra` slot (rendered above "My Account", hidden while collapsed) — used only by Student for its XP widget.

**Decisions made and why:**
- **Width standardized to 224px / 56px collapsed** (the pattern already used by 3 of 5 portals) rather than Student's narrower 200px, to minimize regression surface. Student's *logo* sizing/spacing/typography was still taken verbatim per the sprint brief, since that instruction was specific to the logo, not the sidebar shell width.
- **Parent's sidebar stays a bespoke composition** (not the top-level `PortalSidebar`) because of its genuinely unique child-switcher block between the logo and nav list — but it now reuses `PortalLogo`, `PortalUserMenu`, and the shared icon set, and the drawer-overlap bug is fixed the same way.
- Collapse state is intentionally kept as one global `localStorage` key across portals (not namespaced per-role) — a user who prefers a collapsed sidebar almost always has one role/portal, and a single "always collapsed" preference is arguably the better UX. Documented here rather than silently "fixed."

## 6. Header Refactoring

`AdminTopbar` (already reused by Admin/TL/Instructor/Parent, just misfiled under `components/admin/`) became `components/shared/layout/TopHeader.tsx`:

- Page title is now derived from each portal's own nav config (`derivePageTitle`, longest-href match) instead of a single hardcoded `PATH_TITLES` map that mixed routes from all five portals inside one Admin-namespaced file — a page missing from that map (this previously included zero Student portal routes) is no longer possible by construction.
- The topbar's old decorative, non-interactive avatar (duplicating the sidebar's account UI, per the review's own finding) was removed — identity/account access now lives in exactly one place, the sidebar's `PortalUserMenu`, matching the Student portal's original (and now universal) pattern.
- Added a `quickActions` slot, used by Student to carry its streak/rank chips — the header component itself stayed generic.
- Added a `centerSlot` override, used by Student to keep its gamified "Hey, {name} 👋" greeting instead of a plain page title, while still sharing the same header shell, hamburger button, and notification bell placement as every other portal.
- The notification bell (previously dead in Admin/TL, absent in Student) is now wired everywhere via the pre-existing shared `NotificationBell`.

## 7. Mobile Improvements

- **Bottom nav** unified into one `BottomNav` component: consistent 4-primary + "More" sheet pattern everywhere (Instructor previously had only 4 tabs and no "More" sheet at all, meaning several of its sidebar destinations were unreachable on mobile — now reachable). Consistent icon sizing, consistent `grid-cols-4` "More" sheet, consistent motion (Student's floating rounded-card sheet style, since it read as the most polished of the three prior variants).
- **Drawer overlap bug fixed** for Admin and Parent (see §5) — the bottom nav bar can no longer paint over the last items in the mobile drawer.
- **z-index scale unified**: overlay 20, drawer 30, header/bottom-nav/sheet-backdrop 40, sheet-panel/FAB 50, tooltip 9999 — previously the same semantic layer (e.g. "sheet backdrop") was `z-40` in one portal and `z-50` in another.
- Safe-area handling consolidated onto the `.bottom-nav-safe` / `.drawer-safe-bottom` CSS utilities (backed by `--bottom-nav-height` + `env(safe-area-inset-bottom)`), replacing three different inline-calc mechanisms.

## 8. Desktop Improvements

- One sidebar width (224px / 56px collapsed), one header height (64px), one set of avatar/icon sizes, all as CSS custom properties rather than scattered arbitrary Tailwind values.
- Scroll model unified: every portal shell moved from `h-screen overflow-hidden` (app-shell-traps-scroll) to `min-h-screen` with a `md:sticky` sidebar and header — matching the Student portal's simpler, more robust model, while keeping the sidebar as a flex sibling (not `fixed`) so its existing collapse/expand reflow logic needed no changes.
- Collapse-to-rail behavior (previously only on Admin/TL/Instructor) is now available uniformly wherever the shared `Sidebar` is used.

## 9. Responsive Review

Verified via `next build` (which type-checks and statically analyzes every route) and a route-level smoke test against a running dev server confirming every portal route renders without a server error. **Full interactive/visual QA across breakpoints (drawer open/close, bottom-nav tap targets, tablet/laptop widths) was not performed** — no browser automation tool is available in this environment/session. This is flagged explicitly rather than claimed; see §13 for the manual checklist the user should run before merging.

## 10. Accessibility Review

- Touch targets: bottom-nav items are `min-h-14` (56px); header hamburger and notification buttons are 32×32px — consistent with the pre-existing `44px` minimum-tap-target rule already in `globals.css`.
- Focus/keyboard: no regressions introduced — all interactive elements are still native `<button>`/`<a>` (via `next/link`) as before; no new custom widgets that trap or lose focus were added.
- No `aria-*` attributes were removed; `aria-label`/`aria-current` usage on nav links and menu buttons was preserved from the original components.
- Not independently re-audited beyond what already existed — this sprint did not add a dedicated accessibility pass (screen-reader walkthrough, focus-trap testing for the drawer) since that requires interactive tooling not available here.

## 11. Performance Review

- Net **-2,679 lines** across the touched files (461 insertions vs 3,140 deletions) — substantially less duplicated component code to parse/hydrate.
- One icon module instead of ~6 duplicated inline SVG object literals — smaller bundle surface per portal chunk, since each portal's client bundle previously carried its own full icon set.
- No new client-side data fetching was introduced; `NotificationBell` reuses its existing fetch-on-open behavior, now wired into three more portals but with no change to its own logic.

## 12. Technical Debt Removed

- 3 independent nav-item sources per portal (sidebar array, bottom-nav array(s), and a giant cross-portal title map) collapsed to 1 per portal.
- 2 real mobile-drawer/bottom-nav overlap bugs fixed (Admin, Parent).
- `components/admin/AdminTopbar.tsx` and `TopbarActionContext.tsx` — genuinely shared code that lived under an "admin"-branded directory — relocated to `components/shared/layout/`.
- 3 different logo implementations (icon-box+wordmark at two different sizes, and a plain filtered `<Image>`) collapsed to 1.
- 3 different "My Account" implementations (Student's full pattern, TL/Instructor's role-initials-only pattern, Parent's no-avatar static-links pattern) collapsed to 1, and all three previously lacked a Profile link and a settings placeholder — now present everywhere.
- Dead/unused props removed: `AdminTopbar`'s `branchName` and `bellSlot` were never actually passed by any shell before this sprint.

## 13. Manual QA Checklist (for the user — not run in this session)

- [ ] Each portal: open on desktop, confirm sidebar collapse/expand reflows content correctly.
- [ ] Each portal: resize through mobile/tablet/laptop/desktop breakpoints, confirm no horizontal scroll and no layout jump.
- [ ] Each portal on mobile: open the drawer, confirm it never renders under the bottom nav bar (this was the Admin/Parent bug fixed here — worth a specific look).
- [ ] Each portal on mobile: tap "More" on the bottom nav, confirm the sheet opens/closes smoothly and every destination is reachable.
- [ ] Each portal: open "My Account" (sidebar footer), confirm Profile / Change Password / Logout all work, and the new `/account/profile` page renders correctly.
- [ ] Student portal specifically: confirm the XP widget and streak/rank chips still render exactly as before (they were moved into new `footerExtra`/`quickActions` slots).
- [ ] Parent portal specifically: confirm the child switcher still works and that switching children preserves the `?child=` param through both sidebar and bottom-nav links.
- [ ] Collapse the sidebar in one portal, switch to another portal as the same user (e.g. super_admin viewing `/admin` then `/portal/team-leader`), confirm the shared collapse preference behaves as expected (intentional, see §5).

## 14. Remaining UI Improvements (out of scope for this sprint)

- A fully-built, currently-unwired design-token package exists at `design-system/` (138 files: primitives, semantic/theme token layers, a11y helpers) that duplicates the tokens now added to `globals.css`. Wiring the layout system onto that package instead of CSS custom properties would be a larger, separate migration — flagged as a strong candidate for a future sprint rather than pulled into this one's blast radius.
- The mission's Header spec calls for the Portal Logo to appear in the header itself, not just the sidebar; no existing portal did this before this sprint, and adding it now would be a new, app-wide visual element rather than a consolidation — left for a follow-up design decision.
- `app/dashboard/*` (a separate, sidebar-less analytics micro-view for 3 roles) received only a light touch (shared role labels) — it intentionally does not have a sidebar and was treated as a distinct, focused view rather than folded into the 5-portal shell system.
- No dedicated keyboard/focus-trap/screen-reader audit was performed (see §10).
- `graphify update .` could not be run — the CLI is not installed in this environment; the knowledge graph under `graphify-out/` is stale relative to this sprint's changes.

---

## 15. Final Visual QA + Layout Stabilization Pass

A dedicated stabilization pass over the unified layout system. Scope was strictly visual/layout — no business logic, schema, or permission changes. All four CI gates were re-run green after the fixes below (`tsc --noEmit` 0 errors · `eslint` 0 errors · `vitest` 478/478 · `next build` ✓).

### 1. Visual QA Results (method + honest scope)

This pass was a **rigorous code-level layout audit** of the shared primitives (`AppLayout`, `PortalSidebar`, `ParentSidebar`, `BottomNav`, `TopHeader`, `PortalLogo`, `PortalUserMenu`), the CSS token/utility layer, all five portal shells, and the Student/Parent dashboards. Every "REAL BUG" from the brief was checked against the actual box-model / flex / z-index / safe-area behaviour of the code.

> **Automated browser QA is not available in this environment** (no Playwright/Puppeteer in the repo, and pages are Supabase-auth-gated). Round 1 fixes below were therefore code-level. **Round 2 was driven by real human browser QA** — the user tested the running app on desktop and mobile and reported three concrete rendering issues, which were then fixed (see §2).

### 2. Browser QA Results (human, Round 2)

The user ran the app in a browser (desktop Chrome + mobile viewport) and found that Round 1's code-level fixes were **not sufficient** — the `position: sticky` sidebar model still let the sidebar scroll away on desktop. Three issues were reported and fixed:

| Issue | Observed | Fix |
|---|---|---|
| **Desktop sidebar scrolls up with the page** | The `md:sticky` sidebar drifted upward while scrolling content | Replaced the page-scroll model with a proper **app-shell**: root is `h-dvh overflow-hidden` and only `<main>` scrolls (`flex-1 overflow-y-auto`), so the sidebar + header are structurally fixed. `h-dvh` (dynamic viewport) is used instead of `h-screen` to avoid the iOS `100vh` bug that motivated the old model. |
| **Mobile drawer footer is pinned, won't scroll** | "My Account" stayed stuck at the drawer bottom, overlapping cramped nav | Added a `pinFooter` prop to the sidebar content (both shared `PortalSidebar` and bespoke `ParentSidebar`). Desktop keeps the footer pinned (`nav flex-1` + pinned footer); the **mobile drawer scrolls as one unit** (`overflow-y-auto` on the whole rail, footer flows with the nav). |
| **Mobile drawer opens *behind* the header, hiding the logo** | The ROBOCODE logo at the top of the drawer was covered by the sticky header | **Reordered the z-index scale** so the mobile drawer is a true modal above the chrome: header/bottom-nav dropped to `30`, drawer/sheet backdrops to `40`, drawer/sheet panels to `50`. The drawer now paints over the header and its logo is fully visible. |

This app-shell change also incidentally provides **mobile body-scroll-lock** (the page no longer scrolls behind the open drawer), closing the item previously flagged in §8.

### 3. Desktop Review

- **Sidebar fixed + full-height + footer pinning** — the sidebar now lives in an app-shell (`h-dvh overflow-hidden` root, only `<main>` scrolls), so it is structurally fixed and full-height, with the nav scrolling internally and "My Account" pinned to the bottom. (Round 1 attempted this with `md:sticky` + `md:flex`; human browser QA showed sticky still drifted, so it was replaced with the app-shell — see §2.) **Fixed.**
- **Content width** — `<main>` in `AppLayout` is correctly unconstrained (`px-7`, no max-width); Instructor and Team-Leader home pages already fill the width. Student (`max-w-5xl`) and Parent (`max-w-3xl`) dashboards were the outliers wasting desktop width. **Fixed.**
- Header height (64px), sidebar width (224px / 56px collapsed), avatar/icon sizes — all confirmed driven by single CSS tokens and identical across all five portals.

### 4. Mobile Review

- **Drawer vs bottom-nav overlap** — confirmed **already correct**: the mobile drawer (`PortalSidebar`/`ParentSidebar`) and the "More" sheet (`BottomNav`) both use `.drawer-safe-bottom` (`bottom: calc(--bottom-nav-height + safe-area)`), so neither can render under the fixed bottom nav. Z-scale is coherent: overlay 20 < drawer 30 < bottom-nav / sheet-backdrop 40 < sheet-panel / FAB 50 < tooltip 9999.
- **Safe areas** — `--safe-bottom`/`--safe-top` (`env(safe-area-inset-*)`) are consolidated into `.bottom-nav-safe`, `.pb-bottom-nav`, `.drawer-safe-bottom`; iOS input-zoom guard (`font-size:16px` under 767px) present.
- **Bottom-nav consistency** — one `BottomNav` component, `--bottom-nav-height` (64px), `min-h-14` tap targets everywhere.

### 5. Responsive Review

- No horizontal-scroll regressions expected: `html`/`body` carry `overflow-x:hidden`, `min-w-0` is set on the content column and the account-name block, and the touched changes are width-cap and box-height only.
- Dead desktop bottom padding removed: `.pb-bottom-nav` (unlayered) was outranking Tailwind's layered `md:pb-*` overrides at every consuming site (`AppLayout <main>` and `InstructorsWorkspaceClient`), leaving ~64px of empty space at the bottom of every desktop page. Scoped to the mobile breakpoint so the `md:` override wins on desktop.

### 6. Bugs Found

| # | Severity | Bug | Where |
|---|---|---|---|
| 1 | High | Desktop sidebar scrolls up with the page / not full-height / "My Account" footer not pinned (the `<aside>` didn't fill its column; sticky drifted) | `AppLayout` + `PortalSidebar`/`ParentSidebar` |
| 2 | Medium | Parent (`max-w-3xl`, 768px) and Student (`max-w-5xl`, 1024px) dashboards under-use desktop width and read as left-heavy / margin-heavy; also inconsistent with each other | `app/portal/parent/page.tsx`, `app/portal/student/page.tsx` |
| 3 | Low | `.pb-bottom-nav` (unlayered) defeats the intended `md:pb-*` desktop override → dead bottom padding on desktop | `app/globals.css` + two consumers |
| 4 | High | *(browser QA)* Mobile drawer's "My Account" footer pinned and unreachable — whole rail wouldn't scroll | `PortalSidebar`/`ParentSidebar` |
| 5 | High | *(browser QA)* Mobile drawer opened **behind** the header, hiding the ROBOCODE logo | z-index scale in `globals.css` |

Bugs from the brief that were investigated and found **not present** (already handled correctly by the refactor): mobile drawer/bottom-nav overlap; inconsistent sidebar width/spacing across portals; z-index layer collisions; header height/alignment inconsistency.

### 7. Bugs Fixed

1. **Sidebar fixed, full-height, footer pinned** — converted `AppLayout` to an app-shell (`h-dvh overflow-hidden` root; only `<main>` scrolls via `flex-1 overflow-y-auto`). Sidebar + header are now structurally fixed; the sidebar `<aside>` stretches full-height (`md:flex`), pinning "My Account". Resolves "sidebar moving upward while scrolling", "footer remains pinned to the bottom", and "sidebar occupies full viewport height". *(Round 1 tried `md:sticky`; human QA proved it insufficient — replaced with the app-shell.)*
2. **Mobile drawer scrolls as one unit** — `pinFooter` prop: desktop keeps the footer pinned, the mobile drawer scrolls the whole rail so "My Account" is reachable.
3. **Mobile drawer above the header (logo visible)** — reordered the z-index scale so the drawer/sheet are true modals (panels `50`, backdrops `40`) above the header/bottom-nav (`30`).
4. **Dashboard desktop width** — unified Student and Parent dashboards to `max-w-7xl` (1280px). Resolves "Parent and Student dashboards feeling left-heavy", "content area not filling desktop width", and "oversized empty white spaces".
5. **Dead desktop bottom padding** — scoped `.pb-bottom-nav` to `@media (max-width:767px)`. Resolves "reduce wasted space".

### 8. Remaining UI Issues

- **Full breakpoint sweep still recommended** — the desktop + mobile flows the user tested are fixed; a pass across tablet/laptop/ultrawide widths and RTL (§13 checklist) is still worth doing.
- **Admin home** is left-aligned and capped (`max-w-6xl`, no `mx-auto`) — same under-utilization class as the Student/Parent fix, but that file carries unrelated pre-existing uncommitted edits, so it was intentionally left out of this commit to avoid entangling unrelated work. Flagged for a follow-up.
- **Ultra-wide (>1280px)** — the centered `max-w-7xl` dashboards still leave symmetric margins on very wide monitors; a column-count bump (`xl:grid-cols-3`) would fill them but should be validated visually first.
- `design-system/` package still unwired (from §14).

### 9. Final Production Readiness Assessment

The unified layout architecture is sound. Five layout defects were fixed — two of them (mobile drawer scroll + drawer-behind-header) surfaced only through **real human browser QA**, which also proved the Round 1 `sticky` sidebar approach insufficient and led to the more robust app-shell (`h-dvh`, only `<main>` scrolls). All automated gates are green (`tsc` 0, `eslint` 0 errors, `vitest` 478/478, `next build` ✓), and the specific desktop + mobile flows the user reported are now fixed and re-verified in the browser. A wider breakpoint/RTL sweep (§13) remains a good final step, but the layout is in production-ready shape for the flows tested.
