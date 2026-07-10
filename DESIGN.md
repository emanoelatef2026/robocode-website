# Robocode Design System

**Status:** Documents what's already shipped. This is not a proposal — it's a
record of the visual language currently live across the marketing site and the
LMS admin/portal platform, so future work stays consistent instead of drifting.

**Memorable thing:** Robocode should read as *serious robotics education,
delivered with energy* — navy conveys credibility and structure, orange
carries the energy of building/competing, and Orbitron headings signal "tech/
robotics" without tipping into gimmicky sci-fi.

---

## 1. Two sub-systems, one palette

The codebase has two distinct component idioms sharing one token set:

| | **Marketing site** | **Admin / LMS platform** |
|---|---|---|
| Where | `app/page.tsx`, `components/*Section.tsx`, blog | `app/admin`, `app/portal`, `app/studio` |
| Feel | Spacious, pill-shaped, glowing CTAs, motion-forward | Dense, functional, SaaS-table, minimal motion |
| Buttons | `rounded-full`, colored drop-shadow glow, `hover:-translate-y-0.5` | `rounded-[10px]` (`.ds-btn-*`), flat, no lift |
| Cards | `rounded-2xl`/`rounded-3xl`, soft branded shadows | `.ds-card` — `16px` radius, flat `#e7ebf1` border |
| Headings | Orbitron, large, centered-first | Poppins throughout, small, left-aligned |

Never mix idioms — a marketing pill button on an admin table, or a flat
`.ds-btn-ghost` on the public homepage, breaks the read. Match whichever
surface you're building in.

---

## 2. Typography

Three font families, loaded via `next/font/google` in `app/layout.tsx`:

- **Orbitron** (`--font-orbitron`) — all `h1`–`h4` by default (`app/globals.css:136`). Techy, geometric, used sparingly — headings only, never body text.
- **Poppins** (`--font-poppins`) — body font everywhere, weights 300–700.
- **Cairo** (`--font-cairo`) — Arabic companion. Activated via `body.font-cairo`; RTL headings fall back to Cairo since Orbitron is Latin-only (`app/globals.css:142-154`).

**Scale in practice** (marketing):
- Hero H1: `text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight`
- Section H2 (`SectionTitle.tsx`): `text-3xl md:text-4xl font-bold tracking-tight`, brand navy `#0B2341`
- Eyebrow label: `text-[11px] font-bold uppercase tracking-[0.28em]`, orange or navy
- Body: `text-base leading-relaxed text-[#64748B]`

**RTL rule:** `[dir="rtl"] * { letter-spacing: 0 !important }` — Arabic doesn't
use tracking, so any custom letter-spacing must be conditioned on LTR or it'll
be silently zeroed (which is correct — don't fight it).

---

## 3. Color

### Brand
| Token | Hex | Use |
|---|---|---|
| Navy | `#0B1F3A` (`--navy`), `#0B2341` on marketing | Primary text, headings, dark surfaces, `.ds-btn-primary` |
| Navy light | `#163560` | Navy hover state |
| Orange | `#FF8A1F` | Primary accent, CTAs, focus rings — *the* brand color |
| Orange soft | `#FFB15A` | Gradient/highlight companion |
| Cyan | `#38BDF8` | Secondary accent — used as marketing `primary` button color, links |

### Status (semantic, shared across attendance/groups/leads/assignments — see `components/admin/StatusBadge.tsx`)
| Status | bg | text | dot |
|---|---|---|---|
| Success (present/active/completed/graded/converted) | `#E7F8EE` | `#15803D` | `#10B981` |
| Warning (late/paused/pending/forming) | `#FFFBEB` or `#FFF1E2` | `#B45309` or `#FF8A1F` | `#F59E0B` / `#FF8A1F` |
| Danger (absent/banned/cancelled/lost) | `#FEF2F2` | `#B91C1C` | `#EF4444` |
| Info (excused/graduated/online/submitted) | `#E0F2FE` | `#0369A1` | `#38BDF8` |
| Neutral (inactive/scheduled/draft/offline) | `#F1F5F9` | `#475569` | `#94A3B8` |
| Special (makeup/waitlisted/hybrid/under review) | `#F3E8FF` | `#6B21A8` | `#A855F7` |

Adding a new status? Reuse one of these six buckets by meaning — don't invent
a new bg/text/dot triple. `StatusBadge` already has ~30 statuses mapped; check
there first.

### Surfaces & text
```
--bg: #F8FAFC        --text:   #0F172A
--bg-card: #FFFFFF    --text-2: #334155
--bg-muted: #F1F5F9   --text-3: #475569
--border: #E2E8F0     --muted:  #64748B
--border-soft: #e7ebf1 --muted-soft: #94A3B8
```

**Rule: hex in code, not Tailwind named colors.** `bg-red-50` and friends are
gone platform-wide (Phase XXXIII-B migration, ~300 files). New code uses
`bg-[#FEF2F2]` or the CSS var, never `bg-slate-100`/`bg-red-500`/etc.

---

## 4. Elevation & radius

```
--shadow-card: 0 1px 4px rgba(11,31,58,.06), 0 0 0 1px rgba(11,31,58,.04)
--shadow-sm:   0 1px 3px rgba(11,31,58,.08)
--shadow-md:   0 4px 16px rgba(11,31,58,.10)
--shadow-lg:   0 18px 50px rgba(11,31,58,.16)

--radius-sm: 8px   --radius-lg: 16px
--radius-md: 12px  --radius-xl: 20px
```

Marketing shadows deviate from the flat navy shadow above — they're colored
glows matching whatever element they sit under (e.g. orange CTA →
`shadow-[0_4px_20px_rgba(255,138,31,0.36)]`, cyan primary button →
`rgba(56,189,248,0.35)`). This is intentional: admin shadows recede, marketing
shadows announce. Keep that split.

---

## 5. Component primitives

### Admin / LMS (`app/globals.css:202-309`, class-based)
- `.ds-card` — white, `1px solid #e7ebf1`, `16px` radius, flat shadow
- `.ds-input` — `10px` radius, orange focus ring (`rgba(255,138,31,.12)`)
- `.ds-btn-primary` (navy fill), `.ds-btn-orange` (orange fill), `.ds-btn-ghost` (outline), `.ds-btn-danger`
- `.ds-table-head` on `<thead>` — bare `<th>`, no per-cell classes needed
- `.ds-table-row` on `<tr>` — bare `<td>`, includes hover state
- `.ds-skeleton` — shimmer loading state

**When building a new admin page:** use these four classes instead of
recreating border/bg/radius inline. See `project-phase33b-design-system`
memory for the exact migration rules if touching legacy pages.

### Marketing (`components/ui/Button.tsx`, prop-based variants)
- `ButtonLink`/`Button` variants: `primary` (cyan), `secondary` (white/outline), `navy` (navy fill), `ghost` (transparent)
- All: `rounded-full`, `px-7 py-3.5`, `font-bold`, `hover:-translate-y-0.5` lift + brighten
- `SectionTitle` — standardizes eyebrow + H2 + body across every homepage section; use it instead of hand-rolling section headers

---

## 6. Motion

- Marketing sections fade/rise in on scroll via Framer Motion: `initial={{opacity:0,y:20}}`, `whileInView`, `viewport={{once:true, margin:"-60px"}}`, `duration:0.6`, ease `[0.22,1,0.36,1]` (`SectionTitle.tsx` is the canonical reference).
- Buttons: `transition-all duration-300`, hover lifts `-translate-y-0.5`, active resets to `translate-y-0`.
- Admin surfaces: minimal motion — `transition: border-color .15s, box-shadow .15s` on inputs/buttons only. No scroll-triggered animation in the LMS.
- Drawers: `slide-right` keyframe, `0.22s cubic-bezier(0.4,0,0.2,1)`.

---

## 7. Internationalization

- RTL is a first-class layout mode (`[dir="rtl"]` selectors throughout globals.css), driven by `LanguageProvider`.
- Font swap is automatic: `body.font-cairo` activates Cairo for Arabic; headings fall back to Cairo in RTL since Orbitron has no Arabic glyphs.
- Marquee/scroll animations have RTL-mirrored keyframe variants (`marquee` vs `marquee-rtl`).
- New components with directional CSS (margins, borders, `text-align`) should use logical properties (`padding-inline-start`, `text-align: start`) as `blog-content` and `ds-table-head` already do — not `text-align: left`.

---

## 8. Rules for new work

1. Hex values or CSS vars only — never Tailwind named colors (`slate-*`, `red-*`, etc).
2. New status/state color → reuse one of the six semantic buckets in §3, don't invent a new one.
3. Admin/portal/studio pages → `.ds-card`/`.ds-input`/`.ds-btn-*`/`.ds-table-*`. Marketing pages → `ButtonLink`/`Button`/`SectionTitle`. Don't cross-pollinate.
4. Headings are Orbitron (Latin) / Cairo (Arabic, auto). Body is always Poppins.
5. Any new directional CSS uses logical properties, not `left`/`right`.
6. Admin shadows stay flat/navy-tinted; marketing shadows may be colored glows matching the element.
