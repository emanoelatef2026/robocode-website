# Why Robocode imagery — 2026-10-26

Generated with the built-in image-generation tool. These are conceptual 3D illustrations, not photographs of actual students, actual LMS screenshots, certificates or software logos. Localized alt text explicitly calls them illustrations.

## Saved production files

Current version (transparent cutouts; v1 files remain available, not deleted):

- `public/images/why/projects-v2-transparent.webp`: 512×512, 56,242 bytes.
- `public/images/why/attention-v2-transparent.webp`: 512×512, 69,678 bytes.
- `public/images/why/progress-v2-transparent.webp`: 512×512, 46,792 bytes.
- `public/images/why/pathway-v2-transparent.webp`: 512×512, 46,052 bytes.

Each has real alpha with minimum 0 and maximum 255, verified after WebP encoding. The desktop frame is now up to 248px, with the existing 72–80px mobile layout retained. No CSS blending, rounded image backdrop or opaque image panel is used.

### Cutout edit prompt

Built-in image tool, four separate edit calls, each original PNG supplied as the single edit target, with `transparent_background: true`:

“Use case: background-extraction. Edit target: the single attached original Why Robocode illustration. Remove ONLY the off-white studio backdrop and floor, making all empty surrounding space genuinely transparent with a real alpha channel. Preserve every foreground object exactly: same composition, proportions, camera angle, colors, surface details, laptop screen contents, faces where present, plants, accessories and the complete subject silhouettes. Do not remove white parts of the objects or backgrounds INSIDE the laptop/phone screens. Keep clean antialiased edges without white halos, no fake checkerboard, no opaque backdrop or rectangular panel. Preserve only a very subtle semitransparent contact shadow immediately under objects, no large opaque floor. Keep the same square canvas and full objects without cropping. No added objects, words, logos or stylistic changes.”

`scripts/prepare-why-transparent.mjs` validates incoming alpha, resizes and WebP-encodes the image-tool outputs while preserving alpha. It does not segment or remove backgrounds itself.

Previous opaque version:

- `public/images/why/projects-v1.webp`: 384×384, 21,256 bytes.
- `public/images/why/attention-v1.webp`: 384×384, 24,936 bytes.
- `public/images/why/progress-v1.webp`: 384×384, 18,542 bytes.
- `public/images/why/pathway-v1.webp`: 384×384, 15,310 bytes.

Original generated PNGs are retained outside the repository. `scripts/prepare-why-images.mjs` takes their source directory explicitly and only resizes/encodes final assets. No visual compositing or inpainting was performed outside the image tool.

## Final prompt set

Shared prompt: “Use case: stylized-concept. Asset type: a small raster image for the Why Robocode benefit row on a children's coding academy website. Render a detailed polished isometric 3D miniature product scene, not a flat icon or line drawing. Navy #0B203B, cyan #00B8DB, warm orange #F97316 accents, off-white #F5F7FA seamless background, soft studio shadows, centered entire scene occupies 80% of square, consistent cohesive materials. No words, no letters, no numbers, no logos, no certificate seals, no watermark. This is illustrative conceptual artwork, not a photo of a real student or actual software screenshot.”

Append one subject per separate generation call:

1. Projects: “An open navy laptop displaying a colorful small platform game world, with a little game controller beside it. A tangible miniature scene about building coding projects.”
2. Attention: “A laptop video-call scene showing three small friendly stylized learner portraits on the screen and one larger teacher portrait, with a headset beside the laptop. A tangible miniature scene about personal attention in small live classes.”
3. Progress: “An open laptop displaying simple colorful progress bars and a checkmark, with a small clipboard and pencil beside it. A tangible miniature scene about parents following learning progress, no text on screen.”
4. Pathway: “Four graduated rounded stepping platforms linked in a gentle upward route, holding a small coding laptop, a game controller, a generic robot and a mobile phone, all grounded in one coherent miniature product scene about a progressive learning pathway.”

## Responsive composition

Reference inspected in a mobile browser: https://ischooltech.com/

Use its compact horizontal image-plus-copy pattern on mobile, not its asset files or wording. Four separate rows, original images 72–80px, restrained alternating semantic brand tints. Tablet pairs from 640px; four vertically composed cards from 1024px. Desktop images now expand with the card to 224px rather than staying at 128px, with original color rendering instead of multiply blending. Responsive image sizes match this larger frame. No tabs, carousel or fixed text clipping.
