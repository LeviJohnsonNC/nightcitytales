/**
 * Cut the walk-on faces out of the walk-on scenes.
 *
 *     node tools/art/flavor-faces.mjs            write public/images/flavor/<id>-face.webp
 *     node tools/art/flavor-faces.mjs --check    report, write nothing
 *
 * WHY THIS EXISTS
 * The walk-on pictures are 3:2 paintings of a person at work, and the interface
 * used to draw them at 120x80: the face was a dozen pixels across and the rest
 * was neon. The strip beside a line of narration needs the face, so each entry
 * in src/data/cast/flavor-art.json records a `face` square (x, y, size in the
 * 1024x683 source) and this script cuts it to 256x256 (a 64px plate at 4x, a
 * 96px one at 2.5x). The squares were placed by eye against the paintings;
 * move one in the catalog and re-run, never edit a WebP.
 *
 * The large scene stays exactly as it was: it is what the dialog shows.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const OUT = 256;
const DIR = "public/images/flavor";
const check = process.argv.includes("--check");

const catalog = JSON.parse(await readFile("src/data/cast/flavor-art.json", "utf8"));
let bad = 0;
for (const { id, face } of catalog.entries) {
  const source = join(DIR, `${id}.webp`);
  const { width, height } = await sharp(source).metadata();
  const inside =
    face &&
    Number.isInteger(face.x) &&
    Number.isInteger(face.y) &&
    Number.isInteger(face.size) &&
    face.x >= 0 &&
    face.y >= 0 &&
    face.x + face.size <= width &&
    face.y + face.size <= height;
  if (!inside) {
    console.error(`${id}: face ${JSON.stringify(face)} is not inside ${width}x${height}`);
    bad += 1;
    continue;
  }
  if (check) continue;
  await sharp(source)
    .extract({ left: face.x, top: face.y, width: face.size, height: face.size })
    .resize(OUT, OUT, { kernel: "lanczos3" })
    .webp({ quality: 84 })
    .toFile(join(DIR, `${id}-face.webp`));
}
console.log(check ? `checked ${catalog.entries.length}` : `wrote ${catalog.entries.length} faces`);
if (bad) process.exit(1);
