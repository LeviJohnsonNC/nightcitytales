/** Rebuild the shop's neutral wall field. Code owns its openings, trim and lighting. */
import sharp from "sharp";
const source = "src/assets/creator/storefront-wall-finish.png";
const meta = await sharp(source).metadata();
if (!meta.width || !meta.height || Math.abs(meta.width / meta.height - 0.75) > 0.01)
  throw new Error("Shop wall field must have the guide's 3:4 aspect ratio");
await sharp(source)
  .resize(384, 512)
  .webp({ quality: 90, effort: 6 })
  .toFile("public/images/storefront/wall-finish.webp");
console.log(`Wall field: ${meta.width}x${meta.height} → 384x512; 2.0625 x 2.75 m`);
