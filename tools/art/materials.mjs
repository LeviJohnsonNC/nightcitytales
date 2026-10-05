/**
 * Build the runtime derivatives of the tiling surface materials.
 *
 *     node tools/art/materials.mjs            write public/images/materials/*.webp
 *     node tools/art/materials.mjs --check    measure and report, write nothing
 *
 * The sources are 1254x1254 PNGs of about 3MB each, kept untouched in
 * src/assets/creator/. A combat scene draws a surface a few metres square to a
 * few hundred pixels, so the browser is only ever sent a 512x512 WebP of it.
 *
 * WHAT IS DONE TO EACH ONE, AND WHY
 *   - `period`: crop to a whole number of the pattern's own repeat. The paving
 *     slabs are 312px apart and the shutter slats 69.67px; the supplied canvas
 *     is not a multiple of either, which would leave a doubled joint or a
 *     half-slat at every tile boundary. Cropping to the period makes the tile
 *     repeat exactly rather than approximately. The crop starts on a joint, so
 *     the joint is centred on the tile edge when the tile repeats.
 *   - `seamless`: the four grain textures already tile (checked, below), so they
 *     are not blended or blurred. The check is what lets that be said.
 *   - resize to 512 with Lanczos, once. No sharpening, no contrast change and no
 *     colour change: how bright a surface is at night is the renderer's decision
 *     (`surfaceMaterials.ts`), not baked into a file.
 *
 * WHAT IT REPORTS
 *   - seam: the mean absolute difference across the wrap-around boundary, against
 *     the mean difference between neighbouring pixels elsewhere. A tile that
 *     repeats has a ratio near 1; a visible seam is well above it.
 *   - mean albedo (linear 0-255 average), which `surfaceMaterials.ts` divides by
 *     so a graded surface lands on the colour the old flat fill had.
 *   - lighting: the spread of brightness across an 8x8 blur. A texture with
 *     lighting baked into it (a vignette, a sheen) has a wide spread; flat
 *     material has almost none. Anything over LIGHTING_LIMIT is flagged.
 *
 * Re-running reproduces the committed files byte for byte.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "src/assets/creator";
const OUT_DIR = "public/images/materials";
const SIZE = 512;
const QUALITY = 90;
const SEAM_LIMIT = 1.4;
const LIGHTING_LIMIT = 12;

/**
 * `crop` is in source pixels: [left, top, size]. It is derived by looking, then
 * confirmed by the seam figure this script prints, never assumed.
 *   sidewalk: joints at x/y = 3, 311, 624, 938, 1251, so the period is 312 and
 *             four slabs span 3..1251.
 *   shutter:  eighteen slats of 69.67px fill the canvas exactly; no crop.
 */
const MATERIALS = [
  { name: "asphalt" },
  { name: "facade-concrete" },
  { name: "painted-metal" },
  { name: "roof-membrane" },
  { name: "shutter" },
  // A joint centred on the tile edge: neighbouring pixels there differ by the
  // joint's whole depth, which the plain ratio reads as a step. Judged by eye on
  // a 2x2 tiling instead (the joints run through unbroken), with a looser limit.
  { name: "sidewalk", crop: [3, 3, 1248], seamLimit: 1.8 },
  // the architectural pilot's neighbours (docs/architecture-pack.md)
  // Coarse grain: each 8x8 cell of the lighting probe holds only a few stones, so the
  // probe reads the stones (cells 92..110, no trend), not light. Its quadrant means
  // differ by 1.8/255: there is no gradient across it. Judged with that, and by eye
  // on a 2x2 tiling.
  { name: "roof-ballast", lightingLimit: 20 },
  { name: "painted-render" },
];

/** Mean |difference| across the wrap boundary vs. between ordinary neighbours. */
function seamRatio(rgb, size) {
  let wrap = 0;
  let inner = 0;
  let wrapN = 0;
  let innerN = 0;
  for (let y = 0; y < size; y++)
    for (let c = 0; c < 3; c++) {
      wrap += Math.abs(rgb[(y * size + size - 1) * 3 + c] - rgb[y * size * 3 + c]);
      wrapN++;
    }
  for (let x = 0; x < size; x++)
    for (let c = 0; c < 3; c++) {
      wrap += Math.abs(rgb[((size - 1) * size + x) * 3 + c] - rgb[x * 3 + c]);
      wrapN++;
    }
  for (let y = 0; y < size; y++)
    for (let x = 1; x < size; x++)
      for (let c = 0; c < 3; c++) {
        inner += Math.abs(rgb[(y * size + x) * 3 + c] - rgb[(y * size + x - 1) * 3 + c]);
        innerN++;
      }
  for (let y = 1; y < size; y++)
    for (let x = 0; x < size; x++)
      for (let c = 0; c < 3; c++) {
        inner += Math.abs(rgb[(y * size + x) * 3 + c] - rgb[((y - 1) * size + x) * 3 + c]);
        innerN++;
      }
  return wrap / wrapN / (inner / innerN);
}

async function measure(data, size) {
  const mean = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) mean[c] += data[i + c];
  const n = data.length / 3;
  const low = await sharp(data, { raw: { width: size, height: size, channels: 3 } })
    .greyscale()
    .resize(8, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  return {
    seam: seamRatio(data, size),
    mean: mean.map((v) => Math.round(v / n)),
    lighting: Math.max(...low) - Math.min(...low),
  };
}

async function main() {
  const check = process.argv.includes("--check");
  if (!check) await mkdir(OUT_DIR, { recursive: true });
  let failed = false;
  for (const material of MATERIALS) {
    const source = join(SOURCE_DIR, `${material.name}.png`);
    const meta = await sharp(source).metadata();
    if (meta.width !== meta.height) throw new Error(`${source} is not square`);
    let pipeline = sharp(source).removeAlpha();
    if (material.crop) {
      const [left, top, size] = material.crop;
      pipeline = pipeline.extract({ left, top, width: size, height: size });
    }
    const resized = await pipeline.resize(SIZE, SIZE, { kernel: "lanczos3" }).raw().toBuffer();
    const raw = { raw: { width: SIZE, height: SIZE, channels: 3 } };
    const after = await measure(resized, SIZE);
    const encoded = await sharp(resized, raw).webp({ quality: QUALITY, effort: 6 }).toBuffer();
    // The seam of the source, for the report: the figure the crop is judged by.
    const sourceRaw = await sharp(source).removeAlpha().raw().toBuffer();
    const sourceSeam = seamRatio(sourceRaw, meta.width);
    const flags = [];
    if (after.seam > (material.seamLimit ?? SEAM_LIMIT)) flags.push("SEAM");
    if (after.lighting > (material.lightingLimit ?? LIGHTING_LIMIT)) flags.push("BAKED LIGHT");
    if (flags.length) failed = true;
    console.log(
      `${material.name.padEnd(16)} ${meta.width}px → ${SIZE}px  ` +
        `seam ${sourceSeam.toFixed(2)} → ${after.seam.toFixed(2)}  ` +
        `mean rgb ${after.mean.join(",")}  light spread ${after.lighting}  ` +
        `${(encoded.length / 1024).toFixed(0)}KB ${flags.join(" ")}`,
    );
    if (!check) await writeFile(join(OUT_DIR, `${material.name}.webp`), encoded);
  }
  if (failed) {
    console.error("A material tiles badly or carries baked lighting: regenerate it.");
    process.exit(1);
  }
  if (!check) {
    const written = await stat(OUT_DIR);
    console.log(`wrote ${OUT_DIR} (${written.isDirectory() ? "ok" : "?"})`);
  }
}

await main();
