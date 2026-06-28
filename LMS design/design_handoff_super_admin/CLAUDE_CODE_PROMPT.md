# Claude Code Prompt — Super Admin Dashboard

Copy everything below this line and paste it into Claude Code after `cd`-ing into the `robocode_website/` directory.

---

## PROMPT (paste below this line)

I have a design handoff package for the **Super Admin Dashboard** of the RoboCode LMS.

The design is called **"Academy Command Center — Light Identity"** — a clean, professional SaaS dashboard that surfaces academy-wide KPIs, finance health, branch performance, system alerts, and quick actions in a single scrollable page. It supports both EN and AR (RTL), and both desktop and mobile layouts.

**Reference files are in: `../design_handoff_super_admin/`**

Before writing any code:
1. Read `../design_handoff_super_admin/README.md` — this is the complete pixel-precise design spec
2. Open `../design_handoff_super_admin/Super Admin Dashboard.dc.html` in a browser — this is the interactive hi-fi prototype. Toggle **Desktop ↔ Mobile** and **EN ↔ عربي** to see all states.

---

## Codebase context
- Framework: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Admin dashboard page: `app/admin/page.tsx`
- Admin shell: `components/admin/AdminShell.tsx`
- Admin sidebar: `components/admin/AdminSidebar.tsx`
- Existing data queries are already in `app/admin/page.tsx` — **do not change any data fetching, only the UI layer**
- Design tokens are in `app/globals.css` — check README §Design Tokens for any additions needed

---

## What to implement (sprint by sprint)

### Sprint 1 — Shell polish
**`components/admin/AdminSidebar.tsx`**
- Add system status pulse bar below logo (green dot + "All Systems Operational" text)
- Update nav section headers: `text-[9px] font-bold tracking-[.2em] text-white/22 uppercase`
- Active nav item: `bg-[rgba(255,138,31,.14)] text-[#FF8A1F]` + orange 5×5px dot `ml-auto`
- User footer: add avatar initials chip (30×30 rounded-full gradient #FF8A1F→#163560) + settings icon
- Add `@keyframes rcpulse` to `globals.css` (see README §Animations)

**`components/admin/AdminShell.tsx`** (or equivalent topbar component)
- Desktop: h1 greeting ("Good morning, [name]") + date/role subtitle — left side
- Desktop: search bar (200px, bg #F1F5F9, rounded-[10px]) + bell with red dot + avatar — right side
- Mobile: hamburger + logo chip + "ROBOCODE" text — left side; bell + avatar — right side

Show me Sprint 1 result before continuing.

---

### Sprint 2 — KPI Cards
**New: `app/admin/_components/KPICard.tsx`**

Build the `KPICard` component as specified in README §3. Key measurements:
- Container: `rounded-[10px] p-[10px_11px]`
- Value: `font-['Orbitron'] font-bold text-[19px] leading-none`
- Sparkline: `h-[14px]`, bars `w-[3px] rounded-[1.5px] opacity-65`
- Delta badge: `text-[8.5px] px-[6px] py-[2px] rounded-[8px]`
- Alert variant: red card (`bg-[#FEF2F2] border-[#FECACA]`)

**`app/admin/page.tsx`** — update JSX:
- Add `SectionDivider` component (see README §2)
- Replace existing KPI display with 8×`KPICard` in a `grid-cols-4 md:grid-cols-4 grid-cols-2` grid — "TODAY" section
- Add 4×`KPICard` for "JUNE — MONTHLY INDICATORS" section
- Map data from existing query results (see README §3 Data mapping tables)

Show me Sprint 2 result before continuing.

---

### Sprint 3 — Academy Overview + Finance
**New: `app/admin/_components/AcademyKPICard.tsx`**
- Icon chip 22×22px rounded-[6px]
- Value: Orbitron 22px
- Fill bar: 3px height, colored fill at `{fill}%`
- 4 cards: Branches / Active Groups / Instructors / Active Students

**New: `app/admin/_components/FinanceCard.tsx`**
- 4 mini tiles (2×2 on mobile, 4-col desktop)
- Collection rate progress bar (gradient green→sky, or red if rate < 60%)
- 2 alert rows (overdue balances + broken promises) — see README §5

Wire all data from existing `financeStats` / `academyStats` query results.

Show me Sprint 3 result before continuing.

---

### Sprint 4 — Branch Table + Top Performers
**New: `app/admin/_components/BranchPerformanceTable.tsx`**
- Table with 4 columns; hide "Collection Rate" column on mobile
- Status badge: Healthy / Watch / At Risk (green/amber/red) based on rate thresholds (README §6)
- Mini progress bar per branch (colored by health)

**New: `app/admin/_components/TopPerformerCard.tsx`**
- 2-col grid (desktop), 1-col (mobile)
- Card 1: Top Branch (highest collection rate)
- Card 2: Most Active Instructor (most sessions this month)

Show me Sprint 4 result before continuing.

---

### Sprint 5 — System Alerts + Quick Actions
**New: `app/admin/_components/SystemAlertRow.tsx`**
- 3 severity levels: critical (red) / warning (amber) / info (blue)
- 5 alert rows wired to real data (README §8)
- Alert banner at top of page if any critical alerts exist

**New: `app/admin/_components/QuickActions.tsx`**
- Chip grid, 9 action links (README §9)
- `hover:border-[#CBD5E1] hover:bg-white transition-colors`

Show me Sprint 5 result before continuing.

---

### Sprint 6 — Responsive + RTL audit
- Mobile bottom nav: check if `AdminBottomNav.tsx` already exists; if yes update tabs to: Home / Students / Finance / Alerts / More
- Verify all new components use logical CSS (`ps-/pe-`, `ms-/me-`, `text-end`, `rounded-s-/rounded-e-`)
- All Orbitron number spans: wrap in `<span dir="ltr">` to keep numbers LTR in RTL mode
- Grid breakpoints: `grid-cols-2 md:grid-cols-4` for KPI + finance tiles
- Page padding: `p-[16px_14px_80px] md:p-[22px_26px_48px]`
- Sidebar: hidden on mobile (`hidden md:flex`), bottom nav visible on mobile only

---

## Important rules
1. **Never change data fetching** — only the JSX/TSX UI layer in `page.tsx` and new component files
2. **Use logical CSS** everywhere — RTL support is non-negotiable
3. **No new libraries** — Heroicons (already in project) for icons, no chart libraries (sparklines are plain divs)
4. **Keep all existing `<Suspense>` wrappers** — update skeleton heights to match new card sizes (~80px for KPICard)
5. **Font:** Orbitron must be loaded — check if already in `next/font` config; if not, add it
6. Work **sprint by sprint** — show result after each sprint before moving on

---

## Quick design reference (key numbers)

```
Sidebar width:        210px
KPI card radius:      rounded-[10px]
KPI card padding:     p-[10px_11px]
KPI value font-size:  19px (Orbitron 700)
KPI label font-size:  9.5px (600, #64748B)
Sparkline height:     14px
Bar width:            3px
Grid gap:             gap-2 (8px)
Section mb:           mb-4 (16px)
Card (large) radius:  rounded-[16px]
Page bg:              #d8deea (outer) / #F8FAFC (inner frame)
Sidebar bg:           #0B1F3A
Orange accent:        #FF8A1F
Alert red:            #DC2626 / #FEF2F2 / #FECACA
```

Start with **Sprint 1**. Show me the updated `AdminSidebar.tsx` and topbar first.
