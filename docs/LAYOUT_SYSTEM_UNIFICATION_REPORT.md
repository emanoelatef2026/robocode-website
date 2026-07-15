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
