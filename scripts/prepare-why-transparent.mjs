import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const keys = ["projects", "attention", "progress", "pathway"];
const inputs = process.argv.slice(2);
if (inputs.length !== keys.length) throw new Error("Pass four image-tool cutout PNGs in projects/attention/progress/pathway order.");
const destination = resolve("public/images/why");
await mkdir(destination, { recursive: true });
for (let index = 0; index < keys.length; index++) {
  const image = sharp(inputs[index]);
  const metadata = await image.metadata();
  if (!metadata.hasAlpha) throw new Error(keys[index] + " has no alpha channel.");
  const info = await image.resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 100 })
    .toFile(resolve(destination, keys[index] + "-v2-transparent.webp"));
  const output = sharp(resolve(destination, keys[index] + "-v2-transparent.webp"));
  const stats = await output.stats();
  const alpha = stats.channels[3];
  if (!alpha || alpha.min !== 0 || alpha.max !== 255) throw new Error(keys[index] + " is not a genuine cutout.");
  console.log(JSON.stringify({ key: keys[index], width: info.width, height: info.height, bytes: info.size, alphaMin: alpha.min, alphaMax: alpha.max }));
}
