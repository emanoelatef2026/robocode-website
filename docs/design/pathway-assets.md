# Pathway cards and comparison plans — local review

2026-10-21. Public homepage only; no portal, payment, CMS or production changes.

## Visual treatment

Cards use the shared navy headings, token surfaces, 20px corners and pill actions. A generated 3:2 cover, age badge, short title and one sentence replace the long summary and skill tags. Full approved content stays inside the accessible native roadmap dialog. Each pricing card contains its own complete inclusions and its own group/individual differences. Prices remain EGP 2,800 / 5,200 per student for **one online semester**, not the full four-semester pathway.

## Generated illustrations

Created using the built-in image-generation tool, not the API/CLI. These are illustrative generated people, not actual students or testimonials, and their alt text states this. No generated product marks, mock software screens or invented program screenshots are used. Four selected WebP covers live in `public/images/pathways/ages-*.webp` (v1 for 6–8, 12–14 and 15–17; v2 for 9–11), each under 55 KB. PNG originals remain in the generation output directory; the website uses the optimized workspace copies. The first 9–11 variant is retained but not used. Its revised v2 removes a model-added robot so the image does not imply robotics content in this software pathway.

## Original product marks

Used only to identify curriculum tools, not to imply endorsement or affiliation. Marks are downloaded unchanged, stored locally, rendered with object-fit contain and accompanied by product names and clickable first-party references in the roadmap. Generic AI/ML topics use Python rather than an invented AI logo. HTML/CSS/JavaScript steps use the real VS Code mark to identify their coding environment.

| File in `public/images/pathways/tools/` | Exact original asset URL |
| --- | --- |
| codeorg.svg | https://aiday.org/_next/static/media/cdo-logo-inverse.062eac04.svg (linked by studio.code.org sign-in) |
| scratch.svg | https://raw.githubusercontent.com/scratchfoundation/scratch-gui/develop/src/components/menu-bar/scratch-logo.svg |
| scratchjr.png | https://www.scratchjr.org/images/scratchjrlogo.png |
| kodu.png | https://www.kodugamelab.com/images/Kodu.png |
| pictoblox.svg | https://pictobloxonline-e872.kxcdn.com/static/favicon.svg (linked by pictoblox.ai) |
| app-inventor.svg | https://appinventor.mit.edu/landing_page_assets/logos/ai2-bee.svg |
| python.svg | https://s3.dualstack.us-east-2.amazonaws.com/pythondotorg-assets/media/files/python-logo-only.svg |
| colab.png | https://colab.research.google.com/img/colab_favicon_256px.png |
| vscode.png | https://code.visualstudio.com/assets/apple-touch-icon.png |
| mblock.svg | https://mblock.cc/cdn/shop/files/logo.svg?v=1716176279 |
| flutter.svg | https://flutter.dev/assets/icon_flutter.817b4a56b047d0d36b338dd9ffd44dbd.svg |
| dart.svg | https://dart.dev/assets/img/logo/dart-192.svg |

First-party source links are maintained in `lib/public-site/pathway-visuals.ts`. Recheck usage guidelines when replacing marks. Python: https://www.python.org/community/logos/ ; Flutter: https://flutter.dev/brand .

## Final generation prompts

### Ages 6

Use case: photorealistic-natural. Asset: landscape website course cover for Robocode School ages 6–8, premium educational academy. A cheerful Egyptian boy and girl aged 7 using one open laptop together at a tidy light desk, naturally curious expressions, bright contemporary home study setting with soft pale blue background and small warm orange accents. Authentic realistic skin, hands, clothing, soft daylight, professional editorial photography feel, 3:2 landscape crop, both faces fully visible, upper body and laptop, uncluttered composition legible at small card size. Laptop screen is facing away, no visible interfaces, NO text, NO logos, no invented software UI, no floating icons, no watermarks. This is an illustrative generated scene, not a real student testimonial.

### Ages 9

Use case: photorealistic-natural. Asset: premium landscape 3:2 Robocode School course card cover. Professional editorial photography feel, realistic Egyptian children, natural daylight, uncluttered light desk and pale blue background with restrained navy and orange accents. Faces fully visible with age-appropriate appearance, tidy clothes, laptop screens facing away from camera; NO text, NO logos, NO visible software interface, NO floating icons, NO watermarks. Illustrative generated scene, not a student testimonial. A cheerful Egyptian girl aged 10 and boy aged 10 collaborating over one laptop, engaged, pointing toward the unseen screen, creative game-making mood.

Final targeted edit: Edit only the small wheeled robot toy on the desk in the lower left of the image: remove the robot and replace it with the same clean white desktop continuing naturally. Keep both children, their exact faces, hands, ages, clothing, pose, laptop, background, lighting, framing and all other objects unchanged. This course teaches software games and apps, not robotics. Do not add text, logos, UI, toys or new objects.

### Ages 12

Use case: photorealistic-natural. Asset: premium landscape 3:2 Robocode School course card cover. Professional editorial photography feel, realistic Egyptian children, natural daylight, uncluttered light desk and pale blue background with restrained navy and orange accents. Faces fully visible with age-appropriate appearance, tidy clothes, laptop screens facing away from camera; NO text, NO logos, NO visible software interface, NO floating icons, NO watermarks. Illustrative generated scene, not a student testimonial. An Egyptian girl aged 13 and boy aged 13 using a laptop at a light desk, curious analytical expressions, a small paper notebook with simple non-legible pencil diagrams nearby, calm confident learning mood.

### Ages 15

Use case: photorealistic-natural. Asset: premium landscape 3:2 Robocode School course card cover. Professional editorial photography feel, realistic Egyptian children, natural daylight, uncluttered light desk and pale blue background with restrained navy and orange accents. Faces fully visible with age-appropriate appearance, tidy clothes, laptop screens facing away from camera; NO text, NO logos, NO visible software interface, NO floating icons, NO watermarks. Illustrative generated scene, not a student testimonial. An Egyptian young woman aged 16 and young man aged 16 collaborating on a laptop at a bright clean desk, sophisticated student coding workshop atmosphere, one plain smartphone resting face-down beside laptop, confident natural expressions.
