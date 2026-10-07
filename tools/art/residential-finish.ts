/** Register the returned neutral room paintings; code owns frames and illumination. */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const source = "src/assets/creator";
await mkdir("public/images/architecture", { recursive: true });
// Measured painted rectangles in the 1254px originals. Centre-crop to the glass
// ratio, never squeeze the room or bring the generated grey margin into a window.
const regions = {
  curtains: { left: 64, top: 144, width: 1126, height: 953 },
  blind: { left: 55, top: 143, width: 1144, height: 968 },
  nets: { left: 54, top: 143, width: 1146, height: 970 },
};
for (const [name, region] of Object.entries(regions)) {
  const file = `${source}/home-window-${name}.png`;
  const meta = await sharp(file).metadata();
  if (meta.width !== 1254 || meta.height !== 1254)
    throw new Error(`${name}: remeasure registration for a changed original`);
  await sharp(file)
    .extract(region)
    .resize(468, 396)
    .webp({ quality: 90, effort: 6 })
    .toFile(`public/images/architecture/home-window-${name}.webp`);
  console.log(name, region, "→ 468×396, 1.3×1.1 m");
}
const masonry = `${source}/home-masonry.png`;
const meta = await sharp(masonry).metadata();
if (meta.width !== 1254 || meta.height !== 1254) throw new Error("Remeasure masonry tile");
await sharp(masonry)
  .resize(512, 512)
  .webp({ quality: 90, effort: 6 })
  .toFile("public/images/materials/home-masonry.webp");
const stats = await sharp("public/images/materials/home-masonry.webp").stats();
console.log(
  "Masonry: 2×2 m; mean",
  stats.channels.slice(0, 3).map((c) => Math.round(c.mean)),
);
