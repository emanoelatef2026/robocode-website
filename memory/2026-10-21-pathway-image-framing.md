# Debug report: pathway popup image and logo framing

Status: DONE (local, not committed or deployed).

## Symptom

The pathway popup cropped its top illustration and displayed tool logos at inconsistent sizes, sometimes outside their inner frames.

## Root cause

- The popup reused the card's `object-fit: cover` in a fixed 220px-high banner. Browser evidence: 695.2 × 220 frame for a 3:2 source, causing substantial vertical cropping.
- All logos used 68 × 44 intrinsic props and percentage sizing inside an intrinsically sized grid. Source aspect ratios range from square marks to mBlock's 156 × 14 wordmark. After loading, Kodu's image box grew to 52 × 62.4 inside a 60 × 44 inner frame; the long ScratchJr wordmark became too small.
- Enlarged wordmark frames also exposed CSS Grid's default min-content row width on 320px screens, causing a 262px scroll width in a 250px dialog.

## Fix

- Dedicated `dialogCoverImage` with contain/center; its frame preserves 3:2 and is responsive up to 480px wide.
- Shared, non-clickable ToolBadge for popup logos and compact card overlays. Absolute-fill images are contained by positioned, bounded inner frames, eliminating image-driven grid sizing. Square/portrait and wide wordmark frames have separate widths. No assets or official marks were altered.
- `min-width: 0` on roadmap rows lets wide marks shrink into narrow layouts without horizontal scrolling.
- Existing Escape/close, body scroll restoration, booking/pricing actions and absence of external program links are preserved.

## Evidence

- Regression tests in `tests/public-site/pathway-image-layout.test.tsx`: initial three tests failed on the old markup/CSS, then passed after the fix; a fourth guards small-screen grid shrinking.
- Browser desktop: hero 480 × 320, contain; every logo stays inside its frame. Scratch/ScratchJr/mBlock use 160px frames; other marks use 80px frames. Wide badges shrink to 132.4px at the narrowest tested layout.
- Browser 320px, all four Arabic pathways: image ratio 1.5, no horizontal popup overflow; inner images stay contained. English/LTR roadmap also checked with no overflow.
- Full Vitest run: 117 files / 802 tests passed using `--maxWorkers=4`. Initial unconstrained run hit one unrelated 5s student-notes import timeout; no notes or portal code was changed. Worker-limited rerun passed the whole suite.
- TypeScript `--noEmit` passed; `git diff --check` passed.

No production mutation, portal change, data write or payment change was performed.
