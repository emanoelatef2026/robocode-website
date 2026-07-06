# Design Handoff: Team Leader Dashboard — Bright Ops

## Overview
A full redesign of the Team Leader ("Operations Center") dashboard inside the RoboCode School LMS portal. The goal is to replace the current dense layout with a clean, modern SaaS-style dashboard ("Bright Ops") that surfaces the most critical operational information clearly: daily priorities, attendance, finance health, and group performance.

## About the Design Files
The file `TL Dashboard Redesign.dc.html` in this bundle is a **high-fidelity HTML prototype** — it shows the exact intended look, interactions, and both EN/AR layouts. It is a design reference, NOT production code. Your task is to **recreate this design inside the existing Next.js + Tailwind codebase** (`robocode_website`), reusing the existing Supabase data-fetching logic and component architecture.

## Fidelity
**High-fidelity.** Colours, typography, spacing, border-radii, and interactions should match the prototype pixel-precisely. The prototype is interactive — toggle EN/AR and Desktop/Mobile in the toolbar to see all states.

Open the prototype file in a browser (or the DC viewer) and use it as your reference throughout.

---

## Target Codebase
- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS (inline `className` utility classes)
- **Data:** Supabase (existing query functions — do not change queries, only the UI layer)
- **Root:** `robocode_website/`

---

## Design Tokens (from `app/globals.css` — already defined)
All tokens are already in the codebase. Do not invent new ones.

```
--navy:        #0B1F3A   (sidebar bg, primary text, buttons)
--navy-light:  #163560   (hover states on navy)
--orange:      #FF8A1F   (active nav, CTAs, alerts)
--orange-soft: #FFB15A   (progress bars, secondary orange)
--bg:          #F8FAFC   (page background)
--bg-card:     #FFFFFF   (card background)
--border:      #E2E8F0   (card borders)
--text:        #0F172A   (primary text)
--text-2:      #334155   (secondary text)
--muted:       #64748B   (muted/label text)
```

**Additional colours used in this design (add to globals.css :root if needed):**
```
--border-soft: #e7ebf1   (slightly stronger card border)
--green:       #10B981   (attendance present, healthy status)
--green-bg:    #F0FdF4
--green-text:  #15803D
--amber:       #F59E0B   (late attendance, watch status)
--amber-bg:    #FFF7E6
--amber-text:  #B45309
--red:         #EF4444   (absent, at-risk, overdue)
--red-bg:      #FEF2F2
--red-text:    #DC2626
--sky:         #38BDF8   (secondary accent, sessions)
```

**Typography:**
```
Body:     Poppins (already loaded via next/font)
Headings: Orbitron — for display numbers + dashboard title (Latin only)
Arabic:   Cairo   (already loaded, applied via body.font-cairo in RTL mode)
Mono:     Orbitron used for all numeric KPI values (big numbers look great)
```

---

## Screens / Views

### 1. TL Shell — Updated Header
**File:** `components/portal/team-leader/TLShell.tsx`

The current header (`h-11 / h-14`) needs new elements added:

| Element | Details |
|---|---|
| **Greeting + date** | `"Good morning, [name]"` h1 — 18px/800/`--navy`. Subtitle: date + role — 12px/500/`--muted`. Visible on desktop only. |
| **Search bar** | `bg-[#F1F5F9] border border-[#e4e9f0] rounded-[10px] px-3 py-2` — 200px wide, magnifier icon left, placeholder 12px/`--muted`. Desktop only (`hidden md:flex`). |
| **Branch chip** | `border border-[#e4e9f0] rounded-[10px] px-3 py-2 text-xs font-semibold text-[--navy]` with orange dot (7px, `--orange`) and chevron. Reads branch name from user session. |
| **Notification bell** | 38×38px, `rounded-[10px] border border-[#e4e9f0]`, bell SVG (Heroicons), red dot badge (7px) top-right if unread messages > 0. |

The greeting h1 + subtitle replace where the hamburger/logo currently sit on desktop. On mobile, keep existing logo + hamburger.

---

### 2. Sidebar — Style Tweaks
**File:** `components/portal/team-leader/TLSidebar.tsx`

Current sidebar is close to the design. Apply these changes:

| Current | Change |
|---|---|
| Active item: `bg-[#FF8A1F]/15 text-[#FF8A1F]` | **Keep** — matches design |
| Nav icon colour on active: `text-[#FF8A1F]` | **Keep** |
| Inactive: `text-white/50` | **Keep** |
| Active indicator dot: `h-1.5 w-1.5 rounded-full bg-[#FF8A1F]` | **Keep, move to ml-auto** |
| Logo area padding | Increase to `px-5 py-5` |
| Section titles (e.g. "Operations") | Change to `text-[9px] font-bold tracking-[.2em] text-white/25 uppercase` |
| User account footer | Add avatar initials circle: 28×28px, `rounded-full bg-gradient-to-br from-[#38BDF8] to-[#0B1F3A]`, font-bold 11px white initials |

---

### 3. Main Dashboard Page — Full Restructure
**File:** `app/portal/team-leader/page.tsx`

Replace the current layout with the following structure (keep all existing `async` data-fetching functions — only change the JSX return):

```
Page layout (top to bottom):
├── 1. KPI Row (4 cards) ← replaces current HeaderKPIs
├── 2. Two-column grid (desktop) / single col (mobile)
│   ├── LEFT (wider, ~1.6fr): Today's Priorities unified list
│   └── RIGHT (1fr): [Attendance Donut card] + [Finance Summary card]
├── 3. Group Health grid (3 cols desktop / 1 col mobile)
└── [DashSections for Groups, Finance, Risk, Instructors, Academic, Parents — collapsed by default]
```

**Remove:** The current `SectionNav` (pill anchor links) and `FinanceKPIStrip` (7-tile grid). Their data moves into the new Finance Summary card and KPI row.

**Keep:** All existing `<Suspense>` wrappers and server component data-fetching — just reorganise the layout.

---

### 4. New: KPICard Component
**File:** `app/portal/team-leader/_components/ui/KPICard.tsx` (new file)

A stat card with: label, big Orbitron number, delta badge, and 7-bar sparkline.

```tsx
interface KPICardProps {
  label: string
  value: string
  delta: string       // e.g. "+12" or "-2"
  deltaPositive: boolean
  bars: number[]      // 7 values 0–100 (percentage heights)
  barColor: string    // hex
  href?: string       // optional link wrapper
}
```

**Card styles:**
```
Container:   bg-white border border-[#e7ebf1] rounded-2xl p-4
Label:       text-[11px] font-semibold text-[--muted]
Delta badge: text-[10.5px] font-bold px-2 py-0.5 rounded-full
             Positive → bg-[#E7F8EE] text-[#15803D]
             Negative → bg-[#FEECEC] text-[#DC2626]
Value:       font-['Orbitron'] font-bold text-[27px] text-[--navy] leading-none mt-2
Sparkline:   flex gap-[2.5px] items-end h-[30px] — each bar: w-[4px] rounded-sm
```

**KPIs to show (from existing `getTLKPIs()`):**
| # | Label | Value source | Bar color |
|---|---|---|---|
| 1 | Active Students | `kpis.active_students` | `#38BDF8` |
| 2 | Attendance | `kpis.monthly_attendance_pct`% | `#10B981` |
| 3 | Homework | `kpis.homework_completion_pct`% | `#FF8A1F` |
| 4 | Satisfaction | `kpis.parent_satisfaction_avg`★ | `#A855F7` |

> Sparkline bars: not available from the current KPI query (returns single values). Generate fake trend data for now using `[prev5sessions attendance]` if available, or render flat bars at the current value. A separate sparkline query can be a follow-up sprint.

---

### 5. Attendance Donut Card
**File:** New component or inline in page — `AttendanceDonutCard`

Uses data from existing `getTodayAttendanceSummary()` (present/absent/late).

```
Card:     bg-white border border-[#e7ebf1] rounded-2xl p-5
Title:    "Today's Attendance" — 13.5px/700/--navy
Donut:    104×104px div, border-radius:50%, conic-gradient:
          present → #10B981 (from 0 to presentPct)
          late    → #F59E0B (presentPct to presentPct+latePct)
          absent  → #EF4444 (rest)
Center:   position:absolute inset-[13px] bg-white rounded-full
          Orbitron 22px bold --navy "N%" + 9.5px muted "present"
Legend:   3 rows: coloured 9×9px rounded-[3px] square + label + right-aligned Orbitron number
```

---

### 6. Finance Summary Card
**File:** New component — `FinanceSummaryCard`

Uses data from existing `getDashboardFinanceSummary()`.

```
Card:     bg-white border border-[#e7ebf1] rounded-2xl p-5
Title + "View all →" link (orange, 11px)

Two mini tiles (flex row):
  "Collected Today" → green bg (#F0FdF4), green border, green Orbitron value
  "This Month"      → bg-[#F8FAFC], standard border, navy Orbitron value

Collection rate row:
  Label "Collection rate" left, Orbitron % right
  Progress bar: h-[7px] bg-[#eef1f6] rounded, fill gradient (#FF8A1F → #FFB15A)
  Alert if rate < 70%: bar turns red

Outstanding row (border-top):
  Label left, Orbitron EGP value right, red (#DC2626) if > 0
```

---

### 7. Today's Priorities — Unified List
**File:** `app/portal/team-leader/_sections/TodayActionCenter.tsx` — replace card-based grid with a unified list inside a single card

**Container card:**
```
bg-white border border-[#e7ebf1] rounded-2xl overflow-hidden
Header: orange clock icon (30×30px bg-[#FFF1E2] rounded-[9px]) + title + sub-count + "View all"
```

**Each row:**
```
display: flex items-center gap-[13px] px-[18px] py-[12px] border-t border-[#f1f4f8]
├── Severity rail: w-[4px] self-stretch rounded-[4px] (colour per type — see below)
├── Icon bubble: 34×34px rounded-[10px] (bg tinted from rail colour), SVG icon
├── Text block: title 12.5px/600/--navy, subtitle 11px/--muted
├── Meta value: Orbitron 12.5px (time / amount / tag), colour per severity
└── Action button: 11px/700, 7px 13px padding, rounded-[9px]
```

**Type → colour mapping:**
| Type | Rail | Icon bg | Action style |
|---|---|---|---|
| session | `#38BDF8` | `#E6F6FE` | Navy pill |
| overdue | `#EF4444` | `#FEECEC` | Light red pill |
| renewal | `#F59E0B` | `#FFF7E6` | Orange pill |
| gap/alert | `#EF4444` | `#FEECEC` | Ghost pill |
| message | `#10B981` | `#E7F8EE` | Light green pill |

Show top 6 items max. Order: sessions first (sorted by `starts_in_min`), then overdue, then renewals, then gaps.

---

### 8. Group Health Grid
**File:** `app/portal/team-leader/_sections/GroupHealthBoard.tsx` — update card layout

Each group card:
```
bg-white border border-[#e7ebf1] rounded-[14px] p-[14px 15px]
Header: group name (13px/700) + status badge (10px, rounded-full)
Meta:   instructor + student count (10.5px/muted)
Bars section (2 bars side by side):
  Each: label (10px muted) + Orbitron value right + 5px progress bar
  Attendance bar color → healthColor(att): ≥90 green, ≥78 amber, else red
  Homework bar color  → same logic
```

**Status badge:**
| Condition | Label | Style |
|---|---|---|
| att ≥ 90 AND hw ≥ 80 | Healthy | bg-[#E7F8EE] text-[#15803D] |
| att ≥ 78 OR hw ≥ 65  | Watch   | bg-[#FFF7E6] text-[#B45309] |
| else                 | At risk | bg-[#FEECEC] text-[#DC2626] |

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| KPI card click | Navigate to related page (students / groups / assignments / parent-feedback) |
| Priority row action button | Navigate to existing action page (record attendance / finance student view / renew) |
| "View all" links | Navigate to existing list pages |
| Group health card click | Navigate to `/portal/team-leader/groups/[id]` |
| Branch chip (desktop header) | Open existing `BranchFilterBar` — keep as-is |
| Notification bell | Link to `/portal/team-leader/parent-feedback` |

**Hover states (all interactive cards):**
```
hover:border-[#CBD5E1] hover:shadow-sm transition-all duration-150
```

**Loading states:**
Keep all existing `<Suspense>` fallbacks (`SkeletonCard`, `animate-pulse` divs). Match new card heights.

---

## Responsive Behaviour
| Breakpoint | Change |
|---|---|
| `md` (768px+) | Sidebar visible, 2-col main grid (1.6fr 1fr), 4-col KPI grid, 3-col group grid, header greeting shown |
| `< md` | Sidebar hidden (mobile bottom nav), single col stack, 2×2 KPI grid, search bar hidden, greeting hidden |

---

## Arabic / RTL
The codebase already supports RTL via `LanguageContext` and `dir="rtl"` + `body.font-cairo`. All new components must:
- Use logical CSS properties: `ps/pe` (padding-inline), `ms/me` (margin-inline), `rounded-s/e` (border-radius start/end)
- Never use `text-right` — use `text-end` instead
- Never use absolute `left:/right:` for layout — use `inset-inline-start/end`
- The severity rail in priority rows is always `inset-inline-start-0`

---

## Design Tokens Summary (quick-ref)
```
Radius:  cards → rounded-2xl (16px) / inner items → rounded-xl (12px) / badges → rounded-full / buttons → rounded-[9px]
Shadow:  cards → shadow-sm (default), hover → shadow-md
Border:  standard → border-[#E2E8F0], soft → border-[#e7ebf1], alert → border-[#f7d4d4]
Gap:     card grid → gap-4 (desktop) gap-3 (mobile)
Padding: main content → p-5 md:p-7, cards → p-4/p-5
```

---

## Assets
- **Logo:** `/public/logo.png` — 1000×1000 PNG with transparency. On dark (navy) sidebar: apply `brightness-0 invert`. On white: use as-is. Render at 24×24 inside a white 30×30 rounded chip on dark backgrounds.
- **Icons:** Use existing inline SVG icon set from `TLSidebar.tsx` (already defined as the `I` object). No new icon library needed.

---

## Files
```
design_handoff_tl_dashboard/
├── README.md                      ← this file (full spec)
└── TL Dashboard Redesign.dc.html  ← interactive hi-fi prototype (open in browser)
```

---

## Implementation Order (suggested sprints)

1. **Sprint 1 — Shell + Sidebar polish**
   - Update `TLShell.tsx` header (greeting, search, branch chip, bell)
   - Minor sidebar tweaks

2. **Sprint 2 — KPI + Page restructure**
   - New `KPICard.tsx` component
   - Restructure `page.tsx` layout (remove FinanceKPIStrip + SectionNav)

3. **Sprint 3 — Priority list + Right rail**
   - Update `TodayActionCenter.tsx` to unified list layout
   - New `AttendanceDonutCard` + `FinanceSummaryCard`

4. **Sprint 4 — Group Health grid**
   - Update `GroupHealthBoard.tsx` card style + progress bars + status badge

5. **Sprint 5 — Responsive + RTL**
   - Audit all new components for mobile layout
   - Verify RTL classes on all new elements
