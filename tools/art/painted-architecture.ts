/** Import the approved painted architectural kit. Source apertures are registered
 * explicitly; runtime stretches the surrounding masonry, never the saved opening. */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const source = "src/assets/creator/painted-architecture";
const output = "public/images/architecture/painted";
await mkdir(output, { recursive: true });
for (const kind of ["upper", "frontage"] as const) {
  const input = `${source}/${kind}-atlas.webp`;
  const { width, height } = await sharp(input).metadata();
  if (!width || !height || width !== height * 2) throw new Error(`Invalid ${kind} atlas`);
  for (const [index, name] of ["market", "repair"].entries()) {
    await sharp(input)
      .extract({ left: index * height, top: 0, width: height, height })
      .resize(768, 768)
      .webp({ quality: 90, effort: 6 })
      .toFile(`${output}/${name}-${kind}.webp`);
  }
}
// The market keeps its real opening/recess and dynamic light passes. This crop
// supplies only the interior; architectural surround is registered independently.
await sharp(`${source}/frontage-atlas.webp`)
  .extract({ left: 204, top: 228, width: 480, height: 344 })
  .resize(768, 550)
  .webp({ quality: 90, effort: 6 })
  .toFile(`${output}/market-interior.webp`);
for (const [index, name] of ["service-masonry", "market-canopy"].entries()) {
  await sharp(`${source}/material-atlas.webp`)
    .extract({ left: index * 887, top: 0, width: 887, height: 887 })
    .resize(768, 768)
    .webp({ quality: 90, effort: 6 })
    .toFile(`${output}/${name}.webp`);
}
console.log("Imported registered facades, market interior, masonry and canopy");
