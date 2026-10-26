# Homepage refinement — phased local review

Scope: public website only. Keep existing header/background decisions, approved course/pricing facts, original software logos, and no checkout. Do not modify portals or publish before local review.

## 1. First impression — implemented locally, awaiting owner review

- Compact hero after spacing review: desktop composition capped at 1120px, 360px artwork, 32px column gap, 132px top clearance for the existing header and 16px bottom spacing. Mobile layout remains unchanged. No fixed section height.
- One CTA pair directly after the copy on every viewport, before artwork in mobile reading order.
- Short English/Arabic copy. Preserve CMS-selected image with bundled fallback.
- Four published figures become one static definition-list strip: 2 columns mobile, 4 from 640px. Owner-requested 20px navy line SVGs sit beside the values in the same row, preserving row height and number size. Icons are decorative, hidden from assistive technology, with no images, extra library, backgrounds or animation. No individual shadows, hover jumps or heading tags for numbers.
- Assets: reuse existing hero for this stage. A new generated image is not needed simply to resize it.
- Checks: English/Arabic content, CTA destinations, image fallback and component tests. Updated mobile hero visually reviewed in the browser; AR/EN geometry checked at 320, 390, 768 and 1440px.
- Existing figures (6+, 8000+, 16000+, 4.9/5) retained, not verified or increased. Obtain business evidence and rating source before final publication approval.

## 2. Why Robocode — implemented locally, awaiting owner review

- Replace large tab/image interaction with four concise, immediately readable benefits: practical projects, 2–4 student groups, visible progress, age/level-appropriate pathway.
- Updated after owner review: four always-visible image-plus-copy rows on mobile, pairs from 640px and four columns from 1024px. Generated miniature 3D scenes replace line icons, following iSchool's horizontal mobile pattern without copying its assets. Short heading and sentence, no carousel or tabs.
- Curated AR/EN copy is in `messages/{ar,en}.json` under `why.compact`. No client fetch, so no CMS placeholders or default-English tab flash.
- Legacy CMS tab/image records, API and admin editor are untouched. They are retained but no longer control this redesigned homepage section; further edits to the new benefit copy use the translation dictionaries.
- Imagery: four original conceptual illustrations, explicitly described as illustrative in localized alt text. No invented student results, fake certificates or fictional program logos. See `why-image-assets.md` for final prompts and saved files.
- If bespoke illustrative artwork is needed, generate from a specific approved brief and label it illustrative where relevant. Do not use generated imagery as evidence.
- Review English/Arabic and mobile before moving on.

### Design references and deliberate choices

- https://ischooltech.com/ — concise benefits, not its brand assets or copy.
- https://www.nngroup.com/articles/condense-mobile-content/ — remove filler for mobile readers.
- https://designsystem.gov.scot/components/card — short headings and summaries; avoid unnecessary card elements.
- Latest owner request supersedes the initial icon-only version. The images are constrained to 72–80px in mobile rows so they don't become full-width content blocks.
- No fixed text height or line clamping; text can grow at larger font/zoom settings. Unit tests cover AR/EN copy, all benefits being present without interaction, no CMS data dependency and responsive CSS rules.
- Browser capture recovered for the latest revision: checked both languages at 320, 390, 768 and 1440px; no horizontal overflow, all four images loaded. Captured mobile AR hero and Why views in ignored `output/preview/`. This is desktop-browser responsive QA, not real-device Safari certification. Console has no observed errors; pre-existing logo sizing and dev Fast Refresh warnings remain.

## 3. Trust and accreditations

- Audit four current accreditation records with the owner: distinguish documented accreditation from learning platforms and competitions; don't describe all logos as accrediting bodies.
- Use original logos, intrinsic proportions and visually balanced frames. Layout follows actual item count rather than always reserving four columns.
- Add concise, verified relationship descriptions. Do not invent accreditation numbers, certificates or validity dates.
- Assets: official original logo files and verification links where available; no AI-generated certification marks.

## 4. FAQ and content cleanup

Implemented locally 2026-10-26: six bilingual questions covering age/level, learning outcomes, live-class format, equipment, parent progress and getting started. Curated in `lib/public-site/homepage-faq.ts`, replacing homepage-only CMS rendering while retaining all original CMS records/API/admin. Single-column 880px accordion with native buttons, expanded/control relationships, one open answer, no category filters or motion. Declarative JSON-LD follows the displayed locale and the same six questions. Contact link retained; no payment or new certification claims.

Partners now render once each in a static semantic list, six current logos in two rows of three from 640px and pairs on mobile. Equal white frames, contain artwork, original names/links, no marquee/clones/carousel. Failed images fall back to the partner name; requests are aborted on unmount. Shared colors/focus/borders follow the public design system.

- Curate six questions; don't delete the remaining CMS records.
- Single-column accordion with one open answer; accessible expanded state, keyboard focus and reduced-motion behavior.
- Remove unhelpful category filters; localize selected questions/answers.
- Resolve current 5-vs-6 starting-age conflict against approved 6–17 pathways; confirm lifetime account and payment-method claims before changing them.
- Keep semester/pricing details in pricing cards and link to relevant policies without inventing a payment flow.
- No stock/generated images needed for FAQ.

## 5. Whole-page polish and release gate

- Review section spacing, borders, image aspect ratios and one restrained entrance effect per section.
- Align footer links with the four current pathways. No links to unfinished pages.
- Verify AR/EN at 320, 390, 768, 1024 and 1440px, navigation, roadmap dialogs, FAQ and booking links; do not submit real bookings during QA.
- Check public tests, TypeScript, production build, browser console/network and representative image loading. Measure performance rather than claiming scores.
- Record visual/browser limitations explicitly. User reviews local first; commit/push/deploy only after requested.
