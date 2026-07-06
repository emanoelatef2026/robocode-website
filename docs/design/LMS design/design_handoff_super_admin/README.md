# Design Handoff: Super Admin Dashboard — RoboCode LMS

## Overview
A complete redesign of the Super Admin home page (`app/admin/page.tsx`) inside the RoboCode LMS.
The goal is a clean, professional light-identity dashboard that surfaces the most critical academy-wide KPIs, finance health, branch performance, system alerts, and quick actions — all in one scrollable page that works on both desktop and mobile.

## About the Design File
`Super Admin Dashboard.dc.html` in this bundle is a **high-fidelity interactive HTML prototype**.
Open it in a browser (or the DC viewer) to see all states:
- Toggle **EN ↔ عربي** — full RTL layout
- Toggle **Desktop ↔ Mobile** — sidebar hides, 2-col grids collapse, bottom nav appears

This is a **design reference, NOT production code**. Your task is to **recreate it inside the existing Next.js + Tailwind codebase** (`robocode_website/`), reusing all existing Supabase data-fetching logic.

## Fidelity
**High-fidelity.** Match colours, typography, spacing, border-radii, and card sizes pixel-precisely.

---

## Target Codebase
| Item | Value |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Data | Supabase (keep existing query functions — UI layer only) |
| Root | `robocode_website/` |
| Admin page | `app/admin/page.tsx` |
| Admin shell | `components/admin/AdminShell.tsx` |
| Admin sidebar | `components/admin/AdminSidebar.tsx` |

---

## Design Tokens

All base tokens are already in `app/globals.css`. Add these extras if missing:

```css
:root {
  /* Already exist */
  --navy:        #0B1F3A;
  --navy-light:  #163560;
  --orange:      #FF8A1F;
  --orange-soft: #FFB15A;
  --bg:          #F8FAFC;
  --bg-card:     #FFFFFF;
  --border:      #E2E8F0;
  --text:        #0F172A;
  --text-2:      #334155;
  --muted:       #64748B;

  /* Add if missing */
  --border-soft: #e7ebf1;
  --page-bg:     #d8deea;       /* outer page background */
  --green:       #10B981;
  --green-bg:    #F0FDF4;
  --green-bd:    #d6f0e0;
  --green-text:  #15803D;
  --amber:       #F59E0B;
  --amber-bg:    #FFFBEB;
  --amber-bd:    #f6e3c4;
  --amber-text:  #B45309;
  --red:         #EF4444;
  --red-bg:      #FEF2F2;
  --red-bd:      #FECACA;
  --red-text:    #DC2626;
  --sky:         #38BDF8;
  --sky-bg:      #EFF6FF;
  --purple:      #A855F7;
  --indigo:      #6366F1;
  --indigo-bg:   #EEF2FF;
}
```

**Typography:**
| Use | Font | Weight | Notes |
|---|---|---|---|
| Body EN | Poppins | 400–800 | Already loaded |
| Body AR | Cairo | 400–800 | Already loaded |
| All KPI numbers | Orbitron | 700 | Load via next/font or Google Fonts |

---

## Shell Changes

### AdminShell / AdminSidebar

The existing `AdminSidebar.tsx` is close. Apply these tweaks:

**Sidebar header (logo area):**
```
padding: 17px 14px 14px
gap: 10px
Logo chip: 28×28px white rounded-[7px], logo inside 22×22px
Text: Orbitron 12px/700 white, letter-spacing .04em
```

**System status bar (add below logo, above nav):**
```
height: ~30px, bg: rgba(16,185,129,.08), border-bottom: 1px solid rgba(255,255,255,.05)
Left: 6×6px green circle (pulse animation — @keyframes rcpulse)
Text: "All Systems Operational" 9.5px/600 rgba(255,255,255,.45) tracking-wider
```

**Nav section headers:**
```
font-size: 8.5px, font-weight: 700, letter-spacing: .2em,
color: rgba(255,255,255,.22), text-transform: uppercase
padding: 12px 8px 4px
```

**Nav items:**
```
padding: 7px 9px, border-radius: 8px, gap: 10px
Active:   bg rgba(255,138,31,.14)  color #FF8A1F  fw 700  icon opacity 1
Inactive: bg transparent           color rgba(255,255,255,.52) fw 500 icon opacity .55
Active indicator: 5×5px orange circle, ml-auto
```

**User footer:**
```
padding: 11px 10px, border-top: 1px rgba(255,255,255,.07)
Avatar: 30×30px rounded-full, gradient from #FF8A1F to #163560, initials 10.5px/700 white
Name: 11.5px/600 white, truncate
Role: 9.5px rgba(255,255,255,.38)
Settings icon: 13×13px rgba(255,255,255,.25)
```

### AdminTopbar (inside AdminShell main area)

```
padding: 13px 20px, border-bottom: 1px #e9edf3, bg white

Desktop:
  Left: h1 "Good morning, [name]" — 17px/800/#0B1F3A, letter-spacing -.01em
        p date + role — 12px/#64748B
  Right: search bar (200px, bg #F1F5F9, border #e4e9f0, radius 10px, px-3 py-2)
         notification bell (36×36 rounded-[10px] border #e4e9f0, red dot 7px if unread)
         avatar (34×34 rounded-full, gradient #FF8A1F → #163560, initials)

Mobile:
  Left: hamburger (18×18 icon, #475569) + logo chip + ROBOCODE text
  Right: bell + avatar (same as desktop)
```

---

## Page Structure (`app/admin/page.tsx`)

Replace the JSX return with the following structure. **Keep all existing `async` data-fetching functions unchanged.**

```
Page (flex col, overflow-y scroll, padding 22px 26px 48px desktop / 16px 14px 80px mobile)
├── 1. Alert Banner (conditional — if alertCount > 0)
├── 2. Section: TODAY (8 KPI cards, 4-col desktop / 2-col mobile)
├── 3. Section: JUNE — MONTHLY INDICATORS (4 KPI cards)
├── 4. Section: ACADEMY OVERVIEW (4 stat cards with icon + fill bar)
├── 5. Section: FINANCE (standalone card with tiles + rate bar + alert rows)
├── 6. Section: BRANCH PERFORMANCE (table card)
├── 7. Section: TOP PERFORMERS (2-col grid of performer cards)
├── 8. Section: SYSTEM ALERTS (alert row list)
└── 9. Section: QUICK ACTIONS (chip grid)
```

---

## Components to Build

### 1. `<AlertBanner />` — conditional top banner

```
Condition: show if any system alerts with level === 'critical' exist
Style: bg #FEF2F2, border #FECACA, rounded-[13px], px-4 py-3, flex items-center gap-3
Left: 8×8px red circle pulse animation
Text: "{N} items need your attention · tap to review" — 13px/500/#DC2626
Right: "View all →" link — 12px/700/#DC2626
```

---

### 2. Section Divider

```tsx
// Reusable — use before every section
<div className="flex items-center gap-2.5 mb-3">
  <span className="text-[9.5px] font-bold tracking-[.16em] text-[#94A3B8] uppercase whitespace-nowrap">
    {title}
  </span>
  <div className="flex-1 h-px bg-[#eef1f6]" />
  {right && <span className="text-[10.5px] text-[#94A3B8] whitespace-nowrap">{right}</span>}
</div>
```

---

### 3. `<KPICard />` — small stat card (Today + Monthly sections)

```tsx
interface KPICardProps {
  label: string
  value: string | number
  delta: string
  deltaUp: boolean
  bars: number[]        // 7 values 0–100
  barColor: string      // hex
  alert?: boolean       // red card variant
  href?: string
}
```

**Styles:**
```
Container:  bg-white (alert: bg-[#FEF2F2]) border (alert: border-[#FECACA] else border-[#e7ebf1])
            rounded-[10px] p-[10px_11px] cursor-pointer

Label:      text-[9.5px] font-semibold text-[#64748B] mb-[5px] truncate
Value:      font-['Orbitron'] font-bold text-[19px] leading-none
            color: alert → #DC2626, else → #0B1F3A

Sparkline:  flex items-end gap-[2px] h-[14px] mt-[7px]
            Each bar: w-[3px] rounded-[1.5px] bg-{barColor} opacity-65

Delta badge: text-[8.5px] font-bold px-[6px] py-[2px] rounded-[8px]
             Up:    bg-[#E7F8EE] text-[#15803D]
             Down (alert): bg-[#FEE2E2] text-[#DC2626]
             Neutral: bg-[#F1F5F9] text-[#475569]

Grid: 4-col desktop → grid-cols-4, 2-col mobile → grid-cols-2
Gap: gap-2  Margin-bottom: mb-4
```

**Data mapping (Today section — from existing query):**

| # | Label | Value | Bar color | Alert if |
|---|---|---|---|---|
| 1 | Sessions Scheduled | `todayStats.sessions_scheduled` | `#38BDF8` | — |
| 2 | Attendance Recorded | `todayStats.attendance_recorded` | `#10B981` | — |
| 3 | Missing Attendance | `todayStats.missing_attendance` | `#EF4444` | > 0 |
| 4 | New Leads Today | `todayStats.new_leads` | `#A855F7` | — |
| 5 | Converted Today | `todayStats.converted_today` | `#10B981` | — |
| 6 | Active Students | `academyStats.active_students` | `#FF8A1F` | — |
| 7 | Overdue Follow-ups | `leadStats.overdue_followups` | `#F59E0B` | > 0 |
| 8 | Certs This Month | `academyStats.certs_this_month` | `#38BDF8` | — |

**Data mapping (Monthly section):**

| # | Label | Value | Bar color |
|---|---|---|---|
| 1 | New Students | `monthlyStats.new_students` | `#10B981` |
| 2 | Total Leads | `monthlyStats.total_leads` | `#A855F7` |
| 3 | Converted | `monthlyStats.converted` | `#10B981` |
| 4 | Conversion Rate | `monthlyStats.conversion_rate`% | `#38BDF8` |

> Sparkline bars: if no historical array is available from the query, generate a plausible 7-bar array from a seeded pseudo-random based on the current value. A sparkline history query can be a follow-up sprint.

---

### 4. `<AcademyKPICard />` — Academy Overview card with icon + fill bar

```tsx
interface AcademyKPICardProps {
  label: string
  value: string | number
  fill: number          // 0–100 for progress bar
  icon: React.ReactNode
  iconBg: string        // hex
  iconFg: string        // hex
}
```

**Styles:**
```
Container: bg-white border-[#e7ebf1] rounded-[10px] p-[10px_11px] flex flex-col gap-[7px]

Header row: flex justify-between items-center
  Label: text-[9.5px] font-semibold text-[#64748B]
  Icon chip: 22×22px rounded-[6px] bg-{iconBg} flex items-center justify-center
             SVG icon 12×12px fill-{iconFg}

Value: font-['Orbitron'] font-bold text-[22px] text-[#0B1F3A] leading-none

Fill bar: h-[3px] bg-[#eef1f6] rounded-[3px] overflow-hidden
          Inner: width={fill}% h-full bg-{iconFg} opacity-80 rounded-[3px]
```

**Data:**
| # | Label | Value | Fill | Icon | iconBg | iconFg |
|---|---|---|---|---|---|---|
| 1 | Branches | `academyStats.branches_count` | 100 | MapPin | `#FFF1E2` | `#FF8A1F` |
| 2 | Active Groups | `academyStats.active_groups` | `groups/max_groups*100` | Users | `#EFF6FF` | `#38BDF8` |
| 3 | Instructors | `academyStats.instructors_count` | `instructors/max*100` | User | `#EEF2FF` | `#6366F1` |
| 4 | Active Students | `academyStats.active_students` | `students/capacity*100` | UserGroup | `#F0FDF4` | `#10B981` |

---

### 5. `<FinanceCard />` — Finance section (standalone full-width card)

```
Container: bg-white border-[#e7ebf1] rounded-[16px] p-[18px] mb-[22px]

Header:
  Title "Finance" — 14px/700/#0B1F3A
  Sub "Collections snapshot" — 11px/#94A3B8
  "View all →" link — 11.5px/600/#FF8A1F href="/admin/finance"

Tiles grid (4-col desktop, 2-col mobile, gap-[10px]):
  Each tile: rounded-[11px] p-[12px_13px]
  Value: Orbitron font-bold (14px for long EGP value, 20px for others)
  Label: text-[9.5px] font-semibold text-[#64748B] mt-[5px]

  Tile 1 Outstanding:     value=EGP {financeStats.outstanding}   fg=#B45309 bg=#FFFBEB bd=#f6e3c4
  Tile 2 Collection Rate: value={financeStats.collection_rate}%  fg=#15803D bg=#F0FDF4 bd=#d6f0e0
  Tile 3 Overdue Students:value={financeStats.overdue_students}  fg=#DC2626 bg=#FEF2F2 bd=#f7d4d4
  Tile 4 Due This Week:   value={financeStats.due_this_week}     fg=#B45309 bg=#FFFBEB bd=#f6e3c4

Collection rate row:
  Left label "Collection rate this month" — 11px/#64748B
  Right Orbitron value — 12px/700 green if rate≥80, amber if ≥60, red if <60
  Progress bar: h-[7px] bg-[#eef1f6] rounded-[5px]
  Fill: width={rate}% gradient from #10B981 to #38BDF8 (if healthy) or #EF4444 (if <60)
  mb-[14px]

Alert rows (flex-col gap-[7px]):
  Row 1 Overdue:  count=financeStats.overdue_students   bg=#FEF2F2 bd=#FECACA dot=#EF4444 fg=#DC2626
  Row 2 Broken promises: count=financeStats.broken_promises bg=#FFFBEB bd=#FDE68A dot=#F59E0B fg=#B45309

  Row style: flex items-center gap-[11px] rounded-[10px] p-[10px_13px]
             left: 7×7px dot, label flex-1 12px/500, count Orbitron 12px, chevron right
```

---

### 6. `<BranchPerformanceTable />` — Branch table card

```
Container: bg-white border-[#e7ebf1] rounded-[16px] p-[16px_18px] mb-[22px]

Table header row: pb-[9px] border-b border-[#f1f4f8] mb-[3px]
  Columns: Branch (flex-1) | Collection Rate (w-[120px] — desktop only) | Students (w-[60px] text-end) | Status (w-[68px] text-end)
  Style: text-[9.5px] font-bold text-[#94A3B8] uppercase tracking-[.1em]

Each branch row: flex items-center py-[11px] border-b border-[#f8fafc]
  Branch name: text-[12.5px] font-semibold text-[#0B1F3A]
  Branch meta: text-[10.5px] text-[#94A3B8] mt-[1px] (e.g. "142 students")
  Rate bar (desktop): w-[120px] px-[12px]
                      h-[5px] bg-[#eef1f6] rounded-[4px]
                      Fill: width={rate}% bg={barColor}
                      Rate text: Orbitron 10px/700 text-center mt-[3px]
  Students: Orbitron font-bold text-[14px] text-[#0B1F3A] w-[60px] text-end
  Status badge: text-[10px] font-bold px-[9px] py-[3px] rounded-full w-[68px] text-end

Status → colour mapping:
  rate ≥ 85 → Healthy:  bg=#E7F8EE  text=#15803D  bar=#10B981
  rate ≥ 70 → Watch:    bg=#FFFBEB  text=#B45309  bar=#F59E0B
  rate < 70 → At Risk:  bg=#FEF2F2  text=#DC2626  bar=#EF4444

Data source: `branchStats` array — map each branch from existing Supabase query.
On mobile: hide Collection Rate column.
```

---

### 7. `<TopPerformerCard />` — 2-col grid

```tsx
interface TopPerformerCardProps {
  tag: string           // "Top Branch" / "Most Active Instructor"
  name: string
  sub: string           // subtitle/meta
  icon: React.ReactNode
  iconBg: string
  iconFg: string
  href: string
}
```

**Style:**
```
Container: bg-white border-[#e7ebf1] rounded-[16px] p-[16px_18px] flex items-center gap-[14px]
Icon chip: 42×42px rounded-[12px] bg-{iconBg}, icon 18×18 fill-{iconFg}
Tag:   text-[9.5px] font-bold uppercase tracking-[.1em] text-[#94A3B8]
Name:  text-[14px] font-bold text-[#0B1F3A] truncate
Sub:   text-[11.5px] text-[#64748B] mt-[2px]
Right: chevron 12×12px text-[#cbd5e1]

Grid: 2-col desktop, 1-col mobile, gap-[12px]
```

**Data:**
| # | Tag | Data source | iconBg | iconFg |
|---|---|---|---|---|
| 1 | Top Branch | branch with highest `collection_rate` | `#FFF1E2` | `#FF8A1F` |
| 2 | Most Active Instructor | instructor with most sessions this month | `#EEF2FF` | `#6366F1` |

---

### 8. `<SystemAlertRow />` — Alert list

```tsx
interface SystemAlertRowProps {
  label: string
  count: number
  level: 'critical' | 'warning' | 'info'
  href: string
}
```

**Colour per level:**
| Level | bg | border | dot | text |
|---|---|---|---|---|
| critical | `#FEF2F2` | `#FECACA` | `#EF4444` | `#DC2626` |
| warning | `#FFFBEB` | `#FDE68A` | `#F59E0B` | `#B45309` |
| info | `#EFF6FF` | `#BFDBFE` | `#3B82F6` | `#1D4ED8` |

**Row style:**
```
flex items-center gap-[12px] rounded-[12px] p-[11px_15px] cursor-pointer
left: 7×7px dot  |  label flex-1 text-[12.5px]/500  |  count Orbitron 13px  |  chevron 11px opacity-40
mb-[7px] (gap via flex-col gap-[7px] on parent)
```

**Alerts to show (from existing system health / group queries):**
| # | Label | Count source | Level |
|---|---|---|---|
| 1 | Groups without instructor | `systemAlerts.groups_no_instructor` | critical |
| 2 | Groups without active course | `systemAlerts.groups_no_course` | critical |
| 3 | Overdue lead follow-ups | `leadStats.overdue_followups` | warning |
| 4 | Leads stuck in pipeline (7+ days) | `leadStats.stuck_leads` | warning |
| 5 | Active students not enrolled in any group | `systemAlerts.students_no_group` | info |

---

### 9. Quick Actions chips

```
Container: bg-white border-[#e7ebf1] rounded-[16px] p-[16px_18px]
Inner: flex flex-wrap gap-2

Each chip: border border-[#E2E8F0] rounded-[10px] bg-[#FAFBFC] px-[14px] py-[8px]
           text-[12px] font-semibold text-[#475569] cursor-pointer whitespace-nowrap
           hover:border-[#CBD5E1] hover:bg-white transition-colors

Actions:
  "+ Branch"         → /admin/branches/new
  "+ Group"          → /admin/groups/new
  "+ Instructor"     → /admin/instructors/new
  "+ Student"        → /admin/students/new
  "View Leads"       → /admin/leads
  "Finance Center"   → /admin/finance
  "Collections Queue"→ /admin/finance/collections
  "System Health"    → /admin/system-health
  "Analytics"        → /admin/analytics
```

---

## Hover States (all clickable cards)

```
hover:border-[#CBD5E1] hover:shadow-sm transition-all duration-150
```

---

## Responsive Behaviour

| Breakpoint | Layout |
|---|---|
| `md` (768px+) | Sidebar 210px visible, page padding `p-[22px_26px_48px]`, KPI grid `grid-cols-4`, Finance tiles `grid-cols-4`, performers `grid-cols-2`, branch rate column visible |
| `< md` | Sidebar hidden (mobile bottom nav), page padding `p-[16px_14px_80px]`, KPI grid `grid-cols-2`, Finance tiles `grid-cols-2`, performers `grid-cols-1`, branch rate column hidden |

**Mobile Bottom Nav (5 tabs):**
```
position: fixed bottom-0 left-0 right-0 z-20
bg-white border-t border-[#e9edf3] flex py-2 pb-3

Tabs: Home | Students | Finance | Alerts | More
Active tab: text-[#FF8A1F]   Inactive: text-[#94A3B8]
Icon 20×20, label text-[9.5px] font-semibold
```

---

## Arabic / RTL

The codebase already handles RTL via `dir="rtl"` and `body.font-cairo`. All new components must:
- Use logical CSS: `ps-/pe-` not `pl-/pr-`, `ms-/me-` not `ml-/mr-`
- Use `text-end` not `text-right`
- Use `rounded-s-/rounded-e-` for directional radius
- Sidebar: `inset-inline-start` for the active indicator dot
- All number values remain LTR (`dir="ltr"` wrapper or `tabular-nums`) — Orbitron numbers are always displayed LTR

---

## Animations

**Pulse (system status + critical alert dot):**
```css
/* Add to globals.css */
@keyframes rcpulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
.animate-rcpulse { animation: rcpulse 2s infinite; }
```

---

## Assets
- **Logo:** `/public/logo.png` — 1000×1000 PNG. On dark sidebar: `brightness-0 invert` filter. Render at 22×22px inside 28×28px white chip.
- **Icons:** Use Heroicons (already in project) or inline SVG — no new icon library.

---

## Files Summary
```
design_handoff_super_admin/
├── README.md                        ← this file (full spec)
└── Super Admin Dashboard.dc.html   ← interactive hi-fi prototype (open in browser)
```

---

## Implementation Order (suggested sprints)

### Sprint 1 — Shell polish
Update `AdminSidebar.tsx`:
- System status pulse bar
- Section header text style
- Active item dot
- User footer avatar + settings icon

Update `AdminShell.tsx` / top bar:
- Desktop greeting + search bar
- Notification bell with badge
- Mobile logo + hamburger

### Sprint 2 — KPI cards
New file: `app/admin/_components/KPICard.tsx`
- Build the component with sparklines + delta badge
- Wire `kpiToday` (8 cards) into Today section
- Wire `kpiMonth` (4 cards) into Monthly section
- Replace existing `FinanceKPIStrip` / `AdminHeaderKPIs`

### Sprint 3 — Academy Overview + Finance card
New files:
- `app/admin/_components/AcademyKPICard.tsx`
- `app/admin/_components/FinanceCard.tsx`
Wire existing `academyStats` and `financeStats` data.

### Sprint 4 — Branch table + Top Performers
New files:
- `app/admin/_components/BranchPerformanceTable.tsx`
- `app/admin/_components/TopPerformerCard.tsx`

### Sprint 5 — System Alerts + Quick Actions
New files:
- `app/admin/_components/SystemAlertRow.tsx`
- `app/admin/_components/QuickActions.tsx`

### Sprint 6 — Responsive + RTL audit
- Mobile bottom nav (check `AdminBottomNav.tsx` — may already exist)
- All grid breakpoints
- RTL logical CSS audit on all new components
