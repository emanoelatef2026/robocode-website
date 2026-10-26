# Public website identity

Updated 2026-10-26. Scope: the visitor-facing website, not the authenticated management/learning portals.

## Shared foundation

Use the existing semantic values in `app/globals.css`, matching `design-system/tokens/semantic/color.ts`. Do not create another brand palette.

| Role | Token / rule |
| --- | --- |
| Heading / dark surface | `--navy` / `--navy-deep` |
| Primary CTA | `--orange-strong` with white text; navy hover |
| Secondary action | White, `--border`, navy text |
| Supporting link / focus | `--cyan-strong` |
| Body / supporting text | `--text`, `--text-2`, `--text-3`; muted metadata uses `--muted` |
| Canvas / card | `--bg` / `--bg-card` |
| Cards | `--radius-xl` (20px), `--shadow-card`, one-pixel token border |
| Fields | 48px minimum height, 16px text, 12px corners |
| Marketing actions | Shared `components/ui/Button.tsx`, 48px minimum height, pill radius, 14px bold text |

Orange-strong is the existing accessible orange variant, not a new color: white/bright-orange was too low-contrast for small button text. Orange remains the brand accent; cyan is not a competing primary CTA.

## Typography and hierarchy

- Keep the existing display font (Orbitron) for the hero and standalone page H1s; Poppins for Latin body, controls, section/card headings and auth forms; Cairo for Arabic.
- Homepage sections use `PublicSectionTitle`: a short, single-color H2, 26–36px, no eyebrow or marketing paragraph. This follows the owner's later explicit heading-cleanup direction and supersedes the old `SectionTitle` eyebrow/body pattern in `DESIGN.md` for active public sections.
- Standalone booking/blog headings use `PublicPageHeading`. Legal text is preserved; only its presentation changes.
- Shared controls have visible keyboard focus; reduced-motion rules are limited to the public theme.

## Boundary and migration

`PublicSiteTheme` is applied by the root layout only for the explicit allowlist in `lib/public-site/routes.ts`: homepage, booking, blog/detail pages, policies, login/recovery pages and public certificate verification. Unknown paths do not acquire the theme. The not-found component explicitly uses the public stylesheet.

Admin, Studio, student/parent/instructor/team-leader portals, account and workspace routes return their children unchanged. No global token values, authentication actions, permissions, data queries, contracts, booking payloads or financial logic were changed.

The mechanical migration `scripts/normalize-public-brand.mjs` operates on a literal public-only file allowlist, replacing legacy color literals, large shadow variants and card-radius variants. It never scans the database or walks portal directories. New components should reference tokens directly.

## Consistency changes

- Shared header actions, language buttons and 1024px navigation breakpoint; scrolling mobile menu.
- Shared footer background, readable link/text colors, 44px link targets and localized policy labels.
- Shared booking/auth/terms card and field presentation; booking now includes the same footer.
- Mobile username domain suffix moves below its input so typing is not squeezed on 320px screens.
- Owner-requested 60px square grid restored on the public canvas (5% navy), using shared CSS variables. Direct page shells are transparent; cards, forms, dialogs and the dark footer keep solid surfaces. No glow blobs or animation were restored.
- Header and mobile menu use the same opaque `--bg` color as the page canvas, retaining the previous logo sizing, navigation spacing and controls. The canvas grid does not extend into the header or mobile menu.
- Existing pathway/pricing order, approved commercial facts, official phone and no-checkout behavior retained.
- Why Robocode now uses four compact bilingual image-and-copy rows on mobile, tablet pairs and four columns desktop. The original generated 3D illustrations use navy/cyan/orange, restrained alternating brand tints and 72–80px mobile image frames. No tabs, full-width artwork, network-dependent placeholder or stacked reveal animations. Legacy CMS tabs/images remain saved but do not feed this replacement section.
- Hero uses readable Poppins/Cairo rather than Orbitron, shorter English heading, one primary pill CTA plus a quieter text link, and a 280px mobile image. Header stays on its approved plain canvas color.

## Verification limits

Latest homepage spacing revision: one responsive `--site-section-gap` (48–64px, tightened after owner review of the gap above packages) belongs to each rendered `[data-home-section]` wrapper, not simultaneous top/bottom padding on its section. Empty CMS sections reserve no space. Trust uses the same gap; hero/header clearance and card interiors are unchanged. Public-only wrapper selectors cannot affect portals. Partner logos now sit on transparent containers within one restrained cyan-tinted frame. FAQ borders use a cyan/border token mix with a stronger open state; the extra question/contact prompt beneath the FAQ has been removed in both languages. The partner panel is compacted to 20–28px block padding, 64px artwork, 80–88px rows and an 840px-wide grid, while retaining two desktop rows and mobile pairs.

Some original partner raster assets include white matte pixels. A multiply blend within an isolated light partner frame visually integrates those whites with the tint without editing/recreating source logos or using AI-generated brand marks. Source files are preserved, not claimed to have been converted to alpha-transparent files.

Design-system/public-site tests cover route isolation, shared action props, contrast and existing pathway/pricing behavior. Production build and TypeScript are checked. Browser checks cover representative desktop/mobile layouts and language changes without submitting real bookings, credentials or password changes. Existing CMS-provided content and English-only auth/form strings are not claimed to have been fully translated. Connected-browser screenshot capture is unavailable; DOM, computed styles and geometry are used, not a pixel-perfect or real-device Safari certification.
