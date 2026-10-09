/** Bake only the pixels needed at play zoom; originals remain in creator. */
import sharp from "sharp";
const root = "src/assets/creator/";
const out = "public/images/architecture/";
await sharp(root + "repair-bench.png")
  .resize(768, 410, { fit: "fill" })
  .webp({ quality: 88 })
  .toFile(out + "repair-bench.webp");
await sharp(root + "repair-parts.png")
  .resize(512, 515, { fit: "fill" })
  .webp({ quality: 88 })
  .toFile(out + "repair-parts.webp");
// Left-aligned crop keeps the dismantled speaker; never compress the wide bench.
const parts = await sharp(root + "repair-parts.png").metadata();
await sharp(root + "repair-parts.png")
  .extract({
    left: 0,
    top: 0,
    width: Math.round((parts.height * 1.45) / 1.76),
    height: parts.height,
  })
  .resize(422, 512, { fit: "fill" })
  .webp({ quality: 88 })
  .toFile(out + "repair-parts-narrow.webp");
await sharp(root + "balcony-metal.png")
  .resize(256, 256)
  .webp({ quality: 88 })
  .toFile(out + "balcony-metal.webp");
