# Homepage online offer — local implementation

Date: 2026-10-21. Scope: task2, local preview only. No commit, push, deployment, database write, payment integration, or portal changes.

## Delivered

- Four bilingual public pathway cards for ages6–8,9–11,12–14,15–17, with descriptions, skills and tools.
- Each details button opens an accessible native dialog with a four-semester preview. No links to unbuilt public detail pages.
- Two homepage online-price cards: EGP2,800 per student/semester for2–4 students; EGP5,200 per student/semester for one-to-one.
- Both plans state12 classes,3 months, weekly,90 minutes, and the owner-approved STEM certificate wording. Shared benefits show LMS progress and a project portfolio.
- Explicit online-only, one-semester-not-full-pathway, and no-website-payments notes. Enquiry buttons point to the existing contact section; no message is submitted automatically.
- Public hero ages updated to6–17 in both dictionaries.
- Existing `#learning-journey` links retain an anchor in the new pathway section instead of loading the conflicting legacy roadmap.

## Content ownership / CMS integration

`lib/public-site/online-programs.ts` is the approved public-only catalog and offer source. It is not an LMS catalog, enrollment package, contract, or authoritative future checkout price service.

`resolveOnlineHomepageSections` places the new pathways/pricing after the trust strip (or hero if trust is absent), removes the superseded legacy catalog/roadmap entries, and preserves unrelated CMS visibility/order decisions. It does not update production settings or turn on hidden projects/competitions. The legacy learning-journey Studio editor does not edit the new typed catalog; bilingual CMS management remains a separate scope.

## Component contract

| Component | Purpose | States/actions |
|---|---|---|
| `ProgramsSection` | Four approved age-group cards | Default, hover, visible keyboard focus, native modal open/close. The details control is a button, not a fake navigation link. |
| Pathway dialog | Local preview until task3 creates the public pages | Native modal semantics/focus containment, labelled close button, Escape, focus restoration, body-scroll restoration, internal scroll, explicit pricing/trial actions. Interior/scrollbar clicks do not count as backdrop clicks. |
| `OnlinePricingSection` | Group and one-to-one comparison on the homepage | Enquiry anchors, no purchase/checkout state or form. |

## Design-system application

- Reuses existing CSS variables for navy, orange-strong, cyan-strong, surfaces, text, borders, radii and shadows.
- Scoped CSS module, no global typography or portal stylesheet changes. Poppins/Cairo follow the selected locale.
- Minimum48px actions,44px close control, visible focus outlines, isolated left-to-right numeric ranges and amounts within RTL.
- One column on small screens, two pathway columns on tablet, four on wide desktop. Price cards become two columns at900px.
- Readable HTML content is the primary curriculum presentation. Uncorrected posters were not published because they still say3–5 students and90–120 minutes.

## Verification evidence

- `node node_modules/vitest/vitest.mjs run tests/public-site tests/design-system`: **32 files,127 tests passed**, including22 new offer tests.
- TypeScript `--noEmit`: passed after regenerating a corrupted ignored Next dev route validator. A backup of the generated file is in the ignored `.gstack/qa-reports/online-offer/` directory.
- Local homepage returned HTTP200 and contained the four pathways and both prices in server-rendered HTML.
- Browser checked AR/EN content and correct prices, details open/close, Escape focus restoration, internal modal scrolling at320×667, and navigation from details to pricing.
- DOM layout checked at320,390,768,1024,1440: all six new cards fit; no broken anchors within the new offer. Not a claim that legacy header/navigation issues elsewhere are fixed.
- Measured action contrast: white on orange-strong5.18:1; navy/white16.52:1.
- Browser error-log sample was empty during the final check. No real booking, contact message or payment was submitted.
- Screenshot capture was unavailable in the connected browser. DOM, geometry and interactions were checked; no pixel-perfect screenshot review or real iOS/Safari certification is claimed.

## Build notes

Turbopack completed two production builds during development. A later rerun failed in the existing generated Google-font loader (`next/font/google queries have exactly one entry`, Cairo import from `app/layout.tsx`). Shared font/layout configuration and package versions were not changed to work around it. **Final verification: `node node_modules/next/dist/bin/next build --webpack` passed**, including TypeScript,160 generated pages and build traces. The default project build command is unchanged; the intermittent Turbopack failure should be checked before a later deployment.

## Deliberately deferred

- Task3: standalone public pathway pages, complete detailed roadmaps, corrected poster derivatives and pathway-aware booking.
- Later phases: legacy header/menu issues, the old footer topic labels, CMS-driven FAQ ages/translations, main WhatsApp destination and branch-map corrections, shared locale hydration/layout shift and metadata-domain review.
- Payment provider, checkout, collections, contracts, student accounts and all authenticated portals.

The original content plan remains the curriculum/commercial reference. The local preview does not constitute approval to publish pricing or accreditation statements externally.
