# LMS Control Language

**Status:** Foundation specification for Admin and Team Leader portals. Apply
these rules through shared components first; do not create page-specific
variations unless the interaction genuinely differs.

## Why this exists

The LMS needs controls that read as a single working area, not individual
inputs floating on the canvas. Search, filters, menus, and secondary copy need
enough contrast and structure to be found quickly in dense operational pages.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ds-control-height-sm` | `36px` | Compact table filters and icon actions |
| `--ds-control-height-md` | `40px` | Default search, select, and button control |
| `--ds-control-height-lg` | `44px` | Mobile-first or prominent search controls |
| `--ds-control-radius` | `10px` | Inputs, selects, standard buttons |
| `--ds-toolbar-radius` | `14px` | Filter/search toolbars |
| `--ds-control-border` | `#D7E0EA` | Resting control border |
| `--ds-control-border-hover` | `#B8C6D6` | Hovered control border |
| `--ds-control-surface` | `#FFFFFF` | Default control background |
| `--ds-control-surface-subtle` | `#F8FAFC` | Search and passive hover surface |
| `--ds-control-focus` | `#0E7490` | Focus outline and active filter signal |
| `--ds-subtitle` | `#52677F` | Page description and supporting copy |
| `--ds-label` | `#475569` | Labels, menu headings, table metadata |

## Typography hierarchy

- **Page title:** 20–22px / 700. It is the main anchor, not decoration.
- **Page subtitle:** 13px / 500 / 1.45 line-height in `--ds-subtitle`.
  Do not use 11–12px pale gray for meaningful context.
- **Control label:** 12px / 600 in `--ds-label`.
- **Table/menu metadata:** 11–12px / 500. Reserve 10px only for compact
  uppercase group headings and status chips.
- **Placeholder:** `#94A3B8` only. It must never be used for actual content.

## LMS shell reference

The portal shell is the baseline visual reference for every Admin and Team
Leader page. It is intentionally quieter than the public marketing site.

- **Canvas:** `#F5F7FA`; white is reserved for a header, card, table, menu, or
  form surface that has a job.
- **Sidebar:** fixed 240px navy rail (`#07182D`). Navigation is 14px/500,
  readable at rest (`white/72`), and uses a charcoal active surface (`#302B2D`)
  with `#FF9A36` text/icon. Do not use a pale orange rectangle as active state.
- **Header:** white 64px bar with a 20px/700 Poppins page title and 13px/400
  subtitle. LMS headings use Poppins, not Orbitron.
- **Workspace:** page padding 24–28px on desktop. Surfaces use a 1px soft
  border and small shadow only when they need separation from the canvas.
- **Data tabs/tables:** headers use a muted surface. Active tabs receive one
  accent underline and stronger label; avoid a filled pill for every tab.
- **Density:** body copy is normally 14px/400 or 14px/500. Bold is reserved
  for a value, row identity, page title, or primary action, not all labels.

### KPI cards

KPI cards use white surfaces, `#D7E0EA` borders, a 12px radius, and 16px
padding. The label is 13px/400 in `#64748B`; the value is 26px/700 in navy.
Use semantic color in a KPI only when the number itself communicates a warning,
loss, or exception. Do not add colored card backgrounds or decorative dots by
default.

## Component rules

### Filter toolbar

Use `.ds-filter-bar` to group a search field, filters, and optional actions.
It is a white, bordered surface with 8px inner padding and a 14px radius.
Desktop controls wrap; on mobile each control becomes full-width. A toolbar is
the visual boundary between page context and the dataset below it.

### Search field

Use `.ds-search-field` with a search icon, 40px default height, subtle canvas
fill, and a visible cyan focus ring. A clear action is shown only when the
field has text. Live results belong in `.ds-menu`, never as unbounded content
under an input.

### Filter select

Use `.ds-filter-select` for native selects. It has a reserved chevron area,
40px default height, the same border/focus states as inputs, and a stronger
border on hover. Native selects remain intentional here: they are reliable for
keyboard, screen-reader, and mobile picker behavior.

### Legacy form baseline

All controls inside `.lms-shell` inherit Poppins, 14px text, the documented
border states, and a 40px minimum height for single-line fields. A page may
use a compact 36px control only in dense tables or toolbars, and must use the
same border/focus tokens.

### Dropdown and search results

Use `.ds-menu` as the elevated surface: white background, `#D7E0EA` border,
12px radius, and one controlled shadow. Use `.ds-menu-heading` for category
labels and `.ds-menu-item` for rows (minimum 44px target). Hover or keyboard
selection changes the row surface and text; destructive rows use the danger
semantic only.

### Hover and press behavior

- Default duration: 140ms; animate background, border, color, and shadow only.
- Primary buttons: darken one step and gain one subtle elevation shadow.
- Secondary/ghost buttons: use subtle surface fill plus a stronger border.
- Inputs/selects: strengthen the border on hover; focus uses cyan border and a
  3px transparent ring.
- Clickable rows/cards: change surface and border. Do not add colored glows,
  large lifts, or scale-on-hover.
- Press: no scale animation. A 1px `translateY` is allowed for primary
  buttons only.

## Accessibility and responsive rules

- Keep interactive targets at least 40px; use 44px for mobile-first controls.
- Every icon-only action needs an accessible name and tooltip/title.
- Keep focus visible with the cyan ring; never remove it for mouse users.
- Toolbars stack to one column below 640px, while primary actions can remain
  beside a search field only when they fit without horizontal scrolling.
- Keep menu focus in the viewport and constrain results with vertical scrolling.

## Migration order

1. Shared input, select, button, search, and menu primitives.
2. Page headers and filter toolbars across Admin and Team Leader.
3. Page-specific popovers, table action menus, and modal forms.
4. Visual QA at desktop and 375px mobile widths, with keyboard focus checks.
