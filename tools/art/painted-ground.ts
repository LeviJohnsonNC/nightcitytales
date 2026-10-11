/** Import neutral four-metre ground panels; wetness and light remain runtime passes. */
import sharp from "sharp";
const input = "src/assets/creator/painted-ground/ground-atlas.webp";
const { width, height } = await sharp(input).metadata();
if (!width || !height || width !== height * 2) throw new Error("Expected two square ground panels");
for (const [index, name] of ["asphalt", "sidewalk"].entries()) {
  const output = `public/images/materials/${name}.webp`;
  await sharp(input)
    .extract({ left: index * height, top: 0, width: height, height })
    .resize(512, 512)
    .webp({ quality: 92, effort: 6 })
    .toFile(output);
  const stats = await sharp(output).stats();
  console.log(
    name,
    "mean",
    stats.channels.slice(0, 3).map((c) => Math.round(c.mean)),
  );
}
