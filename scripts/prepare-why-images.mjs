import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Pass the generated image source directory.");
const sources = {
  projects: "exec-b996a674-bf65-4fbb-ab54-2ab2ed3857b8.png",
  attention: "exec-0e25c99e-b6d1-49e7-8fd0-3d79353d3979.png",
  progress: "exec-cc95ed2d-4703-408a-bf22-db798f95baa2.png",
  pathway: "exec-85696896-b443-4111-ad73-ffe7b83bc477.png",
};
const destination = resolve("public/images/why");
await mkdir(destination, { recursive: true });
for (const [key, filename] of Object.entries(sources)) {
  const output = resolve(destination, key + "-v1.webp");
  const info = await sharp(resolve(sourceDirectory, filename))
    .resize({ width: 384, withoutEnlargement: true })
    .webp({ quality: 82 }).toFile(output);
  console.log(key + ": " + info.width + "x" + info.height + ", " + info.size + " bytes");
}
