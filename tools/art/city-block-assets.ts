/** Reproducible crops from the preserved transparent service atlas. */
import sharp from "sharp";
const source = "docs/city-block/service-atlas.png";
const cells = {
  meters: { left: 70, top: 10, width: 673, height: 450 },
  aircon: { left: 790, top: 60, width: 710, height: 408 },
  notices: { left: 76, top: 474, width: 665, height: 534 },
  mail: { left: 820, top: 537, width: 644, height: 450 },
};
for (const [name, rect] of Object.entries(cells)) {
  const file = `public/images/architecture/block-${name}.webp`;
  await sharp(source)
    .extract(rect)
    .resize({ width: 512 })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(file);
  const m = await sharp(file).metadata();
  console.log(name, m.width, m.height, m.hasAlpha);
}
