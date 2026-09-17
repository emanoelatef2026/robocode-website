# Robocode LMS — Color System Proposal

**Status:** Proposed v2 — design specification only; no production UI values are changed by this document.

**Scope:** Student, Parent, Instructor, Team Leader, Super Admin, and Studio portals.

## 1. Direction

Robocode already has a memorable identity: deep navy communicates trust and structure, cyan signals technology and learning, and orange provides energy and action. The LMS should keep that identity, but use it with product discipline:

- Navy is the structural color: shell, headings, primary text, and high-confidence actions.
- Orange is the action accent: primary calls to action, active navigation, progress emphasis, and important highlights.
- Cyan is the learning/technology accent: links, informational states, session-related data, and educational progress.
- Neutral blue-grays carry most of the interface so dashboards remain calm and readable.
- Status colors are semantic and consistent across every portal; they are never chosen ad hoc per page.
- Purple is removed from default KPI/status usage. It is reserved for a future, explicitly defined achievement domain.

This keeps the brand recognizable while making the LMS feel like a serious product rather than a collection of colored cards.

## 2. Reference principles

The proposal follows the same principles used by mature product design systems:

1. Use semantic tokens instead of hard-coded hex values. Carbon groups tokens by background, layer, field, border, text, support, focus, and skeleton; Atlassian names tokens by role, emphasis, and interaction state; GitLab separates constant palette values from semantic values so themes can change safely.
2. Keep neutrals dominant and use accent colors intentionally. This follows Carbon's layering model and is especially suitable for dense LMS tables and finance screens.
3. Treat accessibility as part of the palette. Normal text must target at least 4.5:1 contrast, large text at least 3:1, and important non-text controls/focus indicators at least 3:1.
4. Never communicate a status through color alone. Pair every status with text, an icon, or a shape change.

References:

- [IBM Carbon — Color overview](https://carbondesignsystem.com/elements/color/overview/)
- [IBM Carbon — Color tokens](https://carbondesignsystem.com/elements/color/tokens/)
- [Atlassian Design — Color](https://atlassian.design/foundations/color)
- [GitLab Pajamas — Color](https://design.gitlab.com/product-foundations/color/)
- [W3C WCAG 2.2 — Contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum)

## 3. Core palette

These are the stable primitives. Components should consume the semantic tokens in section 4, not these names directly.

| Primitive | Hex | Intended role |
|---|---:|---|
| Navy 950 | `#07182D` | Dark shell, overlay, deepest structural surface |
| Navy 900 | `#0B1F3A` | Robocode brand, headings, primary text, primary button |
| Navy 800 | `#163560` | Hover/pressed state for navy controls |
| Orange 500 | `#FF8A1F` | Logo-faithful visual accent, large icon, underline, illustration |
| Orange 700 | `#C2410C` | Accessible orange action with white text |
| Cyan 500 | `#10B6D3` | Logo-faithful visual accent and data highlight |
| Cyan 700 | `#0E7490` | Accessible cyan link/info text and control state |
| Canvas | `#F5F7FA` | LMS page background |
| Surface | `#FFFFFF` | Cards, modal panels, table body, forms |
| Surface subtle | `#F1F5F9` | Table headers, secondary panels, selected-neutral background |
| Surface strong | `#E7EDF4` | Skeletons, disabled fills, dense separators |
| Border | `#D7E0EA` | Default card/input boundaries |
| Border strong | `#94A3B8` | Active/visible boundaries where a stronger divider is needed |
| Text primary | `#0F172A` | Main copy and data |
| Text secondary | `#334155` | Supporting copy and labels |
| Text muted | `#64748B` | Metadata, helper text, table headers |
| Text placeholder | `#94A3B8` | Placeholder only; never important content |

### Why two orange/cyan steps?

The existing logo colors remain available for brand expression. They should not be forced into every control. For example, the current `#FF8A1F` with white text measures only about 2.36:1, while the proposed `#C2410C` with white text measures about 5.18:1. The bright orange stays visually recognizable, while the darker action token becomes safe for buttons and compact labels.

The same rule applies to cyan: use the bright logo cyan for large non-text accents and use `#0E7490` for small informational text or controls.

## 4. Semantic tokens

These names are the API every page and component should use.

### Surfaces and content

```text
color.background.canvas       = #F5F7FA
color.background.surface      = #FFFFFF
color.background.subtle       = #F1F5F9
color.background.strong       = #E7EDF4

color.text.primary            = #0F172A
color.text.secondary          = #334155
color.text.muted              = #64748B
color.text.placeholder        = #94A3B8
color.text.inverse             = #FFFFFF

color.border.default          = #D7E0EA
color.border.strong           = #94A3B8
color.border.focus            = #0E7490
```

### Brand and interactions

```text
color.brand.primary           = #0B1F3A
color.brand.primary.hover     = #163560
color.brand.accent            = #FF8A1F
color.brand.accent.strong     = #C2410C
color.brand.tech              = #10B6D3
color.brand.tech.strong       = #0E7490

color.action.primary.bg       = #0B1F3A
color.action.primary.bg.hover = #163560
color.action.primary.text     = #FFFFFF

color.action.accent.bg        = #C2410C
color.action.accent.bg.hover  = #9A3412
color.action.accent.text      = #FFFFFF

color.action.secondary.bg     = #FFFFFF
color.action.secondary.border = #D7E0EA
color.action.secondary.text   = #0B1F3A

color.action.focus.ring       = #0E7490
color.action.disabled.bg      = #E7EDF4
color.action.disabled.text    = #64748B
```

### Status tokens

Every status is a three-part semantic set: background, readable text, and indicator. The component must also render a text label.

| Semantic status | Background | Text/icon | Dot/indicator | Examples |
|---|---:|---:|---:|---|
| Success | `#E7F8EE` | `#166534` | `#16A34A` | Active, present, paid, completed |
| Warning | `#FFF7E6` | `#92400E` | `#D97706` | Pending, late, paused, renewal |
| Danger | `#FEECEC` | `#991B1B` | `#DC2626` | Absent, overdue, deleted, high risk |
| Info | `#E6F6FB` | `#155E75` | `#0E7490` | Online, excused, submitted, new |
| Neutral | `#F1F5F9` | `#475569` | `#64748B` | Draft, inactive, scheduled, offline |
| Achievement | `#FFF1E2` | `#9A3412` | `#C2410C` | Certificate, milestone, reward |

Do not create a new status color for a new screen. Map the business meaning to one of these buckets.

## 5. Component application rules

| Component | Default color rule |
|---|---|
| App shell/sidebar | `background.shell = #07182D`; active item uses `#FF8A1F` text/icon with a restrained translucent orange surface |
| Page background | `color.background.canvas`; never pure white for the entire page |
| Card/modal | `color.background.surface` + `color.border.default`; avoid colored borders except for a meaningful state |
| Primary button | Navy fill + white text; use for save, continue, confirm, and main navigation |
| Accent button | `#C2410C` fill + white text; use for create, issue, send, and high-attention actions |
| Secondary button | White fill + navy text + border; use for cancel, export, filter, and neutral actions |
| Inputs | White fill, default border, navy text, cyan focus ring; orange is not the default focus color |
| Tabs | Navy text; active tab gets orange underline, not a full orange block |
| Tables | White rows, subtle header surface, neutral dividers; status colors only inside status cells/badges |
| KPI cards | Neutral by default; one accent per metric family, never rainbow cards |
| Progress | Navy track/fill for completion, cyan for learning progress, orange only for attention/goal emphasis |
| Alerts/toasts | Status background + readable status text; icon and explicit message required |
| Links | `#0E7490`, underline on hover/focus; never bright cyan on white for small text |
| Empty/loading states | Neutral surfaces; use orange/cyan only as a small motion or illustration accent |
| Destructive action | Danger semantic token; never use orange for delete/archive |

## 6. Portal consistency

All portals use the same semantic tokens. They may differ in density and navigation, but not in the meaning of colors:

- Parent and Student: calmer surfaces, larger touch targets, cyan learning cues, orange rewards.
- Instructor: compact tables and attendance states with the shared status scale.
- Team Leader and Super Admin: dense data surfaces, navy structure, restrained orange actions, no decorative color noise.
- Studio: same semantic tokens, with a dark-shell variant only where the product context requires it.

## 7. Migration plan

1. Add the primitive values to `design-system/tokens/primitive/color.ts`.
2. Replace the current semantic color bindings in `design-system/tokens/semantic/color.ts`.
3. Bind `app/globals.css` foundation aliases to semantic variables.
4. Convert shared primitives first: buttons, inputs, badges, cards, tables, tabs, alerts, progress, and skeletons.
5. Migrate portal layouts and pages in this order: shared shell → Super Admin → Team Leader → Instructor → Parent → Student → Studio.
6. Remove direct color literals from migrated screens; retain literals only in primitive token files and intentional brand artwork.
7. Run contrast tests, visual regression checks, RTL checks, and mobile checks before each portal is considered complete.

## 8. Acceptance checklist

- No normal-size text uses a foreground/background pair below 4.5:1.
- Large text and meaningful non-text controls target at least 3:1.
- Bright logo orange/cyan are not used for small white text.
- Status remains understandable without color alone.
- Every portal uses the same semantic names for the same meaning.
- No random purple/pink/blue KPI accents are introduced outside an approved domain token.
- Focus is visible on keyboard and touch-relevant controls.
- Light and dark themes map semantic roles rather than reusing light-theme hex values.
- Mobile screens keep the same hierarchy and do not require horizontal scrolling to understand color-coded data.

## 9. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-16 | Keep navy/orange/cyan identity, add accessible strong steps | Preserve recognition while fixing small-text and button contrast |
| 2026-09-16 | Use semantic role tokens for all LMS UI | Enables consistent portals, theming, and safe migration |
| 2026-09-16 | Remove purple from default KPI/status usage | Reduce arbitrary color noise and keep the LMS visually mature |
| 2026-09-16 | Start with neutral-dominant surfaces | Improves scanability for tables, finance, attendance, and admin workflows |
